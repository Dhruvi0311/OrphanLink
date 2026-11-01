import requests
import json
import time

def test_upload():
    url = "http://localhost:8000/upload"
    files = [
        ("files", ("pathology_report.txt", open("sample_documents/pathology_report.txt", "rb"), "text/plain")),
        ("files", ("oncology_summary.txt", open("sample_documents/oncology_summary.txt", "rb"), "text/plain"))
    ]
    
    print("Uploading multiple documents to /upload...")
    resp = requests.post(url, files=files)
    print("Upload Status:", resp.status_code)
    data = resp.json()
    print("Upload Response:", data)
    job_id = data.get("job_id")
    assert job_id, "No job_id returned"
    
    stream_url = f"http://localhost:8000/stream/{job_id}"
    print(f"Connecting to stream: {stream_url}...")
    stream_resp = requests.get(stream_url, stream=True, timeout=60)
    
    biomarkers = None
    completed = False
    
    for line in stream_resp.iter_lines():
        if not line:
            continue
        line_str = line.decode('utf-8')
        if line_str.startswith("data: "):
            msg = json.loads(line_str[6:])
            event = msg.get("event")
            if event == "log":
                print(f"[Log] {msg.get('message')}")
            elif event == "intermediate_biomarkers":
                biomarkers = msg.get("biomarkers")
                print(f"[Biomarkers Preview]: {json.dumps(biomarkers, indent=2)}")
            elif event == "quiz_required":
                print(f"[Quiz Required]: Questions: {msg.get('questions')}")
                break
            elif event == "completed":
                print("[Completed!]")
                completed = True
                final_state = msg.get("state", {})
                evals = final_state.get("evaluation_results", [])
                print(f"\nEvaluated Trials Count: {len(evals)}")
                for r in evals:
                    t = r.get("trial", {})
                    ev = r.get("evaluation", {})
                    print(f"Trial: {t.get('nct_id')} | Status: {ev.get('status')} | Reason: {ev.get('reason')}")
                    for c in ev.get("criteria_evaluations", [])[:3]:
                        print(f"   Criterion [{c.get('status')}]: {c.get('criterion_text')[:60]}... Evidence: {c.get('evidence_snippet')}")
                break

    print("\nMulti-upload verification completed successfully.")

if __name__ == "__main__":
    test_upload()
