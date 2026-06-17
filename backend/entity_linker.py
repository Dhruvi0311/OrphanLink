import requests
import logging

logger = logging.getLogger(__name__)

def standardize_biomarkers(biomarkers: dict) -> dict:
    """
    Standardize biomarker names using public APIs.
    - Therapies -> RxNorm (resolves brand names to active ingredients)
    - Mutations -> MyGene.info (resolves to official gene symbols)
    """
    standardized = {
        "age": biomarkers.get("age"),
        "active_mutations": [],
        "past_therapies": []
    }
    
    # 1. Standardize past therapies via RxNorm
    for therapy in biomarkers.get("past_therapies", []):
        std_therapy = therapy
        try:
            # First, find the RxCUI using approximate match
            approx_url = "https://rxnav.nlm.nih.gov/REST/approximateTerm.json"
            approx_resp = requests.get(approx_url, params={"term": therapy, "maxEntries": 1}, timeout=5)
            approx_resp.raise_for_status()
            approx_data = approx_resp.json()
            
            candidates = approx_data.get("approximateGroup", {}).get("candidate", [])
            if candidates:
                rxcui = candidates[0].get("rxcui")
                if rxcui:
                    # Attempt to get the active ingredient (IN) for this RxCUI
                    related_url = f"https://rxnav.nlm.nih.gov/REST/rxcui/{rxcui}/related.json"
                    related_resp = requests.get(related_url, params={"tty": "IN"}, timeout=5)
                    if related_resp.status_code == 200:
                        related_data = related_resp.json()
                        concept_groups = related_data.get("relatedGroup", {}).get("conceptGroup", [])
                        for group in concept_groups:
                            if group.get("tty") == "IN" and group.get("conceptProperties"):
                                std_therapy = group["conceptProperties"][0].get("name", std_therapy)
                                break
                        else:
                            # Fallback: get properties of the matched RxCUI directly
                            props_url = f"https://rxnav.nlm.nih.gov/REST/rxcui/{rxcui}/properties.json"
                            props_resp = requests.get(props_url, timeout=5)
                            if props_resp.status_code == 200:
                                props_data = props_resp.json()
                                std_therapy = props_data.get("properties", {}).get("name", std_therapy)
        except Exception as e:
            logger.warning(f"Error standardizing therapy '{therapy}' via RxNorm: {e}")
            
        standardized["past_therapies"].append(std_therapy.capitalize() if std_therapy else therapy)

    # 2. Standardize mutations via MyGene.info
    for mutation in biomarkers.get("active_mutations", []):
        std_mutation = mutation
        try:
            mygene_url = "https://mygene.info/v3/query"
            mygene_resp = requests.get(mygene_url, params={"q": mutation}, timeout=5)
            mygene_resp.raise_for_status()
            mygene_data = mygene_resp.json()
            
            hits = mygene_data.get("hits", [])
            if hits and "symbol" in hits[0]:
                std_mutation = hits[0]["symbol"]
        except Exception as e:
            logger.warning(f"Error standardizing mutation '{mutation}' via MyGene.info: {e}")
            
        standardized["active_mutations"].append(std_mutation)

    return standardized
