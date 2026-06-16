import os
import subprocess
import sys
import platform
import time
import signal

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    
    # 1. Backend
    backend_dir = os.path.join(root_dir, "backend")
    if platform.system() == "Windows":
        python_executable = os.path.join(backend_dir, "venv", "Scripts", "python.exe")
    else:
        python_executable = os.path.join(backend_dir, "venv", "bin", "python")
        
    if not os.path.exists(python_executable):
        print(f"Warning: Virtual environment python not found at {python_executable}")
        print("Falling back to system python.")
        python_executable = sys.executable

    uvicorn_cmd = [python_executable, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
    
    print("Starting FastAPI Backend...")
    backend_process = subprocess.Popen(uvicorn_cmd, cwd=backend_dir)
    
    # 2. Frontend
    frontend_dir = os.path.join(root_dir, "frontend")
    print("Starting Next.js Frontend...")
    npm_cmd = "npm.cmd" if platform.system() == "Windows" else "npm"
    frontend_process = subprocess.Popen([npm_cmd, "run", "dev"], cwd=frontend_dir)
    
    # 3. Localtunnel
    print("Starting Localtunnel (exposing backend for Vercel/External testing)...")
    npx_cmd = "npx.cmd" if platform.system() == "Windows" else "npx"
    tunnel_log_path = os.path.join(root_dir, "tunnel.log")
    tunnel_log = open(tunnel_log_path, "w")
    tunnel_process = subprocess.Popen(
        [npx_cmd, "-y", "localtunnel", "--port", "8000"],
        cwd=root_dir,
        stdout=tunnel_log,
        stderr=subprocess.STDOUT
    )
    
    print("=========================================")
    print("🚀 Development environment started!")
    print("Backend API:  http://localhost:8000")
    print("Frontend UI:  http://localhost:3000")
    print("=========================================")
    print("")
    print("To find your secure tunnel URL for the backend, check tunnel.log:")
    if platform.system() == "Windows":
        print("type tunnel.log")
    else:
        print("cat tunnel.log")
    print("")
    print("Press Ctrl+C to stop all services.")
    
    def cleanup(signum, frame):
        print("\nStopping all services...")
        backend_process.terminate()
        frontend_process.terminate()
        tunnel_process.terminate()
        tunnel_log.close()
        sys.exit(0)
        
    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        cleanup(None, None)

if __name__ == "__main__":
    main()
