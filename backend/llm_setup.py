import os
from dotenv import load_dotenv
from langchain_groq import ChatGroq

load_dotenv()

def get_llama3_llm():
    """
    Initializes the Llama 3 8B Instruct model using Groq API.
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
    
    return chat_model

if __name__ == "__main__":
    # Test initialization
    model = get_llama3_llm()
    print("Llama-3 LLM wrapper (via Groq) initialized successfully.")
