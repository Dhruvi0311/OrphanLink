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
                    print(f"\n[RobustChatModel] Rate limit hit (Attempt {attempt+1}/{retries}). Sleeping for {sleep_time:.2f}s... Details: {err_str}", flush=True)
                    time.sleep(sleep_time)
                else:
                    raise e
        return self.model.invoke(*args, **kwargs)

def get_llama3_llm(json_mode: bool = False, max_tokens: int = None):
    """
    Initializes the high-performance model using Groq API with robust retry mechanism.
    Supports native JSON object mode for sub-second deterministic responses.
    """
    groq_api_key = os.environ.get("GROQ_API_KEY") or os.environ.get("groq_api_key")
    if not groq_api_key or groq_api_key == "your_groq_api_key_here":
        print("WARNING: GROQ_API_KEY is not set. API calls may fail unless local execution is configured.")

    default_models = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"]
    preferred_model = os.environ.get("GROQ_MODEL")
    if preferred_model and preferred_model not in default_models:
        model_list = [preferred_model] + default_models
    else:
        model_list = default_models

    model_kwargs = {}
    if json_mode:
        model_kwargs["response_format"] = {"type": "json_object"}

    class MultiModelChatWrapper:
        def __init__(self, models, api_key, max_tokens, model_kwargs):
            self.models = models
            self.api_key = api_key
            self.max_tokens = max_tokens
            self.model_kwargs = model_kwargs

        def invoke(self, *args, **kwargs):
            last_err = None
            for attempt in range(3):
                for m_name in self.models:
                    try:
                        # Reasoning models like gpt-oss need a higher token budget for internal reasoning + JSON
                        tokens = max(self.max_tokens or 2500, 2500) if "gpt-oss" in m_name else self.max_tokens
                        chat_model = ChatGroq(
                            model=m_name,
                            temperature=0.0,
                            api_key=self.api_key,
                            max_tokens=tokens,
                            model_kwargs=self.model_kwargs
                        )
                        return chat_model.invoke(*args, **kwargs)
                    except Exception as e:
                        last_err = e
                        err_str = str(e)
                        if "429" in err_str or "rate limit" in err_str.lower() or "limit" in err_str.lower():
                            print(f"[MultiModelWrapper] Model {m_name} hit rate limit, backing off 2s...", flush=True)
                            time.sleep(2.0)
                            continue
                        elif "json_validate_failed" in err_str or "badrequesterror" in err_str.lower():
                            print(f"[MultiModelWrapper] Model {m_name} JSON format issue, attempting next model...", flush=True)
                            continue
                        else:
                            raise e
            raise last_err

    return MultiModelChatWrapper(model_list, groq_api_key, max_tokens, model_kwargs)

if __name__ == "__main__":
    # Test initialization
    model = get_llama3_llm()
    print("Robust Llama-3 LLM wrapper (via Groq) initialized successfully.")
