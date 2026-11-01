import requests
import logging

logger = logging.getLogger(__name__)

# In-memory LRU-style cache with pre-warmed common oncology mappings
COMMON_THERAPIES_CACHE = {
    "tagrisso": "Osimertinib",
    "keytruda": "Pembrolizumab",
    "herceptin": "Trastuzumab",
    "opdivo": "Nivolumab",
    "avastin": "Bevacizumab",
    "ibrance": "Palbociclib",
    "lynparza": "Olaparib",
    "advil": "Ibuprofen",
    "carboplatin": "Carboplatin",
    "pemetrexed": "Pemetrexed",
    "cisplatin": "Cisplatin",
    "paclitaxel": "Paclitaxel",
    "tamoxifen": "Tamoxifen",
    "anastrozole": "Anastrozole",
    "gefitinib": "Gefitinib",
    "erlotinib": "Erlotinib",
    "afatinib": "Afatinib"
}

COMMON_MUTATIONS_CACHE = {
    "brca1": "BRCA1",
    "brca2": "BRCA2",
    "egfr": "EGFR",
    "erbb1": "EGFR",
    "erbb2": "ERBB2",
    "her2": "ERBB2",
    "kras": "KRAS",
    "braf": "BRAF",
    "pik3ca": "PIK3CA",
    "tp53": "TP53",
    "alk": "ALK",
    "ros1": "ROS1",
    "ret": "RET",
    "met": "MET"
}

def standardize_single_therapy(therapy_str: str) -> str:
    norm_key = therapy_str.strip().lower()
    if norm_key in COMMON_THERAPIES_CACHE:
        return COMMON_THERAPIES_CACHE[norm_key]
    for key, val in COMMON_THERAPIES_CACHE.items():
        if key in norm_key:
            return val
    std_therapy = therapy_str
    try:
        approx_url = "https://rxnav.nlm.nih.gov/REST/approximateTerm.json"
        approx_resp = requests.get(approx_url, params={"term": therapy_str, "maxEntries": 1}, timeout=2.5)
        if approx_resp.status_code == 200:
            approx_data = approx_resp.json()
            candidates = approx_data.get("approximateGroup", {}).get("candidate", [])
            if candidates:
                rxcui = candidates[0].get("rxcui")
                if rxcui:
                    related_url = f"https://rxnav.nlm.nih.gov/REST/rxcui/{rxcui}/related.json"
                    related_resp = requests.get(related_url, params={"tty": "IN"}, timeout=2.5)
                    if related_resp.status_code == 200:
                        concept_groups = related_resp.json().get("relatedGroup", {}).get("conceptGroup", [])
                        for group in concept_groups:
                            if group.get("tty") == "IN" and group.get("conceptProperties"):
                                std_therapy = group["conceptProperties"][0].get("name", std_therapy)
                                break
    except Exception as e:
        logger.warning(f"Error standardizing therapy '{therapy_str}' via RxNorm: {e}")
    final_therapy = std_therapy.capitalize() if std_therapy else therapy_str
    COMMON_THERAPIES_CACHE[norm_key] = final_therapy
    return final_therapy

def standardize_biomarkers(biomarkers: dict) -> dict:
    """
    Standardize biomarker names using cached mappings and public APIs.
    - Therapies -> RxNorm (resolves brand names to active ingredients)
    - Mutations -> MyGene.info (resolves to official gene symbols)
    Preserves all provenance, facts, verified vs patient-reported therapies, and receptor status.
    """
    standardized = dict(biomarkers)
    standardized["active_mutations"] = []
    standardized["past_therapies"] = []
    
    # 1. Standardize past therapies via Cache / RxNorm
    for therapy in biomarkers.get("past_therapies", []):
        std_therapy = standardize_single_therapy(therapy)
        standardized["past_therapies"].append(std_therapy)
        
    # Also normalize names inside verified_therapies
    if "verified_therapies" in biomarkers:
        new_verified = []
        for v in biomarkers["verified_therapies"]:
            v_copy = dict(v) if isinstance(v, dict) else {"name": str(v)}
            v_copy["standardized_name"] = standardize_single_therapy(v_copy.get("name", ""))
            new_verified.append(v_copy)
        standardized["verified_therapies"] = new_verified
        
    # Also normalize names inside patient_reported_therapies
    if "patient_reported_therapies" in biomarkers:
        new_pt = []
        for p in biomarkers["patient_reported_therapies"]:
            p_copy = dict(p) if isinstance(p, dict) else {"name": str(p)}
            p_copy["standardized_name"] = standardize_single_therapy(p_copy.get("name", ""))
            new_pt.append(p_copy)
        standardized["patient_reported_therapies"] = new_pt

    # Also standardize regimen names in prior_therapies_detailed if present
    if "prior_therapies_detailed" in biomarkers:
        new_detailed = []
        for d in biomarkers["prior_therapies_detailed"]:
            d_copy = dict(d) if isinstance(d, dict) else {"regimen_name": str(d)}
            if d_copy.get("regimen_name"):
                d_copy["standardized_regimen_name"] = standardize_single_therapy(d_copy["regimen_name"])
            new_detailed.append(d_copy)
        standardized["prior_therapies_detailed"] = new_detailed

    # 2. Standardize mutations via Cache / MyGene.info
    raw_mutations = biomarkers.get("active_mutations", [])
    valid_mutations = []
    for mut in raw_mutations:
        if str(mut).strip().lower() in ["wild-type / none", "none", "wild-type", "negative", "none detected"]:
            continue
        valid_mutations.append(mut)

    for mutation in valid_mutations:
        mut_key = mutation.strip().lower()
        # Direct key match
        if mut_key in COMMON_MUTATIONS_CACHE:
            standardized["active_mutations"].append(COMMON_MUTATIONS_CACHE[mut_key])
            continue
            
        # Check if contains common gene symbol
        matched_common = False
        for gene_k, gene_sym in COMMON_MUTATIONS_CACHE.items():
            if gene_k in mut_key.split():
                standardized["active_mutations"].append(gene_sym)
                COMMON_MUTATIONS_CACHE[mut_key] = gene_sym
                matched_common = True
                break
        if matched_common:
            continue

        std_mutation = mutation
        try:
            mygene_url = "https://mygene.info/v3/query"
            mygene_resp = requests.get(mygene_url, params={"q": mutation}, timeout=2.5)
            if mygene_resp.status_code == 200:
                hits = mygene_resp.json().get("hits", [])
                if hits and "symbol" in hits[0]:
                    std_mutation = hits[0]["symbol"]
        except Exception as e:
            logger.warning(f"Error standardizing mutation '{mutation}' via MyGene.info: {e}")
            
        COMMON_MUTATIONS_CACHE[mut_key] = std_mutation
        standardized["active_mutations"].append(std_mutation)

    # 3. Ensure genetic testing status is explicitly distinguished
    if "genetic_testing_status" not in standardized or not standardized["genetic_testing_status"]:
        if len(standardized["active_mutations"]) > 0:
            standardized["genetic_testing_status"] = "CONFIRMED_MUTATION"
        else:
            # Check facts for mention of negative genetic test or untested
            fact_snippets = " ".join([str(f.get("evidence_snippet", "")).lower() for f in biomarkers.get("facts", [])])
            if "negative" in fact_snippets and "genetic" in fact_snippets:
                standardized["genetic_testing_status"] = "CONFIRMED_NEGATIVE"
            elif "not tested" in fact_snippets or "untested" in fact_snippets:
                standardized["genetic_testing_status"] = "NOT_TESTED"
            else:
                standardized["genetic_testing_status"] = "NOT_DOCUMENTED"

    return standardized
