import os
import time
import re
from dotenv import load_dotenv
from langchain_groq import ChatGroq

load_dotenv()

class RobustChatModel:
    def __init__(self, model):
        self.model = model

    def invoke(self, *args, **kwargs):
        retries = 6
        for attempt in range(retries):
            try:
                return self.model.invoke(*args, **kwargs)
            except Exception as e:
                err_str = str(e)
                if "429" in err_str or "rate limit" in err_str.lower() or "limit" in err_str.lower():
                    sleep_time = 18.0
                    match = re.search(r"try again in ([\d\.]+)s", err_str)
                    if match:
                        sleep_time = float(match.group(1)) + 1.5
                    # Also print or log the wait
                    print(f"\n[RobustChatModel] Rate limit hit (Attempt {attempt+1}/{retries}). Sleeping for {sleep_time:.2f}s...", flush=True)
                    time.sleep(sleep_time)
                else:
                    raise e
        return self.model.invoke(*args, **kwargs)

def get_llama3_llm():
    """
    Initializes the Llama 3 8B Instruct model using Groq API with robust retry mechanism.
    Requires GROQ_API_KEY to be set in the environment.
    """
    groq_api_key = os.environ.get("GROQ_API_KEY")
    if not groq_api_key or groq_api_key == "your_groq_api_key_here":
        print("WARNING: GROQ_API_KEY is not set. API calls may fail unless local execution is configured.")

    chat_model = ChatGroq(
        model="llama-3.1-8b-instant",
        temperature=0.0,
        api_key=groq_api_key
    )
    
    return RobustChatModel(chat_model)

if __name__ == "__main__":
    # Test initialization
    model = get_llama3_llm()
    print("Robust Llama-3 LLM wrapper (via Groq) initialized successfully.")
