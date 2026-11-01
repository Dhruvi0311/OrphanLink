import json
import time
from typing import TypedDict, List, Dict, Any, Optional
from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage

from llm_setup import get_llama3_llm
from retriever import HybridRetriever
from database import HybridDB
from prompt.abstractor import get_abstractor_prompt
from prompt.quiz_generator import get_quiz_generator_prompt
from prompt.chat_intake import get_chat_intake_prompt
from prompt.evaluator import get_evaluator_prompt
from prompt.validator import get_validator_prompt
from prompt.task_generator import get_task_generator_prompt
from entity_linker import standardize_biomarkers
from eligibility_policy import enforce_trial_eligibility_policy, TrialMatchStatus, CriterionStatus

# State Definition
class GraphState(TypedDict):
    patient_report: str
    chat_history: List[Dict[str, str]]
    extracted_biomarkers: Optional[Dict[str, Any]]
    standardized_biomarkers: Optional[Dict[str, Any]]
    quiz_questions: Optional[List[str]]
    quiz_answers: Optional[Dict[str, str]]
    retrieved_trials: List[Dict[str, Any]]
    evaluation_results: List[Dict[str, Any]]
    task_list: Optional[List[str]]
    logs: List[str]
    validation_feedback: Optional[Dict[str, str]]
    retry_count: Optional[int]

# Node 1: Abstractor
def abstractor_node(state: GraphState):
    llm = get_llama3_llm(json_mode=True, max_tokens=600)
    report = state.get("patient_report", "")
    answers = state.get("quiz_answers", {})
    chat_history = state.get("chat_history", [])
    
    # Append any answered quiz questions to the report context
    if answers:
        report += "\nAdditional Patient Info:\n"
        for q, a in answers.items():
            report += f"Q: {q}\nA: {a}\n"
            
    # Include chat history if present
    if chat_history:
        report += "\nConversation History:\n"
        for msg in chat_history:
            role = msg.get("role", "unknown").upper()
            content = msg.get("content", "")
            report += f"{role}: {content}\n"
            
    prompt = get_abstractor_prompt(report)
    
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
    
    # Priority 1: Primary Condition / Cancer Type
    if not biomarkers.get("condition_or_cancer_type"):
        missing_fields.append("primary condition or cancer type")
        
    # Priority 2: Current Age
    if not biomarkers.get("age"):
        missing_fields.append("current age")
        
    # Priority 3: Genetic Mutations
    if not biomarkers.get("active_mutations") or len(biomarkers["active_mutations"]) == 0:
        missing_fields.append("genetic mutations or biomarkers (e.g. BRCA2, EGFR, or none)")
        
    # Priority 4: Prior Therapies
    chat_len = len(state.get("chat_history", []))
    if (not biomarkers.get("past_therapies") or len(biomarkers["past_therapies"]) == 0) and chat_len < 6:
        if biomarkers.get("condition_or_cancer_type") and biomarkers.get("age"):
            missing_fields.append("prior therapies received (e.g. chemotherapy, immunotherapy, or none)")
            
    # Guardrail: Once condition and age are present and the user has participated in 5+ turns, allow trial matching
    if chat_len >= 6 and biomarkers.get("condition_or_cancer_type") and biomarkers.get("age"):
        missing_fields = []
        
    if missing_fields:
        state["logs"].append(f"> QUIZ_GENERATOR: Missing critical info: {missing_fields}. Generating questions...")
        llm = get_llama3_llm()
        if state.get("chat_history"):
            prompt = get_chat_intake_prompt(state.get("chat_history"), missing_fields)
        else:
            prompt = get_quiz_generator_prompt(missing_fields)
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
                unique_qs = []
                for q in questions:
                    if q not in unique_qs:
                        unique_qs.append(q)
                state["quiz_questions"] = unique_qs
                state["logs"].append("> QUIZ_GENERATOR: Halting workflow to request user input.")
        except Exception:
            state["quiz_questions"] = None
    else:
        state["quiz_questions"] = None
        
    return state

def route_after_quiz(state: GraphState):
    if state.get("quiz_questions") and not state.get("quiz_answers"):
        return END
    return "entity_linker"

def entity_linker_node(state: GraphState):
    state["logs"].append("> ENTITY_LINKER: Standardizing extracted biomarkers via APIs...")
    biomarkers = state.get("extracted_biomarkers", {})
    
    std_biomarkers = standardize_biomarkers(biomarkers)
    state["standardized_biomarkers"] = std_biomarkers
    
    # Log the mappings
    for orig, std in zip(biomarkers.get("past_therapies", []), std_biomarkers.get("past_therapies", [])):
        if orig.lower() != std.lower():
            state["logs"].append(f"> ENTITY_LINKER: Normalized therapy '{orig}' to '{std}' (RxNorm)")
            
    for orig, std in zip(biomarkers.get("active_mutations", []), std_biomarkers.get("active_mutations", [])):
        if orig.lower() != std.lower():
            state["logs"].append(f"> ENTITY_LINKER: Normalized mutation '{orig}' to '{std}' (MyGene.info)")
            
    return state

from clinical_trials_api import fetch_trials, parse_trials_to_chunks

def deduplicate_and_clean_text(text: str) -> str:
    """
    Cleans up repeated lines, redundant separators, or identical criteria paragraphs.
    """
    if not text:
        return ""
    lines = text.splitlines()
    cleaned_lines = []
    seen_lines = set()
    
    for line in lines:
        stripped = line.strip()
        if not stripped:
            if cleaned_lines and cleaned_lines[-1] != "":
                cleaned_lines.append("")
            continue
            
        if stripped == "---":
            if cleaned_lines and cleaned_lines[-1] != "---":
                cleaned_lines.append("---")
            continue
            
        norm_line = stripped.lower()
        if norm_line in seen_lines:
            continue
            
        seen_lines.add(norm_line)
        cleaned_lines.append(line)
        
    return "\n".join(cleaned_lines).strip()

def deduplicate_sentences(text: str) -> str:
    """
    Removes identical consecutive or repeated sentences from LLM reasoning.
    """
    if not text:
        return ""
    import re
    sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', text) if s.strip()]
    seen = set()
    cleaned = []
    for s in sentences:
        s_norm = s.lower()
        if s_norm not in seen:
            seen.add(s_norm)
            cleaned.append(s)
    return " ".join(cleaned)

# Node 3: Retriever
def retriever_node(state: GraphState):
    state["logs"].append("> RETRIEVER_AGENT: Initializing dynamic search over ClinicalTrials.gov API...")
    db = HybridDB()
    # Optional: Clear existing DB to ensure we only evaluate fresh trials for this patient
    # In a real system, you might persist them and just add new ones, but for this dynamic workflow we can just add them.
    
    import re
    biomarkers = state.get("standardized_biomarkers") or state.get("extracted_biomarkers", {})
    condition = biomarkers.get("condition_or_cancer_type") or ""
    clean_condition = re.sub(r'\(.*?\)', '', condition).strip()
    clean_condition = re.sub(r'\s+', ' ', clean_condition)
    
    # Filter active mutations to concise gene symbols (e.g. BRCA1, EGFR)
    clean_mutations = " ".join([
        m for m in biomarkers.get("active_mutations", []) 
        if len(m) <= 10 and not any(w in m.lower() for w in ["none", "wild-type", "negative", "tested"])
    ])
    
    # Extract short generic medication names if present, avoiding full sentences
    clean_drugs = []
    for d in (biomarkers.get("past_therapies") or []) + [t.get("name") for t in biomarkers.get("verified_therapies", []) if isinstance(t, dict)]:
        if d:
            clean_d = re.sub(r'\(.*?\)', '', str(d)).strip()
            words = clean_d.split()
            if 1 <= len(words) <= 2 and not any(w in clean_d.lower() for w in ["regimen", "cycle", "completed", "prior", "setting", "month", "week"]):
                if clean_d not in clean_drugs:
                    clean_drugs.append(clean_d)
                    
    # Priority query: concise condition + mutation (most precise for ClinicalTrials.gov V2)
    primary_query = f"{clean_condition} {clean_mutations}".strip()
    if clean_drugs and len(primary_query.split()) < 5:
        primary_query += f" {clean_drugs[0]}"
    query = primary_query if primary_query else (clean_condition or "cancer")
    
    state["logs"].append(f"> RETRIEVER_AGENT: Fetching latest trials for query: '{query}'...")
    studies = fetch_trials(query, max_results=5)
    if not studies and clean_condition:
        state["logs"].append(f"> RETRIEVER_AGENT: Broadening search query to '{clean_condition}'...")
        studies = fetch_trials(clean_condition, max_results=5)
        
    # Check if patient report explicitly references candidate NCT IDs (e.g. screened trials)
    from clinical_trials_api import fetch_study_by_nct_id
    mentioned_ncts = re.findall(r'\b(NCT\d{8})\b', state.get("patient_report", ""), re.IGNORECASE)
    for nct_match in mentioned_ncts:
        nct_norm = nct_match.upper()
        if not any(s.get("protocolSection", {}).get("identificationModule", {}).get("nctId") == nct_norm for s in studies):
            study = fetch_study_by_nct_id(nct_norm)
            if study and study.get("protocolSection"):
                studies.append(study)
                state["logs"].append(f"> RETRIEVER_AGENT: Loaded referenced study {nct_norm} directly from ClinicalTrials.gov.")
                
    chunks = parse_trials_to_chunks(studies)
    
    if chunks:
        db.add_chunks(chunks)
        state["logs"].append(f"> RETRIEVER_AGENT: Ingested {len(chunks)} criteria chunks into HybridDB.")
    else:
        state["logs"].append("> RETRIEVER_AGENT: No trials found or parsed from API.")
        
    retriever = HybridRetriever(db)
    top_chunks = retriever.search(query=query, top_k=8)
    
    # Always include chunks from freshly fetched studies alongside retriever search results
    candidate_chunks = list(top_chunks)
    seen_chunk_keys = set(f"{c.get('nct_id')}_{c.get('chunk_type')}" for c in top_chunks)
    for c in chunks:
        c_nct = getattr(c, "nct_id", "")
        c_type = getattr(c, "chunk_type", "")
        key = f"{c_nct}_{c_type}"
        if key not in seen_chunk_keys:
            candidate_chunks.append({
                "nct_id": c_nct,
                "title": getattr(c, "title", "Clinical Trial"),
                "chunk_type": c_type,
                "text": getattr(c, "text", ""),
                "recruitment_status": getattr(c, "recruitment_status", "UNKNOWN"),
                "locations": getattr(c, "locations", []),
                "has_indian_site": getattr(c, "has_indian_site", False),
                "countries": getattr(c, "countries", [])
            })
            seen_chunk_keys.add(key)
            
    # Group by NCT ID and distinct chunk type to prevent duplicate trial evaluations in the UI
    unique_trials = {}
    for chunk in candidate_chunks:
        nct_id = chunk.get("nct_id")
        if not nct_id:
            continue
        chunk_type = chunk.get("chunk_type", "general")
        chunk_text = (chunk.get("text") or "").strip()
        title = chunk.get("title", "Clinical Trial")
        recruitment_status = chunk.get("recruitment_status", "UNKNOWN")
        locations = chunk.get("locations", [])
        has_indian_site = chunk.get("has_indian_site", False)
        countries = chunk.get("countries", [])
        
        if nct_id not in unique_trials:
            unique_trials[nct_id] = {
                "nct_id": nct_id,
                "title": title,
                "chunk_type": chunk_type,
                "recruitment_status": recruitment_status,
                "locations": list(locations),
                "has_indian_site": has_indian_site,
                "countries": list(countries),
                "chunks_by_type": {chunk_type: chunk_text}
            }
        else:
            if chunk_type not in unique_trials[nct_id]["chunks_by_type"]:
                unique_trials[nct_id]["chunks_by_type"][chunk_type] = chunk_text
                unique_trials[nct_id]["chunk_type"] = "combined"
            if has_indian_site:
                unique_trials[nct_id]["has_indian_site"] = True
            if locations:
                for loc in locations:
                    if loc not in unique_trials[nct_id]["locations"]:
                        unique_trials[nct_id]["locations"].append(loc)
            if countries:
                for c in countries:
                    if c not in unique_trials[nct_id]["countries"]:
                        unique_trials[nct_id]["countries"].append(c)
                
    # Format and deduplicate criteria text for each trial
    for nct_id, trial in unique_trials.items():
        chunks_map = trial.pop("chunks_by_type", {})
        title = trial.get("title", "")
        rec_status = trial.get("recruitment_status", "UNKNOWN")
        
        if len(chunks_map) == 1:
            raw_text = list(chunks_map.values())[0]
            trial["text"] = deduplicate_and_clean_text(raw_text)
        else:
            header = f"Trial Title: {title}\nNCT ID: {nct_id}\nStatus: {rec_status}\n\n"
            sections = []
            
            if "inclusion" in chunks_map:
                inc_text = chunks_map["inclusion"]
                if "Details:\n" in inc_text:
                    inc_text = inc_text.split("Details:\n", 1)[1]
                sections.append(f"[INCLUSION CRITERIA]\n{inc_text.strip()}")
                
            if "exclusion" in chunks_map:
                exc_text = chunks_map["exclusion"]
                if "Details:\n" in exc_text:
                    exc_text = exc_text.split("Details:\n", 1)[1]
                sections.append(f"[EXCLUSION CRITERIA]\n{exc_text.strip()}")
                
            for c_type, c_text in chunks_map.items():
                if c_type not in ["inclusion", "exclusion"]:
                    if "Details:\n" in c_text:
                        c_text = c_text.split("Details:\n", 1)[1]
                    sections.append(f"[{c_type.upper()} CRITERIA]\n{c_text.strip()}")
                    
            combined_text = header + "\n\n".join(sections)
            trial["text"] = deduplicate_and_clean_text(combined_text)
            
    # Prioritise Indian recruiting sites for Indian patient searches and active recruiting trials
    def trial_priority_key(t):
        rec_stat = t.get("recruitment_status", "").upper()
        is_recruiting = 2 if rec_stat == "RECRUITING" else (1 if rec_stat in ["NOT_YET_RECRUITING", "ACTIVE_NOT_RECRUITING"] else 0)
        is_india = 1 if t.get("has_indian_site") else 0
        return (is_recruiting, is_india)

    sorted_trials = sorted(unique_trials.values(), key=trial_priority_key, reverse=True)
    unique_top_trials = sorted_trials[:4]
    state["retrieved_trials"] = unique_top_trials
    
    nct_ids = [trial.get("nct_id") for trial in unique_top_trials]
    state["logs"].append(f"> RETRIEVER_AGENT: Aggregated into {len(unique_top_trials)} unique trials (prioritizing recruiting/Indian sites). Trials: {nct_ids}")
    
    return state

import concurrent.futures

# Node 4: Evaluator
def evaluator_node(state: GraphState):
    llm = get_llama3_llm(json_mode=True, max_tokens=600)
    biomarkers = state.get("extracted_biomarkers", {})
    trials = state.get("retrieved_trials", [])
    feedback = state.get("validation_feedback", {})
    existing_results = {r['trial']['nct_id']: r for r in state.get("evaluation_results", [])}
    
    evaluation_results = []
    
    def process_trial(trial):
        nct_id = trial.get('nct_id')
        
        if existing_results and nct_id not in feedback and existing_results.get(nct_id):
            return {"result": existing_results[nct_id], "logs": []}
            
        trial_feedback = feedback.get(nct_id)
        prompt = get_evaluator_prompt(biomarkers, trial.get('text'), trial_feedback)
        
        logs = []
        if trial_feedback:
            logs.append(f"> EVALUATOR_AGENT: Re-evaluating {nct_id} based on Validator feedback...")
        else:
            logs.append(f"> EVALUATOR_AGENT: Cross-referencing {trial.get('chunk_type')} criteria for Trial {nct_id}...")
            
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
                "criteria_evaluations": [],
                "missing_information_questions": [],
                "key_patient_terms": [],
                "key_trial_terms": []
            }
            
        # Attach trial metadata to eval_dict
        eval_dict["recruitment_status"] = trial.get("recruitment_status", "UNKNOWN")
        eval_dict["locations"] = trial.get("locations", [])
        eval_dict["has_indian_site"] = trial.get("has_indian_site", False)
        eval_dict["countries"] = trial.get("countries", [])
        
        # Deterministically enforce the clinical trial eligibility policy
        eval_dict = enforce_trial_eligibility_policy(eval_dict, biomarkers, trial.get('text', ''))
        
        # Deduplicate repeating sentences or terms in LLM reasoning
        if eval_dict.get("reason"):
            eval_dict["reason"] = deduplicate_sentences(eval_dict["reason"])
        if eval_dict.get("key_patient_terms"):
            eval_dict["key_patient_terms"] = list(dict.fromkeys(eval_dict["key_patient_terms"]))
        if eval_dict.get("key_trial_terms"):
            eval_dict["key_trial_terms"] = list(dict.fromkeys(eval_dict["key_trial_terms"]))
            
        result = {
            "trial": trial,
            "evaluation": eval_dict
        }
        
        status_upper = eval_dict.get("status", "").upper()
        if status_upper == "EXCLUDED":
            if trial_feedback:
                logs.append(f"> EVALUATOR_AGENT: Agreed with Validator. Patient excluded from {nct_id} due to: {eval_dict.get('reason')}")
            else:
                logs.append(f"> EVALUATOR_AGENT: Hard failure code detected. Patient excluded from {nct_id} due to: {eval_dict.get('reason')}")
        elif status_upper == "NEEDS_MORE_INFORMATION":
            logs.append(f"> EVALUATOR_AGENT: Status INDETERMINATE / NEEDS_MORE_INFORMATION for {nct_id}. Clarification questions: {eval_dict.get('missing_information_questions', [])[:1]}")
        else:
            if trial_feedback:
                logs.append(f"> EVALUATOR_AGENT: Confirms POTENTIAL_MATCH for {nct_id} despite feedback.")
            else:
                logs.append(f"> EVALUATOR_AGENT: Validated POTENTIAL_MATCH for {nct_id}.")
                
        return {"result": result, "logs": logs}

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(process_trial, trial) for trial in trials]
        for future in concurrent.futures.as_completed(futures):
            res = future.result()
            evaluation_results.append(res["result"])
            state["logs"].extend(res["logs"])
            
    state["evaluation_results"] = evaluation_results
    return state

def validator_node(state: GraphState):
    llm = get_llama3_llm(json_mode=True, max_tokens=500)
    biomarkers = state.get("extracted_biomarkers", {})
    evaluation_results = state.get("evaluation_results", [])
    retry_count = state.get("retry_count", 0)
    
    validated_results = []
    feedback = {}
    
    def process_validation(result):
        nct_id = result['trial']['nct_id']
        current_status = result.get("evaluation", {}).get("status", "POTENTIAL_MATCH")
        logs = []
        if current_status in ["MATCH", "POTENTIAL_MATCH", "NEEDS_MORE_INFORMATION"]:
            logs.append(f"> VALIDATOR_AGENT: Double-checking {current_status} for Trial {nct_id} against hard exclusions...")
            
            prompt = get_validator_prompt(biomarkers, result['trial'].get('text'), current_status)
            
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
                    reason = deduplicate_sentences(val_dict.get('reason', ''))
                    logs.append(f"> VALIDATOR_AGENT: Contradiction found for {nct_id}: {reason}")
                    
                    if retry_count < 2:
                        return {"result": result, "feedback": {nct_id: reason}, "logs": logs}
                    else:
                        logs.append(f"> VALIDATOR_AGENT: Max retries reached. Forcing EXCLUDED for {nct_id}.")
                        result["evaluation"]["status"] = "EXCLUDED"
                        result["evaluation"]["reason"] = f"Validation Override: {reason}"
                        if val_dict.get("key_patient_terms"):
                            result["evaluation"]["key_patient_terms"] = list(dict.fromkeys(val_dict["key_patient_terms"]))
                        if val_dict.get("key_trial_terms"):
                            result["evaluation"]["key_trial_terms"] = list(dict.fromkeys(val_dict["key_trial_terms"]))
                else:
                    logs.append(f"> VALIDATOR_AGENT: {current_status} CONFIRMED for {nct_id}.")
            except Exception:
                pass
                
        return {"result": result, "feedback": {}, "logs": logs}

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(process_validation, res) for res in evaluation_results]
        for future in concurrent.futures.as_completed(futures):
            res = future.result()
            validated_results.append(res["result"])
            feedback.update(res["feedback"])
            state["logs"].extend(res["logs"])
            
    state["evaluation_results"] = validated_results
    
    if feedback:
        state["validation_feedback"] = feedback
        state["retry_count"] = retry_count + 1
    else:
        state["validation_feedback"] = None
        state["retry_count"] = 0
        
    return state

# Node 5: Task Generator
def task_generator_node(state: GraphState):
    state["logs"].append("> TASK_GENERATOR: Creating personalized action plan based on evaluation results...")
    llm = get_llama3_llm(json_mode=False, max_tokens=350)
    
    matches = [r for r in state.get("evaluation_results", []) if r.get("evaluation", {}).get("status") in ["MATCH", "POTENTIAL_MATCH", "NEEDS_MORE_INFORMATION"]]
    
    prompt = get_task_generator_prompt(state.get("extracted_biomarkers", dict()), matches)
    
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

def route_after_validator(state: GraphState):
    if state.get("validation_feedback"):
        return "evaluator"
    return "task_generator"

def build_graph():
    """
    Constructs the LangGraph state machine routing the Abstractor, QuizGenerator, Retriever, Evaluator, Validator, and TaskGenerator nodes.
    """
    workflow = StateGraph(GraphState)
    
    workflow.add_node("abstractor", abstractor_node)
    workflow.add_node("quiz_generator", quiz_generator_node)
    workflow.add_node("entity_linker", entity_linker_node)
    workflow.add_node("retriever", retriever_node)
    workflow.add_node("evaluator", evaluator_node)
    workflow.add_node("validator", validator_node)
    workflow.add_node("task_generator", task_generator_node)
    
    workflow.set_entry_point("abstractor")
    workflow.add_edge("abstractor", "quiz_generator")
    workflow.add_conditional_edges("quiz_generator", route_after_quiz)
    workflow.add_edge("entity_linker", "retriever")
    workflow.add_edge("retriever", "evaluator")
    workflow.add_edge("evaluator", "validator")
    workflow.add_conditional_edges("validator", route_after_validator)
    workflow.add_edge("task_generator", END)
    
    app = workflow.compile()
    return app

if __name__ == "__main__":
    app = build_graph()
    print("LangGraph Orchestrator built successfully.")
