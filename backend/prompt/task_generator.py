import json

def get_task_generator_prompt(biomarkers: dict, matches: list) -> str:
    return f"""
    You are a helpful patient navigator. Based on the following patient biomarkers and matching clinical trials, generate a short checklist of 3 to 5 actionable next steps for the patient.
    
    CRITICAL INSTRUCTIONS:
    1. Base the tasks ONLY on the provided biomarkers and matching trials.
    2. DO NOT hallucinate trial NCT IDs, medication names, or diagnoses that are not present in the input data.
    3. Provide clear, practical steps (e.g., discussing a specific trial with their doctor, getting a specific test).
    4. Output ONLY a valid JSON list of strings. Do not include any conversational filler or markdown formatting blocks.
    
    Biomarkers: 
    {json.dumps(biomarkers, indent=2)}
    
    Matching Trials: 
    {[m['trial']['nct_id'] for m in matches]}
    
    Example output format:
    ["Discuss Afatinib eligibility with your primary oncologist.", "Request a follow-up biomarker test to confirm EGFR status.", "Review consent forms for Trial NCT01234567."]
    """
