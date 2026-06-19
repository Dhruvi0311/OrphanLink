def get_abstractor_prompt(report: str) -> str:
    return f"""
    You are an expert clinical data abstractor. Your task is to extract specific information from the patient report provided below.
    
    CRITICAL INSTRUCTIONS:
    1. Base your extraction SOLELY on the provided text.
    2. DO NOT guess, infer, or hallucinate any information.
    3. If a piece of information is not explicitly mentioned in the text, use `null` for numbers/strings or an empty array `[]` for lists.
    4. Output ONLY a valid JSON object. Do not include any conversational filler, markdown formatting blocks (like ```json), or explanations outside the JSON object.
    
    Schema:
    {{
        "age": <int or null>,
        "active_mutations": [<list of string acronyms or names, e.g. "EGFR", "BRCA1">],
        "past_therapies": [<list of string medication names>],
        "medical_terms_glossary": {{
            "<term>": "<short, 1-sentence plain-English explanation of the specialized term or acronym for a patient>"
        }}
    }}
    
    Make sure to include any complex medical jargon or acronyms found in the extracted fields (mutations, therapies) into the glossary with simple, accurate explanations.
    
    Patient Report and Conversation History:
    {report}
    """
