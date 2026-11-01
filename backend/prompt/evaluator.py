import json

def get_evaluator_prompt(biomarkers: dict, trial_text: str, feedback: str = None) -> str:
    feedback_section = ""
    if feedback:
        feedback_section = f"""
    CRITICAL FEEDBACK FROM VALIDATOR:
    A previous evaluation had a contradiction flagged:
    "{feedback}"
    Please re-evaluate carefully following the 3-valued logic rules.
    """

    return f"""
    You are an expert clinical trial eligibility evaluator. Your task is to evaluate the patient's canonical clinical profile against each individual eligibility criterion in the clinical trial protocol.
    {feedback_section}
    CRITICAL 3-VALUED ELIGIBILITY LOGIC RULES:
    1. Represent EACH eligibility criterion as:
       - "MET": Explicit positive evidence exists in the patient records satisfying this criterion.
       - "NOT_MET": Explicit evidence exists in the patient records contradicting or failing this criterion (e.g. patient stage is Stage I when Stage IV is required; or protocol requires BRCA1 and patient has BRCA2).
       - "UNKNOWN": Information is missing, undocumented, null, or patient-reported requiring clinical verification.
    2. Missing/Null Patient Values MUST Produce UNKNOWN:
       - If patient `cancer_stage` is null or unassigned (e.g. from core biopsy), any stage-dependent inclusion criterion MUST be classified as "UNKNOWN", NOT "NOT_MET".
       - If `metastatic_status` is null/undocumented, any metastatic criterion MUST be classified as "UNKNOWN".
       - DO NOT infer cancer stage, metastatic status, or treatment dates.
    3. Distinguish Verified vs Patient-Reported Therapies:
       - Verified medication records (e.g. Keytruda/pembrolizumab) can trigger hard exclusions if forbidden.
       - Patient-reported therapies requiring verification (e.g. carboplatin, paclitaxel) must be classified as "UNKNOWN" if required as prior lines of therapy.
    4. Genomic Precision:
       - BRCA2 must NOT automatically be treated as BRCA1. Evaluate the actual protocol wording. If the protocol requires "BRCA1" specifically, a patient with only "BRCA2" is NOT_MET.
    5. Trial Status Classification:
       - "POTENTIAL_MATCH": Patient meets all evaluated inclusion criteria and has no violating hard exclusions.
       - "NEEDS_MORE_INFORMATION": One or more mandatory inclusion criteria are "UNKNOWN" (e.g. unassigned cancer stage, undocumented metastatic status, or unverified prior therapy), and NO explicit disqualifying condition is present.
       - "EXCLUDED": Patient has explicit documented evidence violating a hard exclusion criterion, or explicitly failing a mandatory inclusion criterion (e.g. documented stage outside required range).
    6. Exact Evidence & Provenance:
       - Preserve exact evidence snippets and source document names for each criterion decision.
    7. Targeted Follow-up Questions:
       - For any criterion evaluated as "UNKNOWN", formulate a targeted clinical question to resolve the ambiguity.
       
    Patient Data:
    {json.dumps(biomarkers, indent=2)}
    
    Trial Criteria:
    {trial_text}
    
    Output Schema (Strict JSON):
    {{
        "status": "POTENTIAL_MATCH" | "NEEDS_MORE_INFORMATION" | "EXCLUDED",
        "reason": "<clear clinical explanation summarizing the evaluation>",
        "criteria_evaluations": [
            {{
                "criterion_type": "inclusion" | "exclusion",
                "criterion_text": "<exact criterion text from protocol>",
                "status": "MET" | "NOT_MET" | "UNKNOWN",
                "evidence_snippet": "<exact quote from patient data or 'Not documented'>",
                "source_document": "<source document name, e.g. Pathology Report, Oncology Consultation Summary>",
                "reasoning": "<clinical explanation for this criterion decision>"
            }}
        ],
        "missing_information_questions": [
            "<targeted follow-up question for unknown criteria>"
        ],
        "key_patient_terms": ["<terms from patient data>"],
        "key_trial_terms": ["<terms from trial criteria>"]
    }}
    """

