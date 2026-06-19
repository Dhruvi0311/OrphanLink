import requests

url = "http://localhost:8000/upload"
files = {'file': open('/home/dhruvi/OrphanLink/chronic-lymphocytic-leukemia-cll-sample-report-foundationone-heme.pdf', 'rb')}
r = requests.post(url, files=files)
print(r.json())
