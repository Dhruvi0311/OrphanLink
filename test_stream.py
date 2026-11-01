import requests

url = "http://localhost:8000/upload"
files = {'file': open('sample_patient_report.txt', 'rb')}
r = requests.post(url, files=files)
job_id = r.json()['job_id']
print(f"Job ID: {job_id}", flush=True)

stream_url = f"http://localhost:8000/stream/{job_id}"
response = requests.get(stream_url, stream=True)
for line in response.iter_lines():
    if line:
        print(line.decode('utf-8'), flush=True)

