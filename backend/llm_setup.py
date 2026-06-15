import os
from dotenv import load_dotenv
from langchain_huggingface import ChatHuggingFace, HuggingFaceEndpoint

load_dotenv()

def get_llama3_llm():
    """
    Initializes the Llama 3 8B Instruct model using Hugging Face Serverless Inference API.
    Requires HUGGINGFACEHUB_API_TOKEN to be set in the environment.
    """
    hf_token = os.environ.get("HUGGINGFACEHUB_API_TOKEN")
    if not hf_token:
        print("WARNING: HUGGINGFACEHUB_API_TOKEN is not set. API calls may fail unless local execution is configured.")

    llm = HuggingFaceEndpoint(
        repo_id="meta-llama/Meta-Llama-3-8B-Instruct",
        task="text-generation",
        max_new_tokens=1024,
        do_sample=False,
    )
    
    chat_model = ChatHuggingFace(llm=llm)
    return chat_model

if __name__ == "__main__":
    # Test initialization
    model = get_llama3_llm()
    print("Llama-3 LLM wrapper initialized successfully.")
