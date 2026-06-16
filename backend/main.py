import uuid
import asyncio
from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import json
from pydantic import BaseModel
from typing import Dict

from agent_orchestrator import build_graph
from file_parser import parse_file
from report_generator import create_clinical_report

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store for jobs
jobs = {}
graph = build_graph()

async def run_langgraph(job_id: str, state: dict):
    jobs[job_id]["status"] = "running"
    
    try:
        # graph.stream executes the state machine
        for output in graph.stream(state):
            for node_name, updated_state in output.items():
                new_logs = updated_state.get("logs", [])
                
                # Find new logs since last step
                current_logs_len = jobs[job_id].get("logs_len", 0)
                for log in new_logs[current_logs_len:]:
                    await jobs[job_id]["queue"].put(log)
                    
                jobs[job_id]["logs_len"] = len(new_logs)
                jobs[job_id]["state"] = updated_state
                
        # Check if we ended early due to quiz
        final_state = jobs[job_id].get("state", {})
        if final_state.get("quiz_questions") and not final_state.get("quiz_answers"):
            await jobs[job_id]["queue"].put("[QUIZ_REQUIRED]")
            jobs[job_id]["status"] = "waiting_for_input"
        else:
            await jobs[job_id]["queue"].put("[DONE]")
            jobs[job_id]["status"] = "completed"
            
    except Exception as e:
        await jobs[job_id]["queue"].put(f"[ERROR] {str(e)}")
        jobs[job_id]["status"] = "failed"

@app.post("/upload")
async def upload_file(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    contents = await file.read()
    
    # Parse file using robust parser
    text = parse_file(contents, file.filename)
        
    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "status": "pending",
        "queue": asyncio.Queue(),
        "logs": [],
        "state": {
            "patient_report": text,
            "extracted_biomarkers": None,
            "quiz_questions": None,
            "quiz_answers": None,
            "retrieved_trials": [],
            "evaluation_results": [],
            "task_list": None,
            "logs": []
        }
    }
    
    # Fire off the LangGraph background task
    background_tasks.add_task(run_langgraph, job_id, jobs[job_id]["state"])
    
    return {"job_id": job_id}

class QuizSubmission(BaseModel):
    job_id: str
    answers: Dict[str, str]

@app.post("/submit-quiz")
async def submit_quiz(submission: QuizSubmission, background_tasks: BackgroundTasks):
    job_id = submission.job_id
    if job_id not in jobs:
        return {"error": "Job not found"}
        
    # Update state with answers
    state = jobs[job_id]["state"]
    state["quiz_answers"] = submission.answers
    
    # Create a new queue for the next phase of the stream
    jobs[job_id]["queue"] = asyncio.Queue()
    jobs[job_id]["status"] = "resumed"
    
    # Restart the graph from the beginning with the updated state
    # (The Abstractor node uses the answers to supplement the report)
    background_tasks.add_task(run_langgraph, job_id, state)
    
    return {"status": "resumed"}

@app.post("/generate-report")
async def generate_report(request: Request):
    data = await request.json()
    biomarkers = data.get("biomarkers", {})
    trials = data.get("trials", [])
    
    pdf_buffer = create_clinical_report(biomarkers, trials)
    
    return StreamingResponse(
        pdf_buffer, 
        media_type="application/pdf", 
        headers={"Content-Disposition": "attachment; filename=OrphanLink_Clinical_Report.pdf"}
    )

@app.get("/stream/{job_id}")
async def stream_logs(job_id: str):
    """
    Streams the logs and final state using Server-Sent Events (SSE).
    """
    async def event_generator():
        if job_id not in jobs:
            yield f"data: {json.dumps({'error': 'Job not found'})}\n\n"
            return
            
        queue = jobs[job_id]["queue"]
        
        while True:
            log = await queue.get()
            if log == "[DONE]":
                state = jobs[job_id]["state"]
                yield f"data: {json.dumps({'event': 'completed', 'state': state})}\n\n"
                break
            elif log == "[QUIZ_REQUIRED]":
                state = jobs[job_id]["state"]
                yield f"data: {json.dumps({'event': 'quiz_required', 'questions': state['quiz_questions']})}\n\n"
                break
            elif log.startswith("[ERROR]"):
                yield f"data: {json.dumps({'event': 'error', 'message': log})}\n\n"
                break
            else:
                yield f"data: {json.dumps({'event': 'log', 'message': log})}\n\n"
                
    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/")
def read_root():
    return {"status": "ok", "message": "OrphanLink API is running."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
