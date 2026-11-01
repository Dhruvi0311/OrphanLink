def get_abstractor_prompt(report: str) -> str:
    return f"""
    You are an expert clinical oncology data abstractor. Your task is to extract structured patient information from the medical report, multi-document clinical records, or patient conversation history provided below.
    
    CRITICAL INSTRUCTIONS:
    1. Base your extraction SOLELY on the provided text.
    2. DO NOT guess, infer, or extrapolate any clinical information.
       - Cancer Stage vs Metastatic Status:
         * Store `metastatic_status` SEPARATELY from formal `cancer_stage` (TNM/pathological stage).
         * If the report documents metastatic disease (e.g. "Metastatic breast cancer with measurable soft-tissue lesion in the liver") but lacks a formal TNM staging classification, record `metastatic_status` with direct evidence and set `cancer_stage` to null. DO NOT invent a formal TNM stage from metastatic evidence.
         * If the report states pathological stage is not assigned from the core biopsy alone, `cancer_stage` MUST be null.
       - ECOG Performance Status:
         * If ECOG performance status is stated (e.g. "ECOG performance status: 1"), extract `ecog_score`: 1 and `ecog_status`: "ECOG 1", and record in `facts` with the exact evidence quote.
       - Genetic Testing & Mutation Status (CRITICAL):
         * Distinguish four distinct states:
           1. Confirmed mutation detected: `genetic_testing_status` = "CONFIRMED_MUTATION", `active_mutations` = list of confirmed gene mutations (e.g. ["BRCA2"]).
           2. Confirmed negative genetic test: `genetic_testing_status` = "CONFIRMED_NEGATIVE", `active_mutations` = [].
           3. Not tested: `genetic_testing_status` = "NOT_TESTED", `active_mutations` = [].
           4. Not documented: `genetic_testing_status` = "NOT_DOCUMENTED", `active_mutations` = [].
         * NEVER infer wild-type or negative genetic status from the absence of a mutation mention. If no genetic mutation test is mentioned or documented, `genetic_testing_status` MUST be "NOT_DOCUMENTED" and `active_mutations` MUST be [].
    3. Medication & Therapy Aggregation:
       - Extract and retain medication names, regimen count, treatment setting (e.g. neoadjuvant, adjuvant, metastatic), and dates/timing when present.
       - Do not invent missing details (e.g. if the document states "Prior metastatic-setting chemotherapy: 2 regimens completed", record regimen_count: 2, setting: "Metastatic", but leave individual drug names as null/unspecified if not given).
       - Distinguish between VERIFIED MEDICATION RECORDS (prescribed, administered, or verified clinical records) and PATIENT-REPORTED THERAPIES (therapies reported by the patient that require verification against outside hospital records).
    4. Multi-Document Aggregation & Provenance:
       - Aggregate facts from ALL provided documents into the canonical profile.
       - Track each extracted fact in the `facts` array with `field`, `value`, `source_document`, `evidence_snippet`, and `confidence` (0.0 to 1.0).
    5. Output ONLY a valid JSON object. Do not include any conversational filler, markdown formatting blocks, or explanations outside the JSON object.
    
    Schema:
    {{
        "condition_or_cancer_type": <string or null, e.g. "Triple-Negative Breast Cancer", "Invasive Ductal Carcinoma", "Non-Small Cell Lung Cancer">,
        "cancer_stage": <string or null, e.g. "Stage IV", "Stage II", or null if not assigned from core biopsy or formal TNM staging undocumented>,
        "metastatic_status": <string or null, e.g. "Metastatic breast cancer with measurable soft-tissue lesion in the liver (RECIST 1.1 target lesion: 28 mm)", or null if undocumented>,
        "metastatic_sites": [<list of strings, e.g. "Liver">, empty list if undocumented],
        "age": <int or null>,
        "ecog_score": <int or null, e.g. 0, 1, 2, or null if undocumented>,
        "ecog_status": <string or null, e.g. "ECOG 1", or null if undocumented>,
        "receptor_status": {{
            "ER": <string or null, e.g. "Negative (<1%)">,
            "PR": <string or null, e.g. "Negative (<1%)">,
            "HER2": <string or null, e.g. "IHC 0 (Negative)">
        }},
        "genetic_testing_status": <string, one of "CONFIRMED_MUTATION", "CONFIRMED_NEGATIVE", "NOT_TESTED", "NOT_DOCUMENTED">,
        "genetic_testing_details": <string or null, e.g. "No genetic mutation testing documented in report" or "Confirmed germline BRCA2 pathogenic variant">,
        "active_mutations": [<list of confirmed detected mutation acronyms, e.g. "BRCA2">, empty list [] if none or not tested/documented],
        "organ_and_laboratory_function": <string or null, e.g. "Adequate bone marrow, liver, and renal function confirmed by laboratory results" or null if undocumented>,
        "prior_therapies_detailed": [
            {{
                "regimen_name": <string or null, e.g. "Keytruda" or null if unmentioned/generic>,
                "agent_class": <string or null, e.g. "Chemotherapy", "Immunotherapy", "Targeted">,
                "regimen_count": <int or null, e.g. 2>,
                "setting": <string or null, e.g. "Metastatic", "Adjuvant", "Neoadjuvant">,
                "dates_or_timing": <string or null, e.g. "Completed 6 weeks before assessment">,
                "status": <string or null, e.g. "Completed", "Active", "Requires Verification">,
                "evidence_snippet": <exact quote from document>
            }}
        ],
        "verified_therapies": [
            {{
                "name": <string, e.g. "Keytruda (pembrolizumab)">,
                "evidence_snippet": <exact quote from document>,
                "source_document": <source document name or "Oncology Consultation Summary">
            }}
        ],
        "patient_reported_therapies": [
            {{
                "name": <string, e.g. "Carboplatin">,
                "status": "Requires Verification",
                "evidence_snippet": <exact quote from document showing patient report>,
                "source_document": <source document name or "Oncology Consultation Summary">
            }}
        ],
        "past_therapies": [<list of string medication or regimen summaries, e.g. "Chemotherapy (2 regimens completed in metastatic setting, 6 weeks prior)">],
        "facts": [
            {{
                "field": <string, e.g. "cancer_stage", "metastatic_status", "ecog_score", "condition", "mutations", "receptor_status", "therapies">,
                "value": <string or list or dict or int or null>,
                "source_document": <string, e.g. "Oncology Case Summary", "Pathology Report", "Oncology Consultation Summary">,
                "evidence_snippet": <exact verbatim text snippet>,
                "confidence": <float between 0.0 and 1.0>
            }}
        ],
        "source_documents": [<list of source document titles identified in the text>],
        "medical_terms_glossary": {{
            "<term>": "<short, 1-sentence plain-English explanation of the specialized term or acronym for a patient>"
        }}
    }}
    
    Make sure to include any complex medical jargon or acronyms found in the extracted fields into the glossary with simple, accurate explanations.
    
    Patient Report and Clinical Records:
    {report}
    """


