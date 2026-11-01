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
print('Uploaded! Job ID:', job_id)

stream_url = f'http://127.0.0.1:8000/stream/{job_id}'
resp = requests.get(stream_url, stream=True, timeout=120)
for line in resp.iter_lines():
    if line:
        decoded = line.decode('utf-8')
        if 'data:' in decoded:
            raw_json = decoded[len('data:'):].strip()
            try:
                payload = json.loads(raw_json)
                evt = payload.get('event')
                if evt:
                    print('Event:', evt)
                if evt == 'completed':
                    state = payload.get('state', {})
                    results = state.get('evaluation_results', [])
                    print(f'Total Evaluated Trials: {len(results)}')
                    for r in results:
                        t = r['trial']
                        ev = r['evaluation']
                        print(f"=== NCT ID: {t.get('nct_id')} | Status: {ev.get('status')} ===")
                        print(f"Title: {t.get('title')}")
                        print(f"Reason: {ev.get('reason')}")
                    break
                elif evt == 'quiz_required':
                    print('Quiz required:', payload.get('questions'))
                    break
            except Exception:
                pass
