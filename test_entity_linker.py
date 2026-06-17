import json
import logging
from agent_orchestrator import build_graph

# Configure logging
logging.basicConfig(level=logging.INFO)

# Load the patient report
with open("sample_patient_report.txt", "r") as f:
    report_text = f.read()

state = {
    "patient_report": report_text,
    "extracted_biomarkers": None,
    "standardized_biomarkers": None,
    "quiz_questions": None,
    "quiz_answers": None,
    "retrieved_trials": [],
    "evaluation_results": [],
    "task_list": None,
    "logs": []
}

print("Building graph...")
graph = build_graph()

print("Invoking graph...")
# Since we just want to test up to retriever, maybe we can just run the nodes or full graph
# Note: we can just run it and print logs.
for output in graph.stream(state):
    for node_name, updated_state in output.items():
        print(f"--- Node: {node_name} ---")
        if node_name == "entity_linker":
            print("Extracted:", updated_state.get("extracted_biomarkers"))
            print("Standardized:", updated_state.get("standardized_biomarkers"))
        
        # print new logs
        logs = updated_state.get("logs", [])
        if logs:
            print("Last Log:", logs[-1])

print("\nDone.")
