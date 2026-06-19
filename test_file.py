import requests
import json
import sys
import time

url = "http://localhost:8000/upload"
file_path = "/home/dhruvi/OrphanLink/Invitae - SR272_Invitae_Sample_Report_BRCA2_Positive.pdf"

print("Uploading file...", flush=True)
with open(file_path, "rb") as f:
    r = requests.post(url, files={"file": f}, timeout=10)
    
print("Status Code:", r.status_code, flush=True)
data = r.json()
print("Data:", json.dumps(data, indent=2), flush=True)

if "job_id" in data:
    job_id = data["job_id"]
    
    quiz = data.get("quiz_questions", [])
    answers = {}
    for q in quiz:
        answers[q] = "45"
        
    print("\nSubmitting quiz...", flush=True)
    r2 = requests.post("http://localhost:8000/submit-quiz", json={"job_id": job_id, "answers": answers})
    print("Submit Status Code:", r2.status_code, flush=True)
    
    print("\nStreaming events...", flush=True)
    stream_url = f"http://localhost:8000/stream/{job_id}"
    with requests.get(stream_url, stream=True) as r3:
        for chunk in r3.iter_content(chunk_size=1024):
            if chunk:
                sys.stdout.buffer.write(chunk)
                sys.stdout.buffer.flush()
