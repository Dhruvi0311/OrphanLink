import requests

url = "http://localhost:8000/submit-quiz"
data = {"job_id": "d6097138-c137-477c-80ba-060e38e3eb87", "answers": {"What is your current age?": "45"}}
r = requests.post(url, json=data)
print(r.json())

stream_url = f"http://localhost:8000/stream/d6097138-c137-477c-80ba-060e38e3eb87"
response = requests.get(stream_url, stream=True)
for line in response.iter_lines():
    if line:
        print(line.decode('utf-8'))
