import json
import time
from typing import TypedDict, List, Dict, Any, Optional
from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage

from llm_setup import get_llama3_llm
from retriever import HybridRetriever
from database import HybridDB

# State Definition
class GraphState(TypedDict):
    patient_report: str
    extracted_biomarkers: Optional[Dict[str, Any]]
    quiz_questions: Optional[List[str]]
    quiz_answers: Optional[Dict[str, str]]
    retrieved_trials: List[Dict[str, Any]]
    evaluation_results: List[Dict[str, Any]]
    task_list: Optional[List[str]]
    logs: List[str]

# Node 1: Abstractor
def abstractor_node(state: GraphState):
    llm = get_llama3_llm()
    report = state["patient_report"]
    answers = state.get("quiz_answers", {})
    
    # Append any answered quiz questions to the report context
    if answers:
        report += "\nAdditional Patient Info:\n"
        for q, a in answers.items():
            report += f"Q: {q}\nA: {a}\n"
            
    prompt = f"""
    You are an expert clinical data abstractor. Extract the following information from the patient report below and output ONLY valid JSON.
    Do not include any conversational filler.
    
    Schema:
    {{
        "age": <int or null>,
        "active_mutations": [<list of string acronyms or names, e.g. "EGFR", "BRCA1">],
        "past_therapies": [<list of string medication names>],
        "medical_terms_glossary": {{
            "<term>": "<short, 1-sentence plain-English explanation of the specialized term or acronym for a patient>"
        }}
    }}
    
    Make sure to include any complex medical jargon or acronyms found in the extracted fields (mutations, therapies) into the glossary with simple explanations.
    
    Patient Report:
    {report}
    """
    
    # Make LLM call
    state["logs"].append("> EXTRACTOR_AGENT: Analyzing raw patient report to extract biomarkers...")
    response = llm.invoke([HumanMessage(content=prompt)])
    
    # Parse JSON
    try:
        content = response.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].strip()
            
        start = content.find('{')
        end = content.rfind('}') + 1
        if start != -1 and end != 0:
            content = content[start:end]
            
        biomarkers = json.loads(content)
    except Exception as e:
        biomarkers = {"age": None, "active_mutations": [], "past_therapies": []}
        
    state["extracted_biomarkers"] = biomarkers
    state["logs"].append(f"> EXTRACTOR_AGENT: Located mutations {biomarkers.get('active_mutations', [])} and age {biomarkers.get('age')}.")
    return state

# Node 2: Quiz Generator
def quiz_generator_node(state: GraphState):
    # If we already have answers, skip generating the quiz again for those fields
    if state.get("quiz_answers"):
        return state

    biomarkers = state.get("extracted_biomarkers", {})
    missing_fields = []
    
    if not biomarkers.get("age"):
        missing_fields.append("age")
    if not biomarkers.get("active_mutations") or len(biomarkers["active_mutations"]) == 0:
        missing_fields.append("genetic mutations")
        
    if missing_fields:
        state["logs"].append(f"> QUIZ_GENERATOR: Missing critical info: {missing_fields}. Generating questions...")
        llm = get_llama3_llm()
        prompt = f"""
        The following patient information is missing: {missing_fields}.
        Generate a list of 1-2 simple questions to ask the patient to obtain this missing information.
        Output ONLY a valid JSON list of strings. Do not include conversational filler.
        Example: ["What is your current age?", "Have you had any genetic testing for mutations like EGFR or BRCA?"]
        """
        response = llm.invoke([HumanMessage(content=prompt)])
        
        try:
            content = response.content
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].strip()
                
            start = content.find('[')
            end = content.rfind(']') + 1
            if start != -1 and end != 0:
                content = content[start:end]
                
            questions = json.loads(content)
            if isinstance(questions, list) and len(questions) > 0:
                state["quiz_questions"] = questions
                state["logs"].append("> QUIZ_GENERATOR: Halting workflow to request user input.")
        except Exception:
            state["quiz_questions"] = None
    else:
        state["quiz_questions"] = None
        
    return state

def route_after_quiz(state: GraphState):
    if state.get("quiz_questions") and not state.get("quiz_answers"):
        return END
    return "retriever"

from clinical_trials_api import fetch_trials, parse_trials_to_chunks

# Node 3: Retriever
def retriever_node(state: GraphState):
    state["logs"].append("> RETRIEVER_AGENT: Initializing dynamic search over ClinicalTrials.gov API...")
    db = HybridDB()
    # Optional: Clear existing DB to ensure we only evaluate fresh trials for this patient
    # In a real system, you might persist them and just add new ones, but for this dynamic workflow we can just add them.
    
    biomarkers = state.get("extracted_biomarkers", {})
    mutations = " ".join(biomarkers.get("active_mutations", []))
    therapies = " ".join(biomarkers.get("past_therapies", []))
    
    query = f"{mutations} {therapies}"
    if not query.strip():
        query = "cancer"
        
    state["logs"].append(f"> RETRIEVER_AGENT: Fetching latest trials for query: '{query}'...")
    studies = fetch_trials(query, max_results=5)
    chunks = parse_trials_to_chunks(studies)
    
    if chunks:
        db.add_chunks(chunks)
        state["logs"].append(f"> RETRIEVER_AGENT: Ingested {len(chunks)} criteria chunks into HybridDB.")
    else:
        state["logs"].append("> RETRIEVER_AGENT: No trials found or parsed from API.")
        
    retriever = HybridRetriever(db)
    # Fetch more chunks initially to allow for grouping by trial
    top_chunks = retriever.search(query=query, top_k=8)
    
    # Group by NCT ID to prevent duplicate trial evaluations in the UI
    unique_trials = {}
    for chunk in top_chunks:
        nct_id = chunk.get("nct_id")
        if nct_id not in unique_trials:
            unique_trials[nct_id] = {
                "nct_id": nct_id,
                "title": chunk.get("title"),
                "chunk_type": chunk.get("chunk_type"),
                "text": chunk.get("text")
            }
        else:
            # Combine text of different chunks for the same trial (e.g. inclusion + exclusion)
            unique_trials[nct_id]["text"] += "\n\n---\n\n" + chunk.get("text")
            unique_trials[nct_id]["chunk_type"] = "combined"
            
    # Take the top 3 unique trials
    unique_top_trials = list(unique_trials.values())[:3]
    state["retrieved_trials"] = unique_top_trials
    
    nct_ids = [trial.get("nct_id") for trial in unique_top_trials]
    state["logs"].append(f"> RETRIEVER_AGENT: Aggregated into {len(unique_top_trials)} unique trials via Reciprocal Rank Fusion. Trials: {nct_ids}")
    
    return state

# Node 4: Evaluator
def evaluator_node(state: GraphState):
    llm = get_llama3_llm()
    biomarkers = state.get("extracted_biomarkers", {})
    trials = state.get("retrieved_trials", [])
    
    evaluation_results = []
    
    for trial in trials:
        time.sleep(3) # Anti rate-limit delay
        prompt = f"""
        You are a strict clinical trial evaluator. Compare the patient's data against the trial criteria below.
        Determine if the patient is EXCLUDED or a MATCH. 
        Output ONLY valid JSON.
        
        Patient Data:
        {json.dumps(biomarkers)}
        
        Trial Criteria:
        {trial.get('text')}
        
        Output Schema:
        {{
            "status": "MATCH" or "EXCLUDED",
            "reason": "<short explanation citing the specific criteria>",
            "key_patient_terms": ["<exact words from patient data that led to this decision, e.g. '45', 'EGFR'>"],
            "key_trial_terms": ["<exact words from trial criteria that led to this decision, e.g. 'Age >= 18', 'EGFR mutation'>"]
        }}
        """
        
        state["logs"].append(f"> EVALUATOR_AGENT: Cross-referencing {trial.get('chunk_type')} criteria for Trial {trial.get('nct_id')}...")
        response = llm.invoke([HumanMessage(content=prompt)])
        
        try:
            content = response.content
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].strip()
                
            start = content.find('{')
            end = content.rfind('}') + 1
            if start != -1 and end != 0:
                content = content[start:end]
                
            eval_dict = json.loads(content)
        except Exception as e:
            eval_dict = {
                "status": "UNKNOWN", 
                "reason": "Failed to parse LLM evaluation.",
                "key_patient_terms": [],
                "key_trial_terms": []
            }
            
        result = {
            "trial": trial,
            "evaluation": eval_dict
        }
        evaluation_results.append(result)
        
        if eval_dict.get("status", "").upper() == "EXCLUDED":
            state["logs"].append(f"> EVALUATOR_AGENT: Hard failure code detected. Patient excluded from {trial.get('nct_id')} due to: {eval_dict.get('reason')}")
        else:
            state["logs"].append(f"> EVALUATOR_AGENT: Validated match for {trial.get('nct_id')}.")
            
    state["evaluation_results"] = evaluation_results
    return state

# Node 4.5: Validator
def validator_node(state: GraphState):
    llm = get_llama3_llm()
    biomarkers = state.get("extracted_biomarkers", {})
    evaluation_results = state.get("evaluation_results", [])
    
    validated_results = []
    
    for result in evaluation_results:
        if result.get("evaluation", {}).get("status") == "MATCH":
            time.sleep(3) # Anti rate-limit delay
            state["logs"].append(f"> VALIDATOR_AGENT: Double-checking MATCH for Trial {result['trial']['nct_id']} against hard exclusions...")
            
            prompt = f"""
            You are a strict clinical trial validation agent.
            A previous evaluator marked this patient as a MATCH for the trial.
            Your job is to double-check for ANY hard exclusions in the trial criteria that the patient violates.
            Focus specifically on: Age limits, Pregnancy status, Organ function limits, and Prior therapies.
            
            Patient Data: {json.dumps(biomarkers)}
            Trial Criteria: {result['trial'].get('text')}
            
            If the patient violates ANY hard exclusion, change the status to EXCLUDED. Otherwise, keep it MATCH.
            Output ONLY valid JSON.
            
            Output Schema:
            {{
                "status": "MATCH" or "EXCLUDED",
                "reason": "Validation passed" or "<specific reason for exclusion>",
                "key_patient_terms": ["<exact words from patient data related to the exclusion, if applicable>"],
                "key_trial_terms": ["<exact words from trial criteria related to the exclusion, if applicable>"]
            }}
            """
            
            response = llm.invoke([HumanMessage(content=prompt)])
            
            try:
                content = response.content
                if "```json" in content:
                    content = content.split("```json")[1].split("```")[0].strip()
                elif "```" in content:
                    content = content.split("```")[1].strip()
                    
                start = content.find('{')
                end = content.rfind('}') + 1
                if start != -1 and end != 0:
                    content = content[start:end]
                    
                val_dict = json.loads(content)
                
                if val_dict.get("status", "").upper() == "EXCLUDED":
                    state["logs"].append(f"> VALIDATOR_AGENT: MATCH REJECTED! Found hard exclusion for {result['trial']['nct_id']}: {val_dict.get('reason')}")
                    result["evaluation"]["status"] = "EXCLUDED"
                    result["evaluation"]["reason"] = f"Validation Override: {val_dict.get('reason')}"
                    if val_dict.get("key_patient_terms"):
                        result["evaluation"]["key_patient_terms"] = val_dict["key_patient_terms"]
                    if val_dict.get("key_trial_terms"):
                        result["evaluation"]["key_trial_terms"] = val_dict["key_trial_terms"]
                else:
                    state["logs"].append(f"> VALIDATOR_AGENT: MATCH CONFIRMED for {result['trial']['nct_id']}.")
            except Exception:
                pass
                
        validated_results.append(result)
        
    state["evaluation_results"] = validated_results
    return state

# Node 5: Task Generator
def task_generator_node(state: GraphState):
    state["logs"].append("> TASK_GENERATOR: Creating personalized action plan based on evaluation results...")
    llm = get_llama3_llm()
    
    matches = [r for r in state.get("evaluation_results", []) if r.get("evaluation", {}).get("status") == "MATCH"]
    
    prompt = f"""
    Based on the following patient biomarkers and matching clinical trials, generate a short checklist of 3-5 actionable next steps for the patient.
    Output ONLY a valid JSON list of strings.
    
    Biomarkers: {json.dumps(state.get("extracted_biomarkers", dict()))}
    Matching Trials: {[m['trial']['nct_id'] for m in matches]}
    
    Example output:
    ["Discuss Afatinib eligibility with your primary oncologist.", "Request a follow-up biomarker test to confirm EGFR status.", "Review consent forms for Trial NCT01234567."]
    """
    
    response = llm.invoke([HumanMessage(content=prompt)])
    
    try:
        content = response.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].strip()
            
        start = content.find('[')
        end = content.rfind(']') + 1
        if start != -1 and end != 0:
            content = content[start:end]
            
        tasks = json.loads(content)
        if isinstance(tasks, list):
            state["task_list"] = tasks
            state["logs"].append("> TASK_GENERATOR: Generated task list successfully.")
    except Exception:
        state["task_list"] = ["Consult your doctor regarding the identified trial matches."]
        
    return state

def build_graph():
    """
    Constructs the LangGraph state machine routing the Abstractor, QuizGenerator, Retriever, Evaluator, Validator, and TaskGenerator nodes.
    """
    workflow = StateGraph(GraphState)
    
    workflow.add_node("abstractor", abstractor_node)
    workflow.add_node("quiz_generator", quiz_generator_node)
    workflow.add_node("retriever", retriever_node)
    workflow.add_node("evaluator", evaluator_node)
    workflow.add_node("validator", validator_node)
    workflow.add_node("task_generator", task_generator_node)
    
    workflow.set_entry_point("abstractor")
    workflow.add_edge("abstractor", "quiz_generator")
    workflow.add_conditional_edges("quiz_generator", route_after_quiz)
    workflow.add_edge("retriever", "evaluator")
    workflow.add_edge("evaluator", "validator")
    workflow.add_edge("validator", "task_generator")
    workflow.add_edge("task_generator", END)
    
    app = workflow.compile()
    return app

if __name__ == "__main__":
    app = build_graph()
    print("LangGraph Orchestrator built successfully.")
