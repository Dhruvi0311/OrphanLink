import requests
import json

url = "http://localhost:8000/upload"
file_path = "/home/dhruvi/OrphanLink/Invitae - SR272_Invitae_Sample_Report_BRCA2_Positive.pdf"

print("Uploading file...")
with open(file_path, "rb") as f:
    r = requests.post(url, files={"file": f})
    
print("Status Code:", r.status_code)
try:
    data = r.json()
    print(json.dumps(data, indent=2))
    
    if "job_id" in data:
        job_id = data["job_id"]
        # Now let's try to submit dummy answers to the quiz
        quiz = data.get("quiz_questions", [])
        answers = {}
        for q in quiz:
            answers[q] = "45" # Just a generic answer for testing
            
        print("\nSubmitting quiz with answers:", answers)
        submit_url = "http://localhost:8000/submit-quiz"
        r2 = requests.post(submit_url, json={"job_id": job_id, "answers": answers})
        print("Submit Status Code:", r2.status_code)
        
        # We need to wait for processing to finish and get stream events
        print("\nStreaming events...")
        stream_url = f"http://localhost:8000/stream/{job_id}"
        r3 = requests.get(stream_url, stream=True)
        for line in r3.iter_lines():
            if line:
                print(line.decode('utf-8'))
        
except Exception as e:
    print("Error parsing response:", e)
    print(r.text)
