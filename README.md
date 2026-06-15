# OrphanLink: Autonomous Clinical Trial Matching Portal

OrphanLink is an AI-powered zero-cost architecture designed to instantly match patient biomarker reports with complex ClinicalTrials.gov criteria using LangGraph agentic reasoning and Hybrid Semantic Search.

## Architecture

*   **Frontend**: Next.js 15 (App Router), React, Tailwind CSS, `shadcn/ui`.
*   **Backend**: FastAPI, LangGraph, local ChromaDB (Dense search), Rank-BM25 (Sparse keyword search), Reciprocal Rank Fusion (RRF).
*   **AI Engine**: `meta-llama/Meta-Llama-3-8B-Instruct` via the Hugging Face Serverless Inference API.

## Local Development (Testing)

1. Open the terminal and navigate to the project root:
   ```bash
   cd OrphanLink
   ```

2. Run the provided script to start the Frontend, Backend, and Localtunnel all at once:
   ```bash
   ./start_dev.sh
   ```

3. View `tunnel.log` to get your public tunnel URL (if you want to test from an external network):
   ```bash
   cat tunnel.log
   ```

4. Open the UI at `http://localhost:3000` and upload a dummy patient report!

## Deployment Guide (Zero-Cost Setup)

### 1. Backend (Self-Hosted via Tunnel)
You can run the backend continuously on an old laptop, a Raspberry Pi, or any local machine with an internet connection.
- Ensure the backend is running (`uvicorn main:app --host 0.0.0.0 --port 8000`).
- Ensure `npx localtunnel --port 8000` is running. This gives you a secure `https://<random>.loca.lt` URL.

### 2. Frontend (Vercel Hobby Tier)
1. Commit this codebase to a GitHub repository.
2. Sign in to Vercel and import the GitHub repository.
3. Set the Root Directory to `frontend`.
4. In the Environment Variables section in Vercel, add:
   *   `NEXT_PUBLIC_API_URL` = `<Your Localtunnel URL>` (If you want the Next.js app to talk directly to your home server). Note: You may need to update `dashboard-client.tsx` to point to `process.env.NEXT_PUBLIC_API_URL` instead of `http://localhost:8000` for production.

### Note on API Limits
This demo utilizes the Hugging Face Serverless Inference API which is free but subject to rate limits. For heavy use, deploy the model on a dedicated endpoint or swap the `llm_setup.py` config to use Groq/TogetherAI.
