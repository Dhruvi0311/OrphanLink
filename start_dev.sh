#!/bin/bash
export PATH=/home/dhruvi/node-v20.12.2-linux-x64/bin:$PATH

echo "Starting FastAPI Backend..."
cd backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd ..

echo "Starting Next.js Frontend..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo "Starting Localtunnel (exposing backend for Vercel/External testing)..."
npx -y localtunnel --port 8000 > tunnel.log 2>&1 &
TUNNEL_PID=$!

echo "========================================="
echo "🚀 Development environment started!"
echo "Backend API:  http://localhost:8000"
echo "Frontend UI:  http://localhost:3000"
echo "========================================="
echo ""
echo "To find your secure tunnel URL for the backend, check tunnel.log:"
echo "cat tunnel.log"
echo ""
echo "Press Ctrl+C to stop all services."

trap "echo 'Stopping all services...'; kill $BACKEND_PID $FRONTEND_PID $TUNNEL_PID; exit" INT TERM EXIT
wait
