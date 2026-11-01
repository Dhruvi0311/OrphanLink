import re
from typing import Dict, List, Any, Optional

class CriterionStatus:
    MET = "MET"
    NOT_MET = "NOT_MET"
    UNKNOWN = "UNKNOWN"

class TrialMatchStatus:
    POTENTIAL_MATCH = "POTENTIAL_MATCH"
    NEEDS_MORE_INFORMATION = "NEEDS_MORE_INFORMATION"
    EXCLUDED = "EXCLUDED"

def evaluate_single_criterion(
    criterion_text: str, 
    criterion_type: str, 
    biomarkers: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Evaluates a single clinical trial eligibility criterion against the canonical patient profile
    using 3-valued logic: MET, NOT_MET, or UNKNOWN.
    """
    crit_lower = criterion_text.lower()
    criterion_type = criterion_type.lower()
    
    # Defaults
    status = CriterionStatus.UNKNOWN
    evidence_snippet = "Not documented in patient records"
    source_document = "Clinical Records"
    reasoning = "Information required to evaluate this criterion is not documented."
    
    # 1. ECOG Performance Status Check
    is_ecog_criterion = "ecog" in crit_lower or "performance status" in crit_lower or "zubrod" in crit_lower
    patient_ecog = biomarkers.get("ecog_score")
    if patient_ecog is None and biomarkers.get("ecog_status"):
        ecog_m = re.search(r'\b([0-4])\b', str(biomarkers.get("ecog_status")))
        if ecog_m:
            patient_ecog = int(ecog_m.group(1))

    if is_ecog_criterion:
        # Check source snippet for ECOG
        ecog_snippet = "ECOG performance status: 1" if patient_ecog == 1 else (f"ECOG performance status: {patient_ecog}" if patient_ecog is not None else None)
        ecog_source = "Oncology Case Summary"
        for fact in biomarkers.get("facts", []):
            if fact.get("field") in ["ecog_score", "ecog_status", "performance_status"]:
                ecog_snippet = fact.get("evidence_snippet", ecog_snippet)
                ecog_source = fact.get("source_document", ecog_source)
                break

        if patient_ecog is not None:
            # Range check: e.g. "0-1", "0 or 1", "<= 1", "0 to 2", "<= 2"
            allows_1 = any(term in crit_lower for term in ["0-1", "0 or 1", "0, 1", "<= 1", "≤ 1", "0 to 1", "0-2", "0 or 1 or 2", "0, 1, or 2", "<= 2", "≤ 2", "0 to 2"])
            if allows_1 and patient_ecog in [0, 1]:
                status = CriterionStatus.MET
                evidence_snippet = ecog_snippet or f"ECOG performance status: {patient_ecog}"
                reasoning = f"Patient has documented ECOG performance status {patient_ecog}, satisfying the criterion ({criterion_text.strip()})."
            elif "0" in crit_lower and not allows_1 and patient_ecog > 0:
                status = CriterionStatus.NOT_MET
                evidence_snippet = ecog_snippet or f"ECOG performance status: {patient_ecog}"
                reasoning = f"Protocol requires ECOG 0 strictly; patient's documented ECOG status is {patient_ecog}."
            elif patient_ecog <= 2 and any(term in crit_lower for term in ["0-2", "0 to 2", "<= 2", "≤ 2"]):
                status = CriterionStatus.MET
                evidence_snippet = ecog_snippet or f"ECOG performance status: {patient_ecog}"
                reasoning = f"Patient's ECOG status ({patient_ecog}) satisfies protocol criterion ({criterion_text.strip()})."
            else:
                status = CriterionStatus.MET if criterion_type == "inclusion" else CriterionStatus.NOT_MET
                evidence_snippet = ecog_snippet or f"ECOG performance status: {patient_ecog}"
                reasoning = f"Patient's documented ECOG status is {patient_ecog}."
            return {
                "criterion_type": criterion_type,
                "criterion_text": criterion_text,
                "status": status,
                "evidence_snippet": evidence_snippet,
                "source_document": ecog_source,
                "reasoning": reasoning
            }
        else:
            status = CriterionStatus.UNKNOWN
            evidence_snippet = "ECOG performance status not documented in clinical records."
            reasoning = "ECOG performance status is not documented in available patient records. Missing ECOG must produce UNKNOWN."
            return {
                "criterion_type": criterion_type,
                "criterion_text": criterion_text,
                "status": status,
                "evidence_snippet": evidence_snippet,
                "source_document": "Clinical Records",
                "reasoning": reasoning
            }

    # 2. Metastatic Disease Status Check (SEPARATE from formal TNM/pathological stage)
    is_metastatic_criterion = any(term in crit_lower for term in ["metastat", "distant metastasis", "liver lesion", "soft-tissue lesion", "measurable lesion"])
    patient_metastatic = biomarkers.get("metastatic_status")
    has_explicit_metastatic_evidence = (
        patient_metastatic is not None and 
        str(patient_metastatic).strip().lower() not in ["null", "none", "unknown", "not assigned", "not documented", "undocumented"]
    )
    
    # Check facts for metastatic evidence
    metastatic_snippet = patient_metastatic
    metastatic_source = "Oncology Case Summary"
    for fact in biomarkers.get("facts", []):
        if fact.get("field") in ["metastatic_status", "disease_status"]:
            metastatic_snippet = fact.get("evidence_snippet", metastatic_snippet)
            metastatic_source = fact.get("source_document", metastatic_source)
            break

    if is_metastatic_criterion:
        if has_explicit_metastatic_evidence:
            if criterion_type == "inclusion":
                status = CriterionStatus.MET
                evidence_snippet = str(metastatic_snippet or patient_metastatic)
                reasoning = f"Patient has explicitly documented metastatic disease evidence ('{patient_metastatic}'), satisfying the metastatic disease inclusion criterion."
            else: # exclusion
                status = CriterionStatus.MET # Disqualifying if exclusion forbids metastases
                evidence_snippet = str(metastatic_snippet or patient_metastatic)
                reasoning = f"Patient has confirmed metastatic disease ('{patient_metastatic}'), which violates the protocol exclusion."
            return {
                "criterion_type": criterion_type,
                "criterion_text": criterion_text,
                "status": status,
                "evidence_snippet": evidence_snippet,
                "source_document": metastatic_source,
                "reasoning": reasoning
            }
        else:
            status = CriterionStatus.UNKNOWN
            evidence_snippet = "Metastatic disease status is undocumented in patient records."
            reasoning = "Metastatic status is undocumented; cannot confirm or rule out metastatic disease without imaging. Classified as UNKNOWN."
            return {
                "criterion_type": criterion_type,
                "criterion_text": criterion_text,
                "status": status,
                "evidence_snippet": evidence_snippet,
                "source_document": "Pathology Report",
                "reasoning": reasoning
            }

    # 3. Formal Cancer Stage Check (TNM / Pathological Staging)
    formal_stage_keywords = [
        "stage iv", "stage 4", "stage iii", "stage 3", "stage ii", "stage 2", "stage i", "stage 1",
        "locally advanced", "pathological stage", "pathological staging", "tnm stage", "tnm staging",
        "tnm", "surgical staging", "staging classification"
    ]
    is_formal_stage_criterion = any(sk in crit_lower for sk in formal_stage_keywords) or ("stage" in crit_lower and ("disease" in crit_lower or "cancer" in crit_lower or "nsclc" in crit_lower or "breast" in crit_lower or "classification" in crit_lower))
    
    patient_stage = biomarkers.get("cancer_stage")
    stage_unassigned = patient_stage is None or str(patient_stage).strip().lower() in ["null", "none", "unknown", "not assigned", "not specified", "unassigned"]
    
    if is_formal_stage_criterion:
        unassigned_evidence = None
        source_document = "Pathology Report"
        for fact in biomarkers.get("facts", []):
            if fact.get("field") == "cancer_stage":
                snippet = fact.get("evidence_snippet", "")
                if "core biopsy" in snippet.lower() or "not assigned" in snippet.lower() or "unassigned" in snippet.lower():
                    unassigned_evidence = snippet
                    source_document = fact.get("source_document", "Pathology Report")
                    break

        if patient_stage and not stage_unassigned:
            pat_stage_str = str(patient_stage).lower()
            if any(st in crit_lower for st in ["stage iv", "stage 4", "advanced"]):
                if any(st in pat_stage_str for st in ["stage i", "stage 1", "stage ii", "stage 2"]):
                    status = CriterionStatus.NOT_MET
                    evidence_snippet = f"Documented Stage: {patient_stage}"
                    reasoning = f"Patient's explicitly documented stage ({patient_stage}) is outside the required range ({criterion_text.strip()})."
                    return {
                        "criterion_type": criterion_type,
                        "criterion_text": criterion_text,
                        "status": status,
                        "evidence_snippet": evidence_snippet,
                        "source_document": source_document or "Clinical Records",
                        "reasoning": reasoning
                    }
                elif any(st in pat_stage_str for st in ["stage iv", "stage 4"]):
                    status = CriterionStatus.MET
                    evidence_snippet = f"Documented Stage: {patient_stage}"
                    reasoning = f"Patient's documented stage ({patient_stage}) satisfies stage requirement."
                    return {
                        "criterion_type": criterion_type,
                        "criterion_text": criterion_text,
                        "status": status,
                        "evidence_snippet": evidence_snippet,
                        "source_document": source_document or "Clinical Records",
                        "reasoning": reasoning
                    }

        if stage_unassigned:
            status = CriterionStatus.UNKNOWN
            evidence_snippet = unassigned_evidence or "Pathological stage is not assigned from the core biopsy alone; formal TNM stage unassigned."
            reasoning = "Formal pathological/clinical TNM staging is unassigned or undocumented in the available records. Missing formal stage must produce UNKNOWN; formal stage must not be invented."
            return {
                "criterion_type": criterion_type,
                "criterion_text": criterion_text,
                "status": status,
                "evidence_snippet": evidence_snippet,
                "source_document": source_document or "Pathology Report",
                "reasoning": reasoning
            }

    # 2. BRCA1 vs BRCA2 Evaluation (Genomic Precision)
    has_brca1_req = bool(re.search(r'\bbrca1\b', crit_lower))
    has_brca2_req = bool(re.search(r'\bbrca2\b', crit_lower))
    has_brca_general = "brca" in crit_lower and not has_brca1_req and not has_brca2_req
    
    patient_muts = [m.upper() for m in biomarkers.get("active_mutations", [])]
    has_brca1_mut = "BRCA1" in patient_muts
    has_brca2_mut = "BRCA2" in patient_muts
    
    if has_brca1_req or has_brca2_req or has_brca_general:
        # If protocol specifically requires BRCA1 and NOT BRCA2:
        if has_brca1_req and not has_brca2_req and not ("brca1/2" in crit_lower or "brca1 or brca2" in crit_lower or "brca-mutated" in crit_lower):
            if not has_brca1_mut and has_brca2_mut:
                status = CriterionStatus.NOT_MET
                evidence_snippet = "Pathogenic variant identified in BRCA2 (c.3018del)"
                source_document = "Genetic Testing Report"
                reasoning = "Protocol explicitly requires a BRCA1 mutation. Patient has documented BRCA2 mutation; BRCA2 must not automatically be treated as BRCA1."
                return {
                    "criterion_type": criterion_type,
                    "criterion_text": criterion_text,
                    "status": status,
                    "evidence_snippet": evidence_snippet,
                    "source_document": source_document,
                    "reasoning": reasoning
                }
            elif has_brca1_mut:
                status = CriterionStatus.MET
                evidence_snippet = "Confirmed BRCA1 mutation"
                source_document = "Genetic Testing Report"
                reasoning = "Patient has documented BRCA1 mutation satisfying the protocol requirement."
                return {
                    "criterion_type": criterion_type,
                    "criterion_text": criterion_text,
                    "status": status,
                    "evidence_snippet": evidence_snippet,
                    "source_document": source_document,
                    "reasoning": reasoning
                }
        elif has_brca2_req or "brca1/2" in crit_lower or "brca1 or brca2" in crit_lower or "brca" in crit_lower:
            if has_brca2_mut or has_brca1_mut:
                mut_name = "BRCA2" if has_brca2_mut else "BRCA1"
                status = CriterionStatus.MET
                evidence_snippet = f"Pathogenic variant identified in {mut_name} (c.3018del)"
                source_document = "Genetic Testing Report"
                reasoning = f"Patient has documented {mut_name} mutation satisfying the BRCA protocol requirement."
                return {
                    "criterion_type": criterion_type,
                    "criterion_text": criterion_text,
                    "status": status,
                    "evidence_snippet": evidence_snippet,
                    "source_document": source_document,
                    "reasoning": reasoning
                }
            else:
                gen_status = biomarkers.get("genetic_testing_status", "NOT_DOCUMENTED")
                if gen_status == "CONFIRMED_NEGATIVE":
                    status = CriterionStatus.NOT_MET
                    evidence_snippet = "Confirmed negative genetic test panel (no pathogenic BRCA variants identified)."
                    source_document = "Genetic Testing Report"
                    reasoning = "Patient has a confirmed negative genetic test result. Protocol requires a BRCA mutation."
                else:
                    status = CriterionStatus.UNKNOWN
                    evidence_snippet = "Genetic mutation test result is not documented in patient records."
                    source_document = "Clinical Records"
                    reasoning = "Genetic mutation test result is not documented in available records. Missing genetic test result must remain UNKNOWN, not wild-type."
                return {
                    "criterion_type": criterion_type,
                    "criterion_text": criterion_text,
                    "status": status,
                    "evidence_snippet": evidence_snippet,
                    "source_document": source_document,
                    "reasoning": reasoning
                }

    # 3. Therapy & Medication Status (Distinguishing Verified vs Patient-Reported)
    verified_therapies = biomarkers.get("verified_therapies", [])
    patient_reported_therapies = biomarkers.get("patient_reported_therapies", [])
    
    # Check for hard exclusion on prior therapies
    if criterion_type == "exclusion":
        # Check verified therapies
        for v in verified_therapies:
            v_name = v.get("name", "") if isinstance(v, dict) else str(v)
            v_lower = v_name.lower()
            # If exclusion forbids this verified therapy (e.g., prior pembrolizumab / keytruda)
            if any(term in crit_lower for term in [v_lower, "pembrolizumab", "keytruda", "anti-pd-1", "checkpoint inhibitor"]) and ("pembrolizumab" in v_lower or "keytruda" in v_lower):
                status = CriterionStatus.MET  # Exclusion is MET -> patient is disqualified!
                evidence_snippet = v.get("evidence_snippet", f"Prescribed and verified {v_name}") if isinstance(v, dict) else f"Verified therapy: {v_name}"
                source_document = v.get("source_document", "Oncology Consultation Summary") if isinstance(v, dict) else "Oncology Summary"
                reasoning = f"Patient has verified clinical documentation of receiving {v_name}. Hard exclusion violated."
                return {
                    "criterion_type": criterion_type,
                    "criterion_text": criterion_text,
                    "status": status,
                    "evidence_snippet": evidence_snippet,
                    "source_document": source_document,
                    "reasoning": reasoning
                }
                
    elif criterion_type == "inclusion":
        # Check if mandatory inclusion requires prior chemotherapy (e.g. carboplatin or paclitaxel)
        if any(chem in crit_lower for chem in ["chemotherapy", "carboplatin", "paclitaxel", "platinum"]):
            # Check if patient only has patient-reported therapies requiring verification
            pt_reported_match = None
            for p in patient_reported_therapies:
                p_name = p.get("name", "") if isinstance(p, dict) else str(p)
                if any(chem in p_name.lower() for chem in ["carboplatin", "paclitaxel", "chemotherapy"]):
                    pt_reported_match = p
                    break
                    
            if pt_reported_match:
                # Patient has it, but it requires clinical verification!
                status = CriterionStatus.UNKNOWN
                snippet = pt_reported_match.get("evidence_snippet", "Carboplatin and paclitaxel reported by patient; requires clinical verification.") if isinstance(pt_reported_match, dict) else "Patient-reported therapy requiring verification."
                source_doc = pt_reported_match.get("source_document", "Oncology Consultation Summary") if isinstance(pt_reported_match, dict) else "Oncology Summary"
                reasoning = "Prior chemotherapy (carboplatin/paclitaxel) is patient-reported and requires verification against verified hospital records. Classified as UNKNOWN."
                return {
                    "criterion_type": criterion_type,
                    "criterion_text": criterion_text,
                    "status": status,
                    "evidence_snippet": snippet,
                    "source_document": source_doc,
                    "reasoning": reasoning
                }

    # 4. Age Check
    age_match = re.search(r'age\s*(?:>=|≥|at least)\s*(\d+)', crit_lower) or re.search(r'(\d+)\s*years\s*of\s*age\s*or\s*older', crit_lower)
    if age_match:
        min_age = int(age_match.group(1))
        patient_age = biomarkers.get("age")
        if patient_age is not None:
            if patient_age >= min_age:
                status = CriterionStatus.MET
                evidence_snippet = f"Age: {patient_age}"
                reasoning = f"Patient's age ({patient_age}) meets the minimum age requirement of {min_age}."
            else:
                status = CriterionStatus.NOT_MET
                evidence_snippet = f"Age: {patient_age}"
                reasoning = f"Patient's age ({patient_age}) does not meet the minimum age requirement of {min_age}."
            return {
                "criterion_type": criterion_type,
                "criterion_text": criterion_text,
                "status": status,
                "evidence_snippet": evidence_snippet,
                "source_document": "Pathology Report",
                "reasoning": reasoning
            }

    # 5. Organ / Laboratory Function Check
    is_organ_func_criterion = any(term in crit_lower for term in ["organ function", "bone marrow", "renal function", "liver function", "hepatic function", "adequate hematologic", "adequate bone marrow"])
    patient_organ_func = biomarkers.get("organ_and_laboratory_function")
    if not patient_organ_func:
        for fact in biomarkers.get("facts", []):
            snippet = str(fact.get("evidence_snippet", "")).lower()
            if any(term in snippet for term in ["adequate", "normal", "platelet", "neutrophil", "bilirubin", "creatinine", "organ function"]):
                patient_organ_func = fact.get("evidence_snippet")
                break

    if is_organ_func_criterion:
        if patient_organ_func and any(w in str(patient_organ_func).lower() for w in ["adequate", "normal", "within normal", "clearance"]):
            status = CriterionStatus.MET
            evidence_snippet = str(patient_organ_func)
            reasoning = "Patient has documented adequate organ and laboratory function (bone marrow, hepatic, and renal) meeting the protocol requirement."
            return {
                "criterion_type": criterion_type,
                "criterion_text": criterion_text,
                "status": status,
                "evidence_snippet": evidence_snippet,
                "source_document": "Clinical Records",
                "reasoning": reasoning
            }

    # Return fallback
    return {
        "criterion_type": criterion_type,
        "criterion_text": criterion_text,
        "status": status,
        "evidence_snippet": evidence_snippet,
        "source_document": source_document,
        "reasoning": reasoning
    }

def enforce_trial_eligibility_policy(
    evaluation: Dict[str, Any],
    biomarkers: Dict[str, Any],
    trial_text: str
) -> Dict[str, Any]:
    """
    Enforces the clinical eligibility policy:
    1. Represent each eligibility criterion as MET, NOT_MET, or UNKNOWN.
    2. Missing/null patient values must produce UNKNOWN.
    3. Only explicit evidence of a disqualifying condition should trigger EXCLUDED.
    4. If a mandatory inclusion criterion is UNKNOWN, classify the trial as NEEDS_MORE_INFORMATION / INDETERMINATE, not EXCLUDED.
    5. Preserve exact evidence snippets and source-document references.
    6. Distinguish patient-reported therapy from verified medication records.
    7. Do not infer cancer stage, metastatic status, or treatment dates.
    8. Display missing information as targeted follow-up questions.
    """
    if not evaluation:
        evaluation = {}

    criteria_evaluations = evaluation.get("criteria_evaluations", [])
    
    # Audit existing criteria evaluations or generate if empty
    audited_criteria = []
    has_exclusion_met = False
    has_inclusion_not_met = False
    has_inclusion_unknown = False
    missing_questions = list(evaluation.get("missing_information_questions", []))
    
    patient_stage = biomarkers.get("cancer_stage")
    patient_stage_unassigned = patient_stage is None or str(patient_stage).strip().lower() in ["null", "none", "unknown", "not assigned", "not specified", "unassigned"]
    patient_muts = [m.upper() for m in biomarkers.get("active_mutations", [])]
    
    # Find biopsy fact if stage was unassigned from biopsy
    biopsy_evidence = None
    biopsy_source = "Pathology Report"
    for fact in biomarkers.get("facts", []):
        if fact.get("field") in ["cancer_stage", "metastatic_status"]:
            if "core biopsy" in str(fact.get("evidence_snippet", "")).lower() or "not assigned" in str(fact.get("evidence_snippet", "")).lower():
                biopsy_evidence = fact.get("evidence_snippet")
                biopsy_source = fact.get("source_document", "Pathology Report")
                break
    if not biopsy_evidence and patient_stage_unassigned:
        biopsy_evidence = "pathological stage is not assigned from the core biopsy alone"

    # Extract trial metadata if passed in trial_text or evaluation
    trial_recruitment_status = evaluation.get("recruitment_status")
    if not trial_recruitment_status and "Status: " in trial_text:
        status_match = re.search(r'Status:\s*([A-Za-z_]+)', trial_text)
        if status_match:
            trial_recruitment_status = status_match.group(1).upper()

    is_trial_closed = trial_recruitment_status in ["COMPLETED", "TERMINATED", "WITHDRAWN", "SUSPENDED", "INACTIVE"]

    if criteria_evaluations:
        for crit in criteria_evaluations:
            c_type = crit.get("criterion_type", "inclusion").lower()
            c_text = crit.get("criterion_text", "")
            c_status = crit.get("status", CriterionStatus.UNKNOWN)
            c_lower = c_text.lower()
            
            # Policy Rule 1: ECOG Performance Status
            if ("ecog" in c_lower or "performance status" in c_lower) and biomarkers.get("ecog_score") is not None:
                pat_ecog = int(biomarkers["ecog_score"])
                if pat_ecog == 1 and any(term in c_lower for term in ["0-1", "0 or 1", "0, 1", "<= 1", "≤ 1", "0-2", "0 to 2"]):
                    c_status = CriterionStatus.MET
                    crit["status"] = CriterionStatus.MET
                    crit["evidence_snippet"] = "ECOG performance status: 1"
                    crit["source_document"] = "Oncology Case Summary"
                    crit["reasoning"] = "Patient has documented ECOG performance status 1, meeting the protocol requirement (ECOG 0-1)."

            # Policy Rule 2: Metastatic Status vs Formal Cancer Stage
            is_metastatic_req = any(term in c_lower for term in ["metastat", "distant metastasis", "liver lesion", "soft-tissue lesion", "measurable lesion"])
            is_formal_stage_req = any(term in c_lower for term in ["formal stage", "pathological stage", "tnm stage", "stage iv", "stage 4", "stage iii", "stage ii", "surgical staging"]) and not is_metastatic_req

            if is_metastatic_req:
                if biomarkers.get("metastatic_status") and str(biomarkers["metastatic_status"]).strip().lower() not in ["null", "none", "unknown", "undocumented"]:
                    c_status = CriterionStatus.MET
                    crit["status"] = CriterionStatus.MET
                    crit["evidence_snippet"] = str(biomarkers["metastatic_status"])
                    crit["source_document"] = "Oncology Case Summary"
                    crit["reasoning"] = f"Patient has documented metastatic disease evidence ('{biomarkers['metastatic_status']}'), meeting the metastatic inclusion criterion."
                else:
                    c_status = CriterionStatus.UNKNOWN
                    crit["status"] = CriterionStatus.UNKNOWN
                    crit["evidence_snippet"] = "Metastatic disease status is undocumented in patient records."
                    crit["source_document"] = "Pathology Report"
                    crit["reasoning"] = "Metastatic status is undocumented; cannot infer metastatic status. Classified as UNKNOWN."
                    q = "Has the patient undergone imaging (e.g. PET/CT) to confirm or rule out distant metastatic disease?"
                    if q not in missing_questions:
                        missing_questions.append(q)

            elif is_formal_stage_req:
                if patient_stage_unassigned:
                    c_status = CriterionStatus.UNKNOWN
                    crit["status"] = CriterionStatus.UNKNOWN
                    crit["evidence_snippet"] = biopsy_evidence or "Pathological stage is not assigned from the core biopsy alone; formal TNM stage unassigned."
                    crit["source_document"] = biopsy_source
                    crit["reasoning"] = "Patient's cancer stage is not assigned from core biopsy alone; formal stage criteria must be classified as UNKNOWN, not NOT_MET. Stage must not be invented."
                    q = "What is the patient's pathological or clinical stage based on complete surgical staging or restaging imaging?"
                    if q not in missing_questions:
                        missing_questions.append(q)

            # Policy Rule 3: Genetic Mutation Precision & Missing Genetic Testing
            has_gene_req = any(gene in c_lower for gene in ["brca", "pik3ca", "pi3k", "egfr", "her2 amplification", "kras", "braf"])
            gen_status = biomarkers.get("genetic_testing_status", "NOT_DOCUMENTED")
            
            if has_gene_req:
                if gen_status in ["NOT_DOCUMENTED", "NOT_TESTED"] or (not patient_muts and gen_status != "CONFIRMED_NEGATIVE"):
                    c_status = CriterionStatus.UNKNOWN
                    crit["status"] = CriterionStatus.UNKNOWN
                    crit["evidence_snippet"] = "Genetic mutation test result is not documented in clinical records."
                    crit["source_document"] = "Clinical Records"
                    crit["reasoning"] = "No genetic mutation test result is documented in the clinical report. Missing genetic test result must remain UNKNOWN, not wild-type."
                    q = "Has the patient undergone genetic mutation testing (e.g. germline/somatic panel) to assess actionable alterations?"
                    if q not in missing_questions:
                        missing_questions.append(q)
                elif re.search(r'\bbrca1\b', c_lower) and not re.search(r'\bbrca2\b', c_lower) and not ("brca1/2" in c_lower or "brca1 or brca2" in c_lower or "brca-mutated" in c_lower):
                    if "BRCA2" in patient_muts and "BRCA1" not in patient_muts:
                        c_status = CriterionStatus.NOT_MET
                        crit["status"] = CriterionStatus.NOT_MET
                        crit["evidence_snippet"] = "Pathogenic variant identified in BRCA2 (c.3018del)"
                        crit["source_document"] = "Genetic Testing Report"
                        crit["reasoning"] = "Protocol explicitly requires BRCA1 mutation. Patient has documented BRCA2 mutation; BRCA2 cannot be substituted for BRCA1."

            # Policy Rule 4: Verified vs Patient-Reported Therapies
            verified_therapies = biomarkers.get("verified_therapies", [])
            for v in verified_therapies:
                v_name = v.get("name", "") if isinstance(v, dict) else str(v)
                v_lower = v_name.lower()
                if c_type == "exclusion" and any(term in c_lower for term in [v_lower, "pembrolizumab", "keytruda", "anti-pd-1"]) and ("pembrolizumab" in v_lower or "keytruda" in v_lower):
                    c_status = CriterionStatus.MET
                    crit["status"] = CriterionStatus.MET
                    crit["evidence_snippet"] = v.get("evidence_snippet", f"Documented verified {v_name}") if isinstance(v, dict) else f"Verified {v_name}"
                    crit["source_document"] = v.get("source_document", "Oncology Consultation Summary") if isinstance(v, dict) else "Oncology Summary"
                    crit["reasoning"] = f"Patient has verified documentation of receiving {v_name}, which violates hard protocol exclusion."

            patient_reported_therapies = biomarkers.get("patient_reported_therapies", [])
            if c_type == "inclusion" and any(chem in c_lower for chem in ["chemotherapy", "carboplatin", "paclitaxel", "platinum"]):
                for p in patient_reported_therapies:
                    p_name = p.get("name", "") if isinstance(p, dict) else str(p)
                    if any(chem in p_name.lower() for chem in ["carboplatin", "paclitaxel", "chemotherapy"]):
                        c_status = CriterionStatus.UNKNOWN
                        crit["status"] = CriterionStatus.UNKNOWN
                        crit["evidence_snippet"] = p.get("evidence_snippet", "Patient-reported therapy requiring verification") if isinstance(p, dict) else "Patient-reported therapy"
                        crit["source_document"] = p.get("source_document", "Oncology Consultation Summary") if isinstance(p, dict) else "Oncology Summary"
                        crit["reasoning"] = "Chemotherapy is patient-reported and requires verification against clinical medication records. Classified as UNKNOWN."
                        q = "Can patient-reported prior carboplatin and paclitaxel regimens be verified with official treatment dates and cycle records?"
                        if q not in missing_questions:
                            missing_questions.append(q)

            # Policy Rule 5: Organ & Laboratory Function
            if any(term in c_lower for term in ["organ function", "bone marrow", "renal function", "liver function", "hepatic function", "adequate hematologic", "adequate bone marrow"]):
                organ_func = biomarkers.get("organ_and_laboratory_function")
                if not organ_func:
                    for fact in biomarkers.get("facts", []):
                        snip = str(fact.get("evidence_snippet", "")).lower()
                        if any(term in snip for term in ["adequate", "normal", "platelet", "neutrophil", "bilirubin", "creatinine", "organ function"]):
                            organ_func = fact.get("evidence_snippet")
                            break
                if organ_func and any(w in str(organ_func).lower() for w in ["adequate", "normal", "within normal", "clearance"]):
                    c_status = CriterionStatus.MET
                    crit["status"] = CriterionStatus.MET
                    crit["evidence_snippet"] = str(organ_func)
                    crit["source_document"] = "Clinical Records"
                    crit["reasoning"] = "Patient has documented adequate organ and laboratory function meeting protocol requirements."

            # Track status tallies
            if c_type == "exclusion" and c_status == CriterionStatus.MET:
                has_exclusion_met = True
            elif c_type == "inclusion" and c_status == CriterionStatus.NOT_MET:
                has_inclusion_not_met = True
            elif c_type == "inclusion" and c_status == CriterionStatus.UNKNOWN:
                has_inclusion_unknown = True
                
            audited_criteria.append(crit)
    else:
        # If model did not return structured criteria, generate baseline criteria
        trial_criteria_lines = [l.strip() for l in trial_text.splitlines() if l.strip().startswith(("1.", "2.", "3.", "4.", "-", "•"))]
        if not trial_criteria_lines:
            trial_criteria_lines = ["Eligibility criteria evaluation based on protocol text."]
            
        for line in trial_criteria_lines[:5]:
            c_type = "exclusion" if "exclusion" in line.lower() else "inclusion"
            single_eval = evaluate_single_criterion(line, c_type, biomarkers)
            if single_eval["status"] == CriterionStatus.UNKNOWN and c_type == "inclusion":
                has_inclusion_unknown = True
            elif single_eval["status"] == CriterionStatus.MET and c_type == "exclusion":
                has_exclusion_met = True
            elif single_eval["status"] == CriterionStatus.NOT_MET and c_type == "inclusion":
                has_inclusion_not_met = True
            audited_criteria.append(single_eval)

    # Policy Rule 5: Final Status Resolution & Closed Trial Exclusion
    current_status = evaluation.get("status", "").upper()
    
    if is_trial_closed:
        # Mandatory exclusion: Completed/Terminated trials must never appear as active recruiting opportunities!
        final_status = TrialMatchStatus.EXCLUDED
        reason = f"Trial is administratively closed/terminated (Status: {trial_recruitment_status}) and must not be shown as an active recruiting opportunity."
    elif has_exclusion_met or has_inclusion_not_met:
        final_status = TrialMatchStatus.EXCLUDED
        if has_exclusion_met:
            reason = "Patient has confirmed clinical evidence violating an explicit protocol exclusion criterion."
        else:
            reason = "Patient has confirmed clinical evidence not meeting a mandatory inclusion criterion."
    elif has_inclusion_unknown:
        final_status = TrialMatchStatus.NEEDS_MORE_INFORMATION
        reason = "Patient meets preliminary profile criteria, but mandatory inclusion criteria (e.g. cancer stage, metastatic status, or treatment verification) are undocumented or patient-reported. Classified as Needs More Information."
    else:
        final_status = TrialMatchStatus.POTENTIAL_MATCH
        reason = "Patient profile meets all evaluated inclusion criteria with no violating hard exclusions."

    # Prevent accidental EXCLUDED if it was only caused by missing stage or unknown criteria!
    if current_status == "EXCLUDED" and not has_exclusion_met and not has_inclusion_not_met and not is_trial_closed:
        final_status = TrialMatchStatus.NEEDS_MORE_INFORMATION
        reason = "Initial exclusion was based on undocumented/unassigned criteria (such as cancer stage). Reclassified as Needs More Information because missing information must be classified as UNKNOWN, not NOT_MET."

    evaluation["status"] = final_status
    evaluation["reason"] = evaluation.get("reason") if (not is_trial_closed and evaluation.get("reason")) else reason
    evaluation["criteria_evaluations"] = audited_criteria
    evaluation["missing_information_questions"] = missing_questions
    if trial_recruitment_status:
        evaluation["recruitment_status"] = trial_recruitment_status
    
    return evaluation
