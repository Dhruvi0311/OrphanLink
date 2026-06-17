# OrphanLink: Autonomous Clinical Trial Matching Portal

OrphanLink is an AI-powered architecture designed to seamlessly match patient biomarker reports with complex ClinicalTrials.gov criteria. It leverages LangGraph agentic reasoning, multimodal file parsing, dynamic API integrations, and Hybrid Semantic Search to provide a fully automated, interactive patient experience.

## ✨ Key Features & Updates

### 1. Dynamic File Parsing & OCR
Users can upload their lab reports or medical records in multiple formats (PDF, JSON, TXT).
- **Digital PDFs**: Extracted near-instantly using PyMuPDF.
- **Scanned PDFs**: Automatically detects if a PDF is an image scan (based on low text content) and intelligently falls back to optical character recognition (OCR) using `pdf2image` and `pytesseract`.
- **JSON / TXT**: Safely parses and formats standard text or JSON reports.

### 2. Strict, Hallucination-Free Agentic Orchestrator
The core logic is driven by a LangGraph state-machine workflow orchestrating specialized AI "Agents" powered by Llama 3. The prompts for these agents have been modularized and strictly engineered to prevent hallucinations:
- **Abstractor Agent**: Analyzes the raw patient report and strictly extracts specific biomarkers (e.g., age, active genetic mutations, past therapies) into a structured JSON schema, omitting unmentioned data.
- **Evaluator Agent**: Acts as a strict clinical trial evaluator. It cross-references the patient's exact extracted data against complex Inclusion/Exclusion criteria and generates a clear "MATCH" or "EXCLUDED" status, providing exact text quotes as evidence.
- **Validator Agent**: An explicit validation node that double-checks any "MATCH" declared by the Evaluator. If it catches a contradiction (e.g., a hard exclusion that was missed), it sends the critique back to the Evaluator in a cyclic loop for self-correction, preventing hallucinated matches.

### 3. Interactive Medical Quiz (Missing Data Handling)
If the patient uploads an incomplete report, the workflow does not blindly guess or fail. 
- A specialized **Quiz Generator Agent** detects missing critical fields (like age or mutation status).
- It pauses the workflow and dynamically generates plain-English questions for the patient.
- The UI triggers an interactive form ("Missing Information Detected").
- Once the user answers, the workflow seamlessly resumes, appending the new data to the context.

### 4. Biomarker Entity Linking (Standardization)
To ensure accurate trial matching, raw extracted medical terms (like drug brand names or mutation aliases) are standardized using public APIs before searching:
- **Therapies**: Connects to the **RxNorm API** to resolve brand names (e.g., "Tagrisso", "Advil") to their exact active scientific ingredients.
- **Mutations**: Connects to the **MyGene.info API** to standardize mutation descriptions into official gene symbols.

### 5. Dynamic ClinicalTrials.gov Integration
OrphanLink does not rely on a static or hardcoded database.
- The **Retriever Agent** takes the patient's standardized mutations and therapies and dynamically calls the official **ClinicalTrials.gov V2 API**.
- It fetches the latest active clinical trials in real-time, extracts their complex eligibility criteria, and chunks them.
- These criteria chunks are temporarily ingested into a local vector database (ChromaDB + BM25) to perform rapid Reciprocal Rank Fusion (RRF) matching.

### 6. Personalized Patient Action Plan
Instead of leaving the patient with just raw trial data, the workflow utilizes a **Task Generator Agent**.
- It analyzes the matched trials and the patient's profile to generate a concise, personalized "Action Plan" strictly based on grounded facts.
- This outputs 3-5 actionable next steps (e.g., "Schedule a follow-up biomarker test", "Discuss NCT01234567 consent forms with oncologist").
- Rendered in the UI as interactive checkboxes.

## 🔄 End-to-End Workflow

1. **Upload & Parse**: The user uploads a medical report. The system parses the document using text extraction or OCR.
2. **Data Abstraction (`Abstractor Node`)**: The Llama 3 model extracts key patient attributes (age, mutations, prior therapies).
3. **Completeness Check (`Quiz Generator Node`)**:
   - *If data is missing*: Pauses execution, asks the user for the missing details via UI, and waits for a response.
   - *If complete*: Proceeds to retrieval.
4. **Entity Linking (`Entity Linker Node`)**: Standardizes extracted brand-name drugs and mutation aliases to scientific terms via RxNorm and MyGene.info APIs.
5. **Trial Retrieval (`Retriever Node`)**: Fetches relevant trials dynamically from ClinicalTrials.gov based on the standardized patient keywords. Applies Hybrid Semantic Search to rank the trials.
6. **Initial Match Evaluation (`Evaluator Node`)**: AI cross-references the patient's exact data against the trial criteria to determine eligibility.
7. **Safety Validation Loop (`Validator Node`)**: A secondary AI pass strictly looks for hard exclusions. If a contradiction is found for a "MATCH", the workflow conditionally routes *back* to the Evaluator with the Validator's exact critique, enabling the Evaluator to self-correct its reasoning before moving forward.
8. **Action Plan (`Task Generator Node`)**: Generates personalized, grounded next steps for the user based on the finalized trial matches.

## 🏗️ Architecture Stack
*   **Frontend**: Next.js 15 (App Router), React, Tailwind CSS, `shadcn/ui`.
*   **Backend**: FastAPI, LangGraph, local ChromaDB (Dense search), Rank-BM25 (Sparse keyword search), Reciprocal Rank Fusion (RRF).
*   **AI Engine**: `meta-llama/Llama-3-8b-8192` via the Groq Inference API.
*   **Parsing Utilities**: PyMuPDF, pytesseract, pdf2image.
*   **Prompt Module**: Modularized, strict prompt templates under `backend/prompt/` preventing AI hallucinations.

## 🚀 Local Development (Testing)

1. **Install System Dependencies** (Required for OCR fallback):
   ```bash
   sudo apt-get update && sudo apt-get install -y tesseract-ocr poppler-utils
   ```

2. **Set up Environment Variables**:
   - Open `backend/.env` and replace `your_groq_api_key_here` with your actual Groq API key.

3. **Navigate to the project root**:
   ```bash
   cd OrphanLink
   ```

4. **Run the cross-platform Orchestrator Script**:
   This script starts the FastAPI backend, Next.js frontend, and Localtunnel concurrently.
   ```bash
   python start_dev.py
   ```

5. **Access the Portal**:
   - Open the UI locally at `http://localhost:3000`.
   - Upload a test patient report (PDF or TXT) to watch the agentic tracker stream its live reasoning process.
   - Note: You can view `tunnel.log` to get your public tunnel URL if you want to test from an external network.

## ☁️ Deployment Guide (Zero-Cost Setup)

### 1. Backend (Self-Hosted via Tunnel)
You can run the backend continuously on an old laptop, a Raspberry Pi, or any local machine.
- Ensure the backend is running (`uvicorn main:app --host 0.0.0.0 --port 8000`).
- Ensure `npx localtunnel --port 8000` is running to expose a secure `https://<random>.loca.lt` URL.

### 2. Frontend (Vercel Hobby Tier)
1. Commit this codebase to a GitHub repository.
2. Sign in to Vercel and import the GitHub repository.
3. Set the Root Directory to `frontend`.
4. In the Environment Variables section in Vercel, add:
   *   `NEXT_PUBLIC_API_URL` = `<Your Localtunnel URL>`

### Note on API Limits
This demo utilizes the Groq Inference API for lightning-fast Llama-3 execution. Ensure you have your `GROQ_API_KEY` correctly set in the backend environment.
