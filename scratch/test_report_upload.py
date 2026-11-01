import requests
import json
import time

report_path = "sample_documents/verified_matching_oncology_report.txt"
with open(report_path, "r", encoding="utf-8") as f:
    content = f.read()

files = {'file': ('verified_matching_oncology_report.txt', content.encode('utf-8'), 'text/plain')}
res = requests.post('http://127.0.0.1:8000/upload', files=files)
data = res.json()
job_id = data.get('job_id')
print(f'Uploaded successfully! Job ID: {job_id}')

# Poll job endpoint until completed
start_time = time.time()
while time.time() - start_time < 120:
    res = requests.get(f'http://127.0.0.1:8000/job/{job_id}')
    if res.status_code == 200:
        job_data = res.json()
        status = job_data.get('status')
        print(f"Polling status: {status} (elapsed: {int(time.time() - start_time)}s)")
        if status in ['completed', 'waiting_for_input', 'failed']:
            state = job_data.get('state', {})
            results = state.get('evaluation_results', [])
            print(f"\n==========================================")
            print(f"TOTAL EVALUATED TRIALS: {len(results)}")
            print(f"==========================================")
            for r in results:
                t = r['trial']
                ev = r['evaluation']
                match_status = ev.get('status')
                title = str(t.get('title', ''))
                reason = str(ev.get('reason', ''))
                print(f"\n>>> TRIAL: {t.get('nct_id')}")
                print(f"    Match Status: {match_status}")
                print(f"    Recruitment: {t.get('recruitment_status')}")
                print(f"    Indian Site: {t.get('has_indian_site')}")
                print(f"    Title: {title}")
                print(f"    Reason: {reason}")
            break
    time.sleep(4)
