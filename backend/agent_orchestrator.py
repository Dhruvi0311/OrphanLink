import json
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
    retrieved_trials: List[Dict[str, Any]]
    evaluation_results: List[Dict[str, Any]]
    logs: List[str]

# Node 1: Abstractor
def abstractor_node(state: GraphState):
    llm = get_llama3_llm()
    report = state["patient_report"]
    
    prompt = f"""
    You are an expert clinical data abstractor. Extract the following information from the patient report below and output ONLY valid JSON.
    Do not include any conversational filler.
    
    Schema:
    {{
        "age": <int or null>,
        "active_mutations": [<list of string acronyms or names, e.g. "EGFR", "BRCA1">],
        "past_therapies": [<list of string medication names>]
    }}
    
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
            
        # find first '{' and last '}'
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

# Node 2: Retriever
def retriever_node(state: GraphState):
    state["logs"].append("> RETRIEVER_AGENT: Initializing hybrid semantic + BM25 search over trial database...")
    db = HybridDB()
    retriever = HybridRetriever(db)
    
    biomarkers = state.get("extracted_biomarkers", {})
    mutations = " ".join(biomarkers.get("active_mutations", []))
    therapies = " ".join(biomarkers.get("past_therapies", []))
    
    query = f"{mutations} {therapies}"
    if not query.strip():
        query = "cancer"
        
    top_chunks = retriever.search(query=query, top_k=3)
    state["retrieved_trials"] = top_chunks
    
    nct_ids = [chunk.get("nct_id") for chunk in top_chunks]
    state["logs"].append(f"> RETRIEVER_AGENT: Found {len(top_chunks)} relevant trial chunks via Reciprocal Rank Fusion. Trials: {nct_ids}")
    
    return state

# Node 3: Evaluator
def evaluator_node(state: GraphState):
    llm = get_llama3_llm()
    biomarkers = state.get("extracted_biomarkers", {})
    trials = state.get("retrieved_trials", [])
    
    evaluation_results = []
    
    for trial in trials:
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
            "reason": "<short explanation citing the specific criteria>"
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
            eval_dict = {"status": "UNKNOWN", "reason": "Failed to parse LLM evaluation."}
            
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

def build_graph():
    """
    Constructs the LangGraph state machine routing the Abstractor, Retriever, and Evaluator nodes.
    """
    workflow = StateGraph(GraphState)
    
    workflow.add_node("abstractor", abstractor_node)
    workflow.add_node("retriever", retriever_node)
    workflow.add_node("evaluator", evaluator_node)
    
    workflow.set_entry_point("abstractor")
    workflow.add_edge("abstractor", "retriever")
    workflow.add_edge("retriever", "evaluator")
    workflow.add_edge("evaluator", END)
    
    app = workflow.compile()
    return app

if __name__ == "__main__":
    app = build_graph()
    print("LangGraph Orchestrator built successfully.")
