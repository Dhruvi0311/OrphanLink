
# Product Requirement Document (PRD)

## Project Title: Autonomous Clinical Trial Matching Portal (Agentic RAG)

---

## 1. Executive Summary & Strategic Goals

### The Product Vision

Oncologists and genetic counselors spend hours manually cross-referencing complex patient genetic reports against 500-page trial registries (like ClinicalTrials.gov) to find experimental treatments. This product is an autonomous B2B web portal that automates this bottleneck. By dragging and dropping a patient's genetic diagnostic report into the portal, our multi-agent swarm instantly extracts the relevant biomarkers, navigates the dense exclusion criteria of global trials, and outputs a verified, hallucination-free match with exact document citations.

### Strategic Goals (Hackathon Focus)

* **Demonstrate "Absolute Contextual Fidelity":** Prove the multi-agent system can navigate nested medical logic (e.g., "patient has X, but is excluded if they took medication Y in the last 30 days") without hallucinating.
* **Visualize the "Brain" for Judges:** Provide a live, transparent "Agentic Terminal" on the frontend so technical evaluators can actively watch the LangGraph state machine route tasks, run hybrid searches, and execute validation loops.
* **Deliver a Frictionless B2B Experience:** Ensure the UI requires zero training for a medical professional to use—uploading a single PDF yields an immediate, actionable trial referral.

---

## 2. User Personas & User Stories

### Target Personas

1. **The Technical Evaluator (The Hackathon Judge):** Wants to look under the hood. They are evaluating the architecture's ability to move beyond basic RAG wrappers into true multi-step reasoning and state management.
2. **The Oncologist / Genetic Counselor (The End-User):** A busy medical professional who needs an instant, reliable answer regarding trial eligibility for their rare-disease patient without digging through dense JSON protocols.
3. **The Global Pharma Sponsor (The Beneficiary):** Trial coordinators who need high-quality, pre-qualified patient referrals that strictly adhere to their Phase II/III protocol requirements.

### User Stories

* **As a technical judge, I want to** see a live execution log on the web dashboard alongside the PDF upload **so that** I can verify exactly which trial criteria the Evaluator Agent checked and validate the underlying LangGraph routing.
* **As an oncologist using the portal, I want to** drag and drop a raw PDF diagnostic report **so that** the backend can autonomously parse the unstructured data without requiring manual data entry.
* **As a trial sponsor, I want** the system to enforce rigorous semantic and keyword checks **so that** I only receive patient matches that strictly clear all exclusion criteria.

---

## 3. Core Feature List

### The "Control Center" Web Interface (Frontend)

* **Secure Document Ingestion Zone:** A clean, drag-and-drop UI component designed to accept unstructured patient lab reports (PDF/TXT).
* **Live Agentic Terminal (The "Wow" Factor):** A side-panel log viewer that streams state updates from the backend asynchronously. It prints the exact thought process of the agents (e.g., `> EXTRACTOR_AGENT: Located BRCA1 mutation...`, `> EVALUATOR_AGENT: Cross-referencing Exclusion Criteria #4...`).
* **Verified Match Dashboard:** The final output interface that displays the successfully matched clinical trial, a generated summary of *why* the patient qualifies, and hyperlinks to the exact source clauses in the protocol document.

### The Agentic Core (Backend LangGraph State Machine)

* **EHR Biomarker Abstractor (Node 1):** Strips conversational filler from the uploaded medical report, structuring the raw text into a strict JSON schema of active genetic mutations, patient age, and past therapies.
* **Semantic Hybrid Retriever (Node 2):** A coordinated search tool running dense vector embeddings alongside sparse BM25 token matching to ensure highly specific medical acronyms (like "EGFR") trigger the correct trial protocols.
* **Rigorous Evaluator Loop (Node 3):** A deterministic reasoning agent that loops through the retrieved trial protocols line-by-line. It maps the trial's "Exclusion Criteria" against the patient's JSON schema, logging a hard failure code the moment a conflict is detected and discarding the trial.

### Data Engineering Modules

* **Clinical Protocol Parser:** A specialized data loader script designed specifically to ingest structured JSON files from ClinicalTrials.gov, ensuring that critical "Inclusion" and "Exclusion" blocks are embedded into the vector database as unbroken, highly contextualized chunks rather than randomly split text.

---

## 4. Technical Architecture

```text
+---------------------------------------------------------------------------------------+
|                               TECHNICAL ARCHITECTURE                                  |
+---------------------------------------------------------------------------------------+
|                                                                                       |
|   Web UI Dashboard      -->  FastAPI Router  -->  Background Task  -->  LangGraph     |
|   (File Upload &             (Async APIs)         (Asyncio/Queue)       State Machine |
|    Live Log Viewer)                                                                   |
|                                                                                       |
|                                                                   [ Hybrid Vector DB ]|
+---------------------------------------------------------------------------------------+

```

* **Frontend:** Streamlit (for rapid deployment of complex data dashboards and live terminal streaming) or React.
* **Backend:** FastAPI to handle asynchronous file uploads and manage long-running agentic tasks without blocking the main thread.
* **Database Layer:** ChromaDB (for dense semantic storage) paired with a serialized BM25 index to handle exact keyword matching.
* **Orchestration:** LangGraph to manage the cyclic state and routing between the Extractor, Retriever, and Evaluator nodes.

---

## 5. Success Metrics & KPIs (For the Live Demo)

| Metric Category | Target Benchmark for Demo |
| --- | --- |
| **Contextual Fidelity** | **0% False Match Rate:** The system must successfully reject a synthetic patient profile that contains a hidden "trap" (e.g., a conflicting medication) during the live demo to prove zero hallucinations. |
| **Retrieval Architecture** | Successful demonstration of Reciprocal Rank Fusion (RRF) resolving a complex medical query across both sparse and dense vector stores. |
| **Processing Turnaround** | **< 45 Seconds** from the moment the PDF is dropped into the UI to the final trial match rendering on the dashboard. |
| **UI Transparency** | **100% of major agent state changes** (Extraction, Searching, Evaluating) must print visibly to the frontend log viewer to prove backend orchestration. |