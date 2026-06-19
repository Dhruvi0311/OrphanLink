import uuid
import asyncio
from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import json
from pydantic import BaseModel
from typing import Dict, List, Optional

from agent_orchestrator import build_graph
from file_parser import parse_file
from report_generator import create_clinical_report
from llm_setup import get_llama3_llm
from langchain_core.messages import HumanMessage

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
            "chat_history": [],
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

class ChatInit(BaseModel):
    message: str

@app.post("/chat")
async def start_chat(chat_init: ChatInit, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "status": "pending",
        "queue": asyncio.Queue(),
        "logs": [],
        "state": {
            "patient_report": "",
            "chat_history": [{"role": "user", "content": chat_init.message}],
            "extracted_biomarkers": None,
            "quiz_questions": None,
            "quiz_answers": None,
            "retrieved_trials": [],
            "evaluation_results": [],
            "task_list": None,
            "logs": []
        }
    }
    background_tasks.add_task(run_langgraph, job_id, jobs[job_id]["state"])
    return {"job_id": job_id}

class ChatReply(BaseModel):
    job_id: str
    message: str

@app.post("/chat-reply")
async def chat_reply(reply: ChatReply, background_tasks: BackgroundTasks):
    job_id = reply.job_id
    if job_id not in jobs:
        return {"error": "Job not found"}
        
    state = jobs[job_id]["state"]
    if "chat_history" not in state:
        state["chat_history"] = []
        
    if state.get("quiz_questions"):
        # Append AI question to history
        q = state["quiz_questions"][0] if len(state["quiz_questions"]) > 0 else "What else can you tell me?"
        state["chat_history"].append({"role": "assistant", "content": q})
        state["quiz_questions"] = None
        
    state["chat_history"].append({"role": "user", "content": reply.message})
    
    jobs[job_id]["queue"] = asyncio.Queue()
    jobs[job_id]["status"] = "resumed"
    
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

class ChatResultsRequest(BaseModel):
    biomarkers: Optional[dict] = None
    results: Optional[List[dict]] = None
    task_list: Optional[List[str]] = None
    message: str
    history: List[dict] = []

@app.post("/chat-results")
async def chat_results(req: ChatResultsRequest):
    biomarkers_summary = ""
    if req.biomarkers:
        age = req.biomarkers.get("age", "Unknown")
        mutations = ", ".join(req.biomarkers.get("active_mutations", [])) or "None"
        therapies = ", ".join(req.biomarkers.get("past_therapies", [])) or "None"
        glossary = json.dumps(req.biomarkers.get("medical_terms_glossary", {}), indent=2)
        biomarkers_summary = (
            f"Patient Age: {age}\n"
            f"Active Mutations / Biomarkers: {mutations}\n"
            f"Past / Current Therapies: {therapies}\n"
            f"Medical Terms Glossary: {glossary}"
        )
    else:
        biomarkers_summary = "No patient biomarker data available."

    trials_summary = ""
    if req.results:
        summary_lines = []
        for i, res in enumerate(req.results):
            trial = res.get("trial", {})
            eval_res = res.get("evaluation", {})
            title = trial.get("title", "Unknown Title")
            nct_id = trial.get("nct_id", "Unknown NCTID")
            status = eval_res.get("status", "Unknown Status")
            reason = eval_res.get("reason", "No evaluation details provided.")
            summary_lines.append(
                f"Trial #{i+1}: {title} ({nct_id})\n"
                f"Match Status: {status}\n"
                f"Evaluation Reason: {reason}\n"
            )
        trials_summary = "\n".join(summary_lines)
    else:
        trials_summary = "No clinical trials matching results available."

    actions_summary = ""
    if req.task_list:
        actions_summary = "\n".join(f"- {task}" for task in req.task_list)
    else:
        actions_summary = "No patient action items available."

    formatted_history = ""
    for msg in req.history:
        role = msg.get("role", "user").upper()
        content = msg.get("content", "")
        formatted_history += f"{role}: {content}\n"

    prompt = f"""
You are the "OrphanLink Clinical Trial Assistant", an expert AI assistant specializing in explaining the clinical trial matching results, biomarkers, and clinical terminology for patients.
Your goal is to answer questions about the patient's matched or excluded trials, medical terms in their profile, and the next steps/actions they should take.

Here is the patient's clinical context:
=== Patient Biomarkers ===
{{biomarkers_summary}}

=== Trial Match Results ===
{{trials_summary}}

=== Patient Action Plan ===
{{actions_summary}}
=========================

Here is the conversation history:
{{formatted_history}}

Latest User Message: {{req.message}}

CRITICAL CONTEXT & GUARDRAILS:
1. **Project & Health Scope Gating**: Your knowledge is strictly limited to the OrphanLink project, the patient's specific trial match results, medical terms present in their profile, and their recommended action plan. If the user asks about unrelated topics (e.g. general questions, programming, cooking, history, medical advice unrelated to their matched trials, diagnosis of other conditions, or general knowledge), you MUST politely decline to answer, explaining that you are limited to explaining their OrphanLink clinical trial matching results, terms, and action plan. Keep the user focused on the clinical trial results.
2. **Explain terms contextually**: If the user asks about the meaning of medical terms, use the patient's biomarkers or glossary to explain it in simple, patient-friendly language.
3. **Tone**: Be professional, empathetic, clear, and reassuring, but remain scientifically accurate.
4. **No Hallucinations**: Only discuss trials that were actually evaluated in the results. If asked about a trial or mutation not in the results, state that it was not part of the matching process.

Provide a clear and concise response in markdown.
Response:"""

    # Format the prompt using standard format
    formatted_prompt = prompt.format(
        biomarkers_summary=biomarkers_summary,
        trials_summary=trials_summary,
        actions_summary=actions_summary,
        formatted_history=formatted_history,
        req=req
    )

    try:
        llm = get_llama3_llm()
        response = llm.invoke([HumanMessage(content=formatted_prompt)])
        return {"response": response.content}
    except Exception as e:
        return {"response": f"I encountered an error while processing your request: {str(e)}"}

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
                yield f"data: {json.dumps({'event': 'quiz_required', 'questions': state['quiz_questions'], 'biomarkers': state['extracted_biomarkers']})}\n\n"
                break
            elif log.startswith("[ERROR]"):
                yield f"data: {json.dumps({'event': 'error', 'message': log})}\n\n"
                break
            else:
                yield f"data: {json.dumps({'event': 'log', 'message': log})}\n\n"
                
    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/job/{job_id}")
def get_job(job_id: str):
    if job_id not in jobs:
        return {"error": "Job not found"}
    job_info = jobs[job_id].copy()
    if "queue" in job_info:
        del job_info["queue"]
    # Exclude raw patient_report to keep output concise
    state_copy = job_info.get("state", {}).copy()
    if "patient_report" in state_copy:
        del state_copy["patient_report"]
    return {
        "status": job_info.get("status"),
        "logs_len": job_info.get("logs_len"),
        "state": state_copy
    }

@app.get("/")
def read_root():
    return {"status": "ok", "message": "OrphanLink API is running."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
