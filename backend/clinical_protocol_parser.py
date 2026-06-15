import json
import re
from typing import List, Optional
from pydantic import BaseModel

class TrialChunk(BaseModel):
    nct_id: str
    title: str
    chunk_type: str  # 'inclusion' or 'exclusion'
    text: str

class ClinicalProtocolParser:
    """
    A specialized data loader designed to ingest structured JSON files
    from ClinicalTrials.gov and extract "Inclusion" and "Exclusion" blocks
    as unbroken, highly contextualized chunks.
    """
    @staticmethod
    def parse_file(file_path: str) -> List[TrialChunk]:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        protocol_section = data.get("protocolSection", {})
        
        # Extract IDs and Title
        identification = protocol_section.get("identificationModule", {})
        nct_id = identification.get("nctId", "UNKNOWN_NCT_ID")
        title = identification.get("briefTitle", "Unknown Title")
        
        # Extract Eligibility
        eligibility = protocol_section.get("eligibilityModule", {})
        criteria_text = eligibility.get("eligibilityCriteria", "")
        
        if not criteria_text:
            return []
            
        # Split into Inclusion and Exclusion using regex
        # Typical ClinicalTrials.gov format uses these exact phrases
        inclusion_match = re.search(r'Inclusion Criteria:\s*(.*?)(?=Exclusion Criteria:|$)', criteria_text, re.IGNORECASE | re.DOTALL)
        exclusion_match = re.search(r'Exclusion Criteria:\s*(.*)', criteria_text, re.IGNORECASE | re.DOTALL)
        
        chunks = []
        
        if inclusion_match:
            inclusion_text = inclusion_match.group(1).strip()
            if inclusion_text:
                # Add context (Trial title/ID) to the chunk so the LLM knows what trial this is
                contextual_text = f"Trial Title: {title}\nNCT ID: {nct_id}\nRequirement: Inclusion Criteria\nDetails:\n{inclusion_text}"
                chunks.append(TrialChunk(
                    nct_id=nct_id,
                    title=title,
                    chunk_type="inclusion",
                    text=contextual_text
                ))
                
        if exclusion_match:
            exclusion_text = exclusion_match.group(1).strip()
            if exclusion_text:
                # Add context (Trial title/ID) to the chunk so the LLM knows what trial this is
                contextual_text = f"Trial Title: {title}\nNCT ID: {nct_id}\nRequirement: Exclusion Criteria\nDetails:\n{exclusion_text}"
                chunks.append(TrialChunk(
                    nct_id=nct_id,
                    title=title,
                    chunk_type="exclusion",
                    text=contextual_text
                ))
                
        return chunks

if __name__ == "__main__":
    # Simple test placeholder
    print("Clinical Protocol Parser Ready.")
