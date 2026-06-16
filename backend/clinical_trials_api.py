import requests
from typing import List
from clinical_protocol_parser import TrialChunk
import urllib.parse

def fetch_trials(query: str, max_results: int = 5) -> List[dict]:
    """
    Fetches clinical trials from ClinicalTrials.gov V2 API based on a query.
    """
    encoded_query = urllib.parse.quote(query)
    url = f"https://clinicaltrials.gov/api/v2/studies?query.term={encoded_query}&pageSize={max_results}"
    
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        studies = data.get("studies", [])
        return studies
    except Exception as e:
        print(f"Error fetching from ClinicalTrials.gov: {e}")
        return []

def parse_trials_to_chunks(studies: List[dict]) -> List[TrialChunk]:
    """
    Parses the raw JSON from the API into TrialChunk objects for insertion into HybridDB.
    """
    chunks = []
    
    for study in studies:
        protocol = study.get("protocolSection", {})
        
        identification = protocol.get("identificationModule", {})
        nct_id = identification.get("nctId", "UNKNOWN")
        title = identification.get("briefTitle", "Unknown Title")
        
        eligibility = protocol.get("eligibilityModule", {})
        criteria_text = eligibility.get("eligibilityCriteria", "")
        
        if not criteria_text:
            continue
            
        # Very basic chunking: split by Inclusion / Exclusion if possible
        # For simplicity, we just create one chunk for now, or attempt to split it
        # ClinicalTrials.gov often formats criteria with "Inclusion Criteria:" and "Exclusion Criteria:"
        text_lower = criteria_text.lower()
        inc_idx = text_lower.find("inclusion criteria")
        exc_idx = text_lower.find("exclusion criteria")
        
        if inc_idx != -1 and exc_idx != -1 and inc_idx < exc_idx:
            inc_text = criteria_text[inc_idx:exc_idx].strip()
            exc_text = criteria_text[exc_idx:].strip()
            
            if inc_text:
                chunks.append(TrialChunk(
                    nct_id=nct_id,
                    title=title,
                    chunk_type="inclusion",
                    text=f"Trial Title: {title}\nNCT ID: {nct_id}\nRequirement: Inclusion Criteria\nDetails:\n{inc_text}"
                ))
            if exc_text:
                chunks.append(TrialChunk(
                    nct_id=nct_id,
                    title=title,
                    chunk_type="exclusion",
                    text=f"Trial Title: {title}\nNCT ID: {nct_id}\nRequirement: Exclusion Criteria\nDetails:\n{exc_text}"
                ))
        else:
            # Fallback to single chunk
            chunks.append(TrialChunk(
                nct_id=nct_id,
                title=title,
                chunk_type="general",
                text=f"Trial Title: {title}\nNCT ID: {nct_id}\nRequirement: Eligibility Criteria\nDetails:\n{criteria_text[:1500]}" # truncate if too long
            ))
            
    return chunks

if __name__ == "__main__":
    studies = fetch_trials("EGFR lung cancer", 2)
    chunks = parse_trials_to_chunks(studies)
    for c in chunks:
        print(c.nct_id, c.chunk_type, len(c.text))
