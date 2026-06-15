1. Frontend: The "Control Center" Interface (₹0)
Framework: Next.js 15 (App Router) + React

Styling: Tailwind CSS + shadcn/ui

Deployment: Vercel (Hobby Tier)

Why it’s Zero Cost: Vercel’s Hobby tier is completely free forever, does not require a credit card, and easily hosts Next.js applications. shadcn/ui and Tailwind are open-source and run locally in your build.

2. Backend & AI Orchestration (₹0)
API Framework: FastAPI (Python 3.12+)

Agentic Framework: LangGraph

LLM: meta-llama/Meta-Llama-3-8B-Instruct (via Hugging Face Serverless Inference API)

Why it’s Zero Cost: You can use a free Hugging Face token to call the Serverless Inference API. Using Langchain's ChatHuggingFace wrapper, it drops right into your existing routing and rewriter logic.

⚠️ Critical Llama Architecture Warning: Llama 3 (8B) has an 8,000 token context window, whereas Gemini has 1M+. You cannot feed an entire 50-page PDF into Llama 3 at once. This means your document_chunker.py and reranker.py are now the most vital parts of your system. You must ensure your hybrid search pulls only the absolute most relevant top 3 chunks to fit within Llama's context window before running the Evaluator Agent.

3. Database Layer: Hybrid Retrieval (₹0)
Vector Store: ChromaDB (Running Locally)

Sparse Store: Rank-BM25 (Serialized Pickle)

Why it’s Zero Cost: You drop external database SaaS entirely. ChromaDB saves directly to your local file system as SQLite/Parquet files, and BM25 saves as a local .pkl file. There are no cloud storage limits, no API costs, and it runs using your machine's RAM.

4. Authentication (₹0)
Provider: NextAuth.js (Auth.js)

Why it’s Zero Cost: While Clerk has a free tier, NextAuth.js is 100% open-source. It handles session management natively within your Next.js application without relying on an external SaaS provider. You can set it up to use a simple hardcoded "Demo Admin" credential for the hackathon presentation, costing nothing and requiring zero external setup.

5. Deployment & DevOps: The "Hackathon Tunnel" Strategy (₹0)
Frontend Hosting: Vercel (Free)

Backend Hosting: Localhost + Cloudflare Tunnels (or Ngrok)

Why it’s Zero Cost: Do not deploy your FastAPI backend to Render or Heroku. Free cloud servers "sleep" after 15 minutes of inactivity, causing a 50-second delay on the first request, which will ruin a live pitch.

The Execution: Run the FastAPI backend and ChromaDB directly on your laptop during the hackathon. Use a free Cloudflare Tunnel (or the free tier of Ngrok) to generate a secure https://... URL that points to your laptop's localhost:8000. You paste this Tunnel URL into your Vercel Next.js frontend as the API base URL.

The Result: The judges access your public Vercel website from their phones or laptops, but all the heavy LangGraph routing, Hugging Face API calls, and ChromaDB queries execute using your laptop's CPU. Zero hosting costs, zero cold-starts, zero latency.

The Zero-Rupee Integration Flow
The judge logs into the Vercel-hosted Next.js UI using a mock NextAuth credential.

The UI sends the PDF to your Ngrok/Cloudflare URL, routing directly to your laptop's FastAPI server.

LangGraph (running on your laptop) chunks the document, queries your local ChromaDB, and makes a free API call to Hugging Face (Llama 3).

FastAPI streams the LangGraph execution logs back through the tunnel to the Next.js UI via Server-Sent Events (SSE).