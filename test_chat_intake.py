import requests
import json
import sys

def main():
    chat_url = "http://localhost:8000/chat"
    reply_url = "http://localhost:8000/chat-reply"
    
    # 1. Initialize chat
    print("--- 1. Initializing Chat ---")
    r = requests.post(chat_url, json={"message": "Hi, I need help finding clinical trials."})
    if r.status_code != 200:
        print(f"Chat initialization failed: {r.status_code} {r.text}")
        return
    job_id = r.json().get("job_id")
    print(f"Chat initialized. Job ID: {job_id}\n")
    
    def listen_and_get_question(jid):
        stream_url = f"http://localhost:8000/stream/{jid}"
        print(f"[Connecting to stream for job {jid}...]")
        response = requests.get(stream_url, stream=True)
        for line in response.iter_lines():
            if not line:
                continue
            line_decoded = line.decode('utf-8')
            if line_decoded.startswith("data: "):
                data_str = line_decoded[6:]
                try:
                    data = json.loads(data_str)
                    event = data.get("event")
                    if event == "log":
                        print(f"  [Log] {data.get('message')}")
                    elif event == "quiz_required":
                        q = data.get("questions", [""])[0]
                        print(f"\n[AI Assistant]: {q}")
                        return "quiz", q
                    elif event == "completed":
                        print("\n[AI Assistant]: Done! Matches found.")
                        return "completed", data.get("state")
                    elif event == "error":
                        print(f"\n[AI Assistant error]: {data.get('message')}")
                        return "error", data.get("message")
                except Exception as e:
                    print(f"Parse error: {e}")
        return "ended", None

    # Get first question
    status, q1 = listen_and_get_question(job_id)
    if status != "quiz":
        print(f"Unexpected status: {status}")
        return
        
    # Send off-topic message to check scope restriction
    print("\n--- 2. Sending Off-Topic Message ---")
    off_topic_msg = "Can you tell me a joke?"
    print(f"[User]: {off_topic_msg}")
    r = requests.post(reply_url, json={"job_id": job_id, "message": off_topic_msg})
    print(f"Reply status: {r.status_code}")
    
    status, q_off_topic = listen_and_get_question(job_id)
    print(f"\n[AI Assistant Response to Off-Topic]: {q_off_topic}")
    
    # Send age
    print("\n--- 3. Replying with Age ---")
    age_msg = "I am 45 years old."
    print(f"[User]: {age_msg}")
    r = requests.post(reply_url, json={"job_id": job_id, "message": age_msg})
    print(f"Reply status: {r.status_code}")
    
    status, q2 = listen_and_get_question(job_id)
    if status != "quiz":
        print(f"Unexpected status: {status}")
        return
        
    # Send Yes to mutation
    print("\n--- 4. Replying to Mutation (Yes) ---")
    yes_msg = "Yes, I have genetic mutations."
    print(f"[User]: {yes_msg}")
    r = requests.post(reply_url, json={"job_id": job_id, "message": yes_msg})
    print(f"Reply status: {r.status_code}")
    
    status, q3 = listen_and_get_question(job_id)
    if status != "quiz":
        print(f"Unexpected status: {status}")
        return
        
    # Send BRCA2 mutation
    print("\n--- 5. Specifying BRCA2 Mutation ---")
    mutation_msg = "I have a BRCA2 mutation."
    print(f"[User]: {mutation_msg}")
    r = requests.post(reply_url, json={"job_id": job_id, "message": mutation_msg})
    print(f"Reply status: {r.status_code}")
    
    status, payload = listen_and_get_question(job_id)
    if status == "completed":
        print("\n--- Pipeline Completed Successfully via Chat! ---")
        print("Matches:")
        for res in payload.get("evaluation_results", []):
            trial = res.get("trial", {})
            evaluation = res.get("evaluation", {})
            print(f"- {trial.get('nct_id')} ({trial.get('title')}): {evaluation.get('status')} - {evaluation.get('reason')}")

if __name__ == "__main__":
    main()
