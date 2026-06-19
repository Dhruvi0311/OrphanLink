import requests
import json
import sys

def main():
    file_path = "/home/dhruvi/OrphanLink/Invitae - SR272_Invitae_Sample_Report_BRCA2_Positive.pdf"
    upload_url = "http://localhost:8000/upload"
    
    print(f"Uploading file: {file_path}")
    with open(file_path, "rb") as f:
        r = requests.post(upload_url, files={"file": f})
        
    if r.status_code != 200:
        print(f"Upload failed: {r.status_code} {r.text}")
        return
        
    job_id = r.json().get("job_id")
    print(f"File uploaded successfully. Job ID: {job_id}\n")
    
    # Function to read stream and handle events
    def listen_to_stream(jid):
        stream_url = f"http://localhost:8000/stream/{jid}"
        print(f"--- Listening to stream for job {jid} ---")
        
        # We use stream=True to read line by line (SSE)
        response = requests.get(stream_url, stream=True)
        for line in response.iter_lines():
            if not line:
                continue
            line_decoded = line.decode('utf-8')
            if line_decoded.startswith("data: "):
                data_str = line_decoded[6:] # Strip "data: "
                try:
                    data = json.loads(data_str)
                    event = data.get("event")
                    if event == "log":
                        print(f"[Log] {data.get('message')}")
                    elif event == "quiz_required":
                        print("\n[Event] Quiz Required!")
                        print(f"Biomarkers extracted: {json.dumps(data.get('biomarkers'), indent=2)}")
                        print("Quiz Questions:")
                        questions = data.get("questions", [])
                        for idx, q in enumerate(questions):
                            print(f"  {idx+1}. {q}")
                        return "quiz", questions
                    elif event == "completed":
                        print("\n[Event] Completed!")
                        return "completed", data.get("state")
                    elif event == "error":
                        print(f"\n[Event Error] {data.get('message')}")
                        return "error", data.get("message")
                except Exception as e:
                    print(f"Error parsing SSE line: {e}. Raw line: {line_decoded}")
        return "ended", None

    # First stream connection
    status, payload = listen_to_stream(job_id)
    
    if status == "quiz":
        # Let's construct mock answers to the quiz
        questions = payload
        answers = {}
        for q in questions:
            # We answer mock values based on typical clinical trial questions
            # Let's just say "No" or "Unknown" or provide default values
            answers[q] = "No other cancer history, age 45, female, no prior chemotherapy."
            
        print("\nSubmitting answers...")
        submit_url = "http://localhost:8000/submit-quiz"
        r_submit = requests.post(submit_url, json={"job_id": job_id, "answers": answers})
        print(f"Submit quiz response code: {r_submit.status_code}")
        
        # Second stream connection (after submit-quiz)
        status, payload = listen_to_stream(job_id)
        
    if status == "completed":
        print("\n--- Pipeline successfully completed! ---")
        state = payload
        print("\n=== Extracted Biomarkers ===")
        print(json.dumps(state.get("extracted_biomarkers"), indent=2))
        
        print("\n=== Retrieved Trials ===")
        trials = state.get("retrieved_trials", [])
        print(f"Found {len(trials)} trials.")
        for idx, t in enumerate(trials[:5]): # show top 5
            print(f"\nTrial {idx+1}: {t.get('title')} ({t.get('nct_id')})")
            print(f"  Chunk Type: {t.get('chunk_type')}")
            print(f"  Criteria: {t.get('text', '')[:120]}...")
            
        print("\n=== Evaluation & Validation Results ===")
        eval_results = state.get("evaluation_results", [])
        for res in eval_results:
            trial_info = res.get("trial", {})
            eval_info = res.get("evaluation", {})
            print(f"\nTrial NCT ID: {trial_info.get('nct_id')} - Title: {trial_info.get('title')}")
            print(f"  Status: {eval_info.get('status')}")
            print(f"  Reason: {eval_info.get('reason')}")
            print(f"  Key Patient Terms: {eval_info.get('key_patient_terms')}")
            print(f"  Key Trial Terms: {eval_info.get('key_trial_terms')}")
            
        print("\n=== Action Plan / Task List ===")
        tasks = state.get("task_list", [])
        for idx, task in enumerate(tasks):
            print(f"  {idx+1}. {task}")
            
    elif status == "error":
        print("\nPipeline failed with error.")
    else:
        print(f"\nPipeline finished with status: {status}")

if __name__ == "__main__":
    main()
