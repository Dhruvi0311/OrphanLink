from agent_orchestrator import build_graph

graph = build_graph()
state = {
    "patient_report": "Patient is a 45-year-old presenting with an EGFR mutation. Has a history of taking Afatinib.",
    "extracted_biomarkers": None,
    "retrieved_trials": [],
    "evaluation_results": [],
    "logs": []
}
print("Starting LangGraph execution...")
for output in graph.stream(state):
    for node_name, updated_state in output.items():
        print(f"--- Node: {node_name} ---")
        for log in updated_state.get("logs", []):
            print(log)

print("\nFinal Results:")
if "evaluation_results" in updated_state:
    for result in updated_state["evaluation_results"]:
        status = result.get("evaluation", {}).get("status")
        reason = result.get("evaluation", {}).get("reason")
        print(f"Trial: {result['trial']['nct_id']} - {status} - {reason}")
