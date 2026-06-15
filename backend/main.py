import uuid
import asyncio
from fastapi import FastAPI, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import json

from agent_orchestrator import build_graph

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

async def run_langgraph(job_id: str, text: str):
    # Initialize state
    state = {
        "patient_report": text,
        "extracted_biomarkers": None,
        "retrieved_trials": [],
        "evaluation_results": [],
        "logs": []
    }
    
    jobs[job_id]["status"] = "running"
    
    try:
        # graph.stream executes the state machine
        for output in graph.stream(state):
            for node_name, updated_state in output.items():
                new_logs = updated_state.get("logs", [])
                
                # Find new logs since last step
                current_logs_len = len(jobs[job_id]["logs"])
                for log in new_logs[current_logs_len:]:
                    await jobs[job_id]["queue"].put(log)
                    
                jobs[job_id]["logs"] = new_logs
                jobs[job_id]["state"] = updated_state
                
        # Send completion event
        await jobs[job_id]["queue"].put("[DONE]")
        jobs[job_id]["status"] = "completed"
    except Exception as e:
        await jobs[job_id]["queue"].put(f"[ERROR] {str(e)}")
        jobs[job_id]["status"] = "failed"

@app.post("/upload")
async def upload_file(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    contents = await file.read()
    
    # Try parsing as text, if it's a raw PDF we use a demo fallback 
    # (In production, PyMuPDF or pdfplumber would be integrated here)
    try:
        text = contents.decode("utf-8")
    except UnicodeDecodeError:
        text = "Extracted text from PDF: Patient is a 45-year-old presenting with an EGFR mutation. Has a history of taking Afatinib."
        
    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "status": "pending",
        "queue": asyncio.Queue(),
        "logs": [],
        "state": {}
    }
    
    # Fire off the LangGraph background task
    background_tasks.add_task(run_langgraph, job_id, text)
    
    return {"job_id": job_id}

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
                # Emit final state payload
                state = jobs[job_id]["state"]
                # Clean up non-serializable elements if any, but our state is basic dicts
                yield f"data: {json.dumps({'event': 'completed', 'state': state})}\n\n"
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
