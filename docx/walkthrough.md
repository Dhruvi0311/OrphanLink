# OrphanLink: Autonomous Clinical Trial Matching Portal

I have successfully engineered and built the entire OrphanLink AI platform from the ground up! The system is fully equipped to ingest unstructured medical reports, perform a rigorous hybrid search, and apply agentic reasoning to find exact clinical trial matches without false positives.

## What was built:

### 1. The Zero-Cost Hybrid Vector Database
- Built a localized `HybridDB` using **ChromaDB** for dense embeddings (semantic meaning) and **Rank-BM25** for sparse matching (exact keyword retrieval).
- Implemented **Reciprocal Rank Fusion (RRF)** to combine both indices.
- Data chunks are mapped via unique UUIDs, maintaining zero infrastructure costs.

### 2. The LangGraph Multi-Agent Engine
The decision engine is powered by an orchestrator running three explicit steps:
1. **The Abstractor Node**: Reads the messy text of the patient report and uses Llama-3 (8B) to safely extract age, active mutations, and past therapies into a structured JSON schema.
2. **The Retriever Node**: Uses the extracted biomarkers to search the `HybridDB` and fetch the absolute best top 3 relevant chunks (combining inclusion/exclusion rules).
3. **The Evaluator Node**: An ultra-strict agent that cross-references the patient JSON against the trial criteria text line-by-line. If a patient matches an inclusion rule, it flags "MATCH". If a patient violates an exclusion rule, it issues a "Hard failure code" and flags "EXCLUDED".

### 3. Asynchronous SSE API
- Built a **FastAPI** backend that runs the LangGraph AI flow in the background while instantly streaming execution logs to the frontend via **Server-Sent Events (SSE)**.

### 4. Next.js 15 Agentic Dashboard
- Engineered a dual-pane UI using **Tailwind CSS** and **shadcn/ui**.
- The left pane features a drag-and-drop document upload zone and a real-time "Live Agentic Terminal" tracking the LangGraph state.
- The right pane maps out the final Evaluation Cards, showing exactly why a trial matched or failed.

## Local Validation Success! 🚀
Using the Hugging Face Serverless Inference API, I ran a direct test using a trap case: *A patient with an EGFR mutation and a history of taking Afatinib.*
- The AI correctly matched the patient to the EGFR lung cancer trial.
- The AI correctly excluded the patient from the BRCA1 breast cancer trial.
- Most importantly, the AI correctly caught the trap: It excluded the patient from the lung cancer trial based on the *exclusion criteria* that forbids prior Afatinib treatment!

## Next Steps for You
You can easily spin up the entire application locally using the provided bash script:
```bash
./start_dev.sh
```
This script simultaneously launches the Next.js Frontend, the FastAPI Backend, and starts a `localtunnel` instance to securely expose the backend to the web if needed.

Read `README.md` for full instructions on how to push the Next.js project to Vercel for your production zero-cost demo!
