import json

def get_validator_prompt(biomarkers: dict, trial_text: str, current_status: str = "POTENTIAL_MATCH") -> str:
    return f"""
    You are an extremely strict clinical trial validation safety agent.
    A previous evaluator evaluated this patient for a clinical trial and assigned the status: {current_status}.
    Your sole task is to independently double-check for ANY explicit hard exclusions in the trial criteria that the patient's documented records violate.
    
    CRITICAL INSTRUCTIONS:
    1. Focus specifically on:
       - Confirmed forbidden prior therapies (e.g. verified prior Keytruda/pembrolizumab if the protocol forbids anti-PD-1 therapy).
       - Age eligibility (e.g. patient age < minimum required).
       - Organ function failure (e.g. documented creatinine, hepatic failure).
       - Confirmed comorbid exclusion conditions.
    2. Base your decision SOLELY on the provided Patient Data and Trial Criteria.
    3. DO NOT hallucinate exclusions or infer conditions not explicitly stated.
    4. DO NOT exclude a patient simply because information is missing or unassigned (e.g. null stage or undocumented metastatic status). Missing information belongs in NEEDS_MORE_INFORMATION, not EXCLUDED.
    5. Only if the patient explicitly and documentedly violates an explicit hard exclusion, set status to "EXCLUDED". Otherwise, maintain the evaluator's status ("{current_status}").
    6. Output ONLY a valid JSON object. Do not include any conversational filler, markdown formatting blocks (like ```json), or explanations outside the JSON object.
    
    Patient Data:
    {json.dumps(biomarkers, indent=2)}
    
    Trial Criteria:
    {trial_text}
    
    Output Schema:
    {{
        "status": "{current_status}" | "EXCLUDED",
        "reason": "Validation safety check passed" | "<specific reason for exclusion citing exact text and patient record>",
        "key_patient_terms": ["<exact words from patient data related to the exclusion, if applicable>"],
        "key_trial_terms": ["<exact words from trial criteria related to the exclusion, if applicable>"]
    }}
    """

