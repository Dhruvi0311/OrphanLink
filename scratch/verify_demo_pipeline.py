import os
import sys
import json

backend_dir = os.path.join(os.path.dirname(__file__), "..", "backend")
sys.path.insert(0, os.path.abspath(backend_dir))

from file_parser import parse_file
from prompt.abstractor import get_abstractor_prompt
from entity_linker import standardize_biomarkers
from eligibility_policy import evaluate_single_criterion, enforce_trial_eligibility_policy, CriterionStatus, TrialMatchStatus
from llm_setup import get_llama3_llm
from langchain_core.messages import HumanMessage

def test_full_pipeline():
    pdf_path = os.path.join(os.path.dirname(__file__), "..", "sample_documents", "OrphanLink_Metastatic_TNBC_Synthetic_Demo.pdf")
    with open(pdf_path, "rb") as f:
        file_bytes = f.read()
    
    parsed_text = parse_file(file_bytes, "OrphanLink_Metastatic_TNBC_Synthetic_Demo.pdf")
    print(f"1. Parsed text length: {len(parsed_text)} chars")
    assert "ECOG performance status: 1" in parsed_text or "ECOG" in parsed_text, "ECOG missing from OCR"
    assert "Metastatic" in parsed_text, "Metastatic missing from OCR"
    
    # 2. Extract structured profile via abstractor prompt
    prompt = get_abstractor_prompt(parsed_text)
    llm = get_llama3_llm(json_mode=True, max_tokens=700)
    response = llm.invoke([HumanMessage(content=prompt)])
    content = response.content
    if "```json" in content:
        content = content.split("```json")[1].split("```")[0].strip()
    elif "```" in content:
        content = content.split("```")[1].strip()
    start = content.find('{')
    end = content.rfind('}') + 1
    extracted = json.loads(content[start:end])
    
    print("\n2. Extracted Profile:")
    print(" - Condition:", extracted.get("condition_or_cancer_type"))
    print(" - Cancer Stage:", extracted.get("cancer_stage"))
    print(" - Metastatic Status:", extracted.get("metastatic_status"))
    print(" - ECOG Score:", extracted.get("ecog_score"), "| Status:", extracted.get("ecog_status"))
    print(" - Genetic Testing Status:", extracted.get("genetic_testing_status"))
    print(" - Active Mutations:", extracted.get("active_mutations"))
    print(" - Detailed Therapies:", extracted.get("prior_therapies_detailed"))
    
    # 3. Standardize via entity linker
    std = standardize_biomarkers(extracted)
    print("\n3. Standardized Profile:")
    print(" - Genetic Testing Status:", std.get("genetic_testing_status"))
    print(" - Active Mutations:", std.get("active_mutations"))
    
    # Verify Issue 1: ECOG extraction
    assert std.get("ecog_score") == 1 or "1" in str(std.get("ecog_status")), f"ECOG not extracted: {std.get('ecog_score')}"
    
    # Verify Issue 2: Metastatic separate from stage
    assert std.get("cancer_stage") is None or "not assigned" in str(std.get("cancer_stage")).lower(), "Cancer stage should remain None/unassigned"
    assert std.get("metastatic_status") is not None and "metastatic" in str(std.get("metastatic_status")).lower(), "Metastatic status should be documented"
    
    # Verify Issue 3: Missing genetic test result is NOT Wild-Type
    assert std.get("genetic_testing_status") in ["NOT_DOCUMENTED", "NOT_TESTED"], f"Genetic testing status should be NOT_DOCUMENTED, got {std.get('genetic_testing_status')}"
    assert "Wild-Type / None" not in std.get("active_mutations", []), "Must never infer wild-type from lack of testing mention"
    
    # 4. Criteria Evaluation:
    # Criterion A: ECOG 0-1
    ecog_eval = evaluate_single_criterion("ECOG performance status 0-1.", "inclusion", std)
    print("\n4. Evaluation Results:")
    print(" - Criterion A (ECOG 0-1):", ecog_eval["status"], "| Snippet:", ecog_eval["evidence_snippet"])
    assert ecog_eval["status"] == CriterionStatus.MET, f"ECOG 0-1 must be MET, got {ecog_eval['status']}"
    
    # Criterion B: Metastatic liver disease
    meta_eval = evaluate_single_criterion("Histologically confirmed metastatic breast cancer with measurable lesion in liver.", "inclusion", std)
    print(" - Criterion B (Metastatic liver lesion):", meta_eval["status"], "| Snippet:", meta_eval["evidence_snippet"])
    assert meta_eval["status"] == CriterionStatus.MET, f"Metastatic liver lesion must be MET, got {meta_eval['status']}"
    
    # Criterion C: Formal TNM staging required
    tnm_eval = evaluate_single_criterion("Must have definitive pathological or clinical TNM staging classification documented.", "inclusion", std)
    print(" - Criterion C (Formal TNM staging):", tnm_eval["status"], "| Snippet:", tnm_eval["evidence_snippet"])
    assert tnm_eval["status"] == CriterionStatus.UNKNOWN, f"Formal TNM staging must be UNKNOWN, got {tnm_eval['status']}"
    
    # Criterion D: Genetic mutation required
    gene_eval = evaluate_single_criterion("Documented pathogenic BRCA1/2 or PIK3CA mutation.", "inclusion", std)
    print(" - Criterion D (Genetic mutation):", gene_eval["status"], "| Snippet:", gene_eval["evidence_snippet"])
    assert gene_eval["status"] == CriterionStatus.UNKNOWN, f"Undocumented genetic test must be UNKNOWN, got {gene_eval['status']}"
    
    # Criterion E: Completed / Terminated trial (NCT03901469)
    trial_text = "Trial Title: Study of ZEN003694 and Talazoparib\nNCT ID: NCT03901469\nStatus: TERMINATED\n\nInclusion Criteria:\n1. Triple negative breast cancer"
    closed_eval = enforce_trial_eligibility_policy({"status": "POTENTIAL_MATCH", "recruitment_status": "TERMINATED"}, std, trial_text)
    print(" - Criterion E (Terminated trial NCT03901469):", closed_eval["status"], "| Reason:", closed_eval["reason"])
    assert closed_eval["status"] == TrialMatchStatus.EXCLUDED, f"Terminated trial must be EXCLUDED, got {closed_eval['status']}"
    
    print("\nALL PIPELINE AND CRITERIA ASSERTIONS VERIFIED SUCCESSFULLY!")

if __name__ == "__main__":
    test_full_pipeline()
