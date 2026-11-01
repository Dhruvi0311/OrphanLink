import requests
from typing import List
from clinical_protocol_parser import TrialChunk
import urllib.parse

def fetch_trials(query: str, max_results: int = 8, recruiting_only: bool = True) -> List[dict]:
    """
    Fetches clinical trials from ClinicalTrials.gov V2 API based on a query.
    By default prioritizes actively recruiting / open trials.
    """
    encoded_query = urllib.parse.quote(query)
    status_param = "&filter.overallStatus=RECRUITING|NOT_YET_RECRUITING|ACTIVE_NOT_RECRUITING" if recruiting_only else ""
    url = f"https://clinicaltrials.gov/api/v2/studies?query.term={encoded_query}{status_param}&pageSize={max_results}"
    
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        studies = data.get("studies", [])
        return studies
    except Exception as e:
        print(f"Error fetching from ClinicalTrials.gov: {e}")
        return []

def fetch_study_by_nct_id(nct_id: str) -> dict:
    """
    Fetches a single study directly by NCT ID.
    """
    url = f"https://clinicaltrials.gov/api/v2/studies/{nct_id}"
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Error fetching study {nct_id}: {e}")
        return {}

def parse_trials_to_chunks(studies: List[dict]) -> List[TrialChunk]:
    """
    Parses the raw JSON from the API into TrialChunk objects for insertion into HybridDB.
    Preserves recruitment status, country/site availability, and Indian site flags.
    """
    chunks = []
    
    for study in studies:
        protocol = study.get("protocolSection", {})
        
        identification = protocol.get("identificationModule", {})
        nct_id = identification.get("nctId", "UNKNOWN")
        title = identification.get("briefTitle", "Unknown Title")
        
        status_module = protocol.get("statusModule", {})
        recruitment_status = status_module.get("overallStatus", "UNKNOWN").upper()
        
        locations_module = protocol.get("contactsLocationsModule", {})
        raw_locations = locations_module.get("locations", [])
        countries = []
        formatted_locations = []
        has_indian_site = False
        
        for loc in raw_locations:
            country = (loc.get("country") or "").strip()
            city = (loc.get("city") or "").strip()
            facility = (loc.get("facility") or "").strip()
            if country:
                if country not in countries:
                    countries.append(country)
                if country.lower() == "india":
                    has_indian_site = True
            parts = [p for p in [facility, city, country] if p]
            if parts:
                loc_str = ", ".join(parts)
                if loc_str not in formatted_locations:
                    formatted_locations.append(loc_str)

        eligibility = protocol.get("eligibilityModule", {})
        criteria_text = eligibility.get("eligibilityCriteria", "")
        
        if not criteria_text:
            continue
            
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
                    recruitment_status=recruitment_status,
                    locations=formatted_locations,
                    has_indian_site=has_indian_site,
                    countries=countries,
                    text=f"Trial Title: {title}\nNCT ID: {nct_id}\nStatus: {recruitment_status}\nRequirement: Inclusion Criteria\nDetails:\n{inc_text}"
                ))
            if exc_text:
                chunks.append(TrialChunk(
                    nct_id=nct_id,
                    title=title,
                    chunk_type="exclusion",
                    recruitment_status=recruitment_status,
                    locations=formatted_locations,
                    has_indian_site=has_indian_site,
                    countries=countries,
                    text=f"Trial Title: {title}\nNCT ID: {nct_id}\nStatus: {recruitment_status}\nRequirement: Exclusion Criteria\nDetails:\n{exc_text}"
                ))
        else:
            chunks.append(TrialChunk(
                nct_id=nct_id,
                title=title,
                chunk_type="general",
                recruitment_status=recruitment_status,
                locations=formatted_locations,
                has_indian_site=has_indian_site,
                countries=countries,
                text=f"Trial Title: {title}\nNCT ID: {nct_id}\nStatus: {recruitment_status}\nRequirement: Eligibility Criteria\nDetails:\n{criteria_text[:1500]}"
            ))
            
    return chunks

if __name__ == "__main__":
    studies = fetch_trials("EGFR lung cancer", 2)
    chunks = parse_trials_to_chunks(studies)
    for c in chunks:
        print(c.nct_id, c.chunk_type, len(c.text))
