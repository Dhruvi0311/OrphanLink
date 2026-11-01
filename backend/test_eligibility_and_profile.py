import os
import sys
import unittest

# Ensure backend directory is in sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from eligibility_policy import (
    CriterionStatus,
    TrialMatchStatus,
    evaluate_single_criterion,
    enforce_trial_eligibility_policy
)
from entity_linker import standardize_biomarkers

class TestEligibilityPolicyAndPatientProfile(unittest.TestCase):
    
    def setUp(self):
        # 1. Base Sarah profile (Multi-document biopsy + oncology summary)
        self.sarah_profile = {
            "condition_or_cancer_type": "Triple-Negative Breast Cancer",
            "cancer_stage": None,  # Core biopsy does not assign stage
            "metastatic_status": None,  # Undocumented from biopsy
            "age": 41,
            "receptor_status": {
                "ER": "Negative (0%)",
                "PR": "Negative (0%)",
                "HER2": "IHC 0 (Negative)"
            },
            "genetic_testing_status": "CONFIRMED_MUTATION",
            "active_mutations": ["BRCA2"],
            "verified_therapies": [
                {
                    "name": "Keytruda (pembrolizumab)",
                    "source_document": "Oncology Consultation Summary",
                    "evidence_snippet": "Currently prescribed and administered Keytruda (pembrolizumab) 200mg IV every 3 weeks."
                }
            ],
            "patient_reported_therapies": [
                {
                    "name": "Carboplatin",
                    "status": "Requires Verification",
                    "source_document": "Oncology Consultation Summary",
                    "evidence_snippet": "Patient reports prior adjuvant carboplatin and paclitaxel; awaiting records from outside hospital."
                },
                {
                    "name": "Paclitaxel",
                    "status": "Requires Verification",
                    "source_document": "Oncology Consultation Summary",
                    "evidence_snippet": "Patient reports prior adjuvant carboplatin and paclitaxel; awaiting records from outside hospital."
                }
            ],
            "past_therapies": ["Keytruda (pembrolizumab)", "Carboplatin", "Paclitaxel"],
            "facts": [
                {
                    "field": "cancer_stage",
                    "value": None,
                    "source_document": "Pathology Report",
                    "evidence_snippet": "Pathological stage is not assigned from the core biopsy alone; complete excision required.",
                    "confidence": 0.98
                },
                {
                    "field": "receptor_status",
                    "value": {"ER": "Negative", "PR": "Negative", "HER2": "IHC 0"},
                    "source_document": "Pathology Report",
                    "evidence_snippet": "Triple-negative breast carcinoma: ER negative (0%), PR negative (0%), HER2 IHC 0.",
                    "confidence": 0.99
                },
                {
                    "field": "verified_therapies",
                    "value": "Keytruda (pembrolizumab)",
                    "source_document": "Oncology Consultation Summary",
                    "evidence_snippet": "Verified prescription: Keytruda (pembrolizumab).",
                    "confidence": 0.95
                }
            ],
            "source_documents": ["Pathology Report", "Oncology Consultation Summary"]
        }

        # 2. Synthetic Demo Case Profile (OrphanLink_Metastatic_TNBC_Synthetic_Demo.pdf)
        self.demo_profile = {
            "condition_or_cancer_type": "Triple-Negative Breast Cancer",
            "cancer_stage": None,  # Formal TNM staging unassigned
            "metastatic_status": "Metastatic breast cancer with measurable soft-tissue lesion in the liver (RECIST 1.1 target lesion: 28 mm)",
            "metastatic_sites": ["Liver"],
            "age": 47,
            "ecog_score": 1,
            "ecog_status": "ECOG performance status: 1",
            "receptor_status": {
                "ER": "<1% (negative)",
                "PR": "<1% (negative)",
                "HER2": "IHC score 0 (negative)"
            },
            "genetic_testing_status": "NOT_DOCUMENTED",
            "active_mutations": [],
            "prior_therapies_detailed": [
                {
                    "regimen_name": None,
                    "agent_class": "Chemotherapy",
                    "regimen_count": 2,
                    "setting": "Metastatic",
                    "dates_or_timing": "Completed 6 weeks before assessment",
                    "status": "Completed",
                    "evidence_snippet": "Prior metastatic-setting chemotherapy: 2 regimens completed. Most recent anti-cancer therapy: Completed 6 weeks before assessment."
                }
            ],
            "past_therapies": ["Chemotherapy (2 regimens completed in metastatic setting, 6 weeks prior)"],
            "facts": [
                {
                    "field": "ecog_score",
                    "value": 1,
                    "source_document": "Oncology Case Summary",
                    "evidence_snippet": "ECOG performance status: 1.",
                    "confidence": 0.99
                },
                {
                    "field": "metastatic_status",
                    "value": "Metastatic breast cancer with measurable soft-tissue lesion in the liver (RECIST 1.1 target lesion: 28 mm)",
                    "source_document": "Oncology Case Summary",
                    "evidence_snippet": "Current disease: Metastatic breast cancer with measurable soft-tissue lesion in the liver (RECIST 1.1 target lesion: 28 mm).",
                    "confidence": 0.99
                },
                {
                    "field": "cancer_stage",
                    "value": None,
                    "source_document": "Oncology Case Summary",
                    "evidence_snippet": "Definitive pathological/clinical staging note: formal TNM stage not assigned.",
                    "confidence": 0.95
                }
            ],
            "source_documents": ["Oncology Case Summary"]
        }

    # =========================================================================
    # USER REQUIRED TESTS (TESTS 1 to 6)
    # =========================================================================

    def test_req_1_ecog_1_is_met_for_ecog_0_1_criterion_with_evidence(self):
        """
        TEST 1: ECOG 1 in document must be MET for an ECOG 0-1 criterion.
        Must preserve ECOG source evidence.
        """
        criterion_text = "Eastern Cooperative Oncology Group (ECOG) performance status of 0 or 1."
        res = evaluate_single_criterion(criterion_text, "inclusion", self.demo_profile)
        
        self.assertEqual(res["status"], CriterionStatus.MET)
        self.assertIn("1", str(res["evidence_snippet"]))
        self.assertEqual(res["source_document"], "Oncology Case Summary")
        self.assertIn("ECOG", res["reasoning"])
        
        # Test full trial enforcement preserves MET
        trial_eval = {"status": "POTENTIAL_MATCH", "criteria_evaluations": [res]}
        enforced = enforce_trial_eligibility_policy(trial_eval, self.demo_profile, f"Inclusion Criteria:\n1. {criterion_text}")
        self.assertEqual(enforced["criteria_evaluations"][0]["status"], CriterionStatus.MET)

    def test_req_2_explicit_metastatic_liver_disease_satisfies_metastatic_criterion(self):
        """
        TEST 2: Explicit metastatic liver disease must satisfy a metastatic-disease inclusion criterion.
        Direct metastatic evidence must evaluate to MET without inventing a TNM stage.
        """
        criterion_text = "Patient must have histologically confirmed metastatic breast cancer with measurable soft-tissue or visceral lesion in the liver per RECIST 1.1."
        res = evaluate_single_criterion(criterion_text, "inclusion", self.demo_profile)
        
        self.assertEqual(res["status"], CriterionStatus.MET)
        self.assertIn("liver", res["evidence_snippet"].lower())
        self.assertEqual(res["source_document"], "Oncology Case Summary")
        
        # Enforce on full trial
        trial_eval = {"status": "POTENTIAL_MATCH", "criteria_evaluations": [res]}
        enforced = enforce_trial_eligibility_policy(trial_eval, self.demo_profile, f"Inclusion Criteria:\n1. {criterion_text}")
        self.assertEqual(enforced["criteria_evaluations"][0]["status"], CriterionStatus.MET)

    def test_req_3_missing_tnm_stage_remains_unknown_for_formal_stage_criterion(self):
        """
        TEST 3: Missing TNM stage must remain UNKNOWN if a separate formal stage criterion requires it.
        Do not invent a formal TNM stage.
        """
        criterion_text = "Must have formal pathological or clinical TNM staging classification documented (pT/pN/pM)."
        res = evaluate_single_criterion(criterion_text, "inclusion", self.demo_profile)
        
        self.assertEqual(res["status"], CriterionStatus.UNKNOWN)
        snippet_lower = res["evidence_snippet"].lower()
        self.assertTrue("formal tnm stage" in snippet_lower or "stage is not assigned" in snippet_lower)
        self.assertTrue("not assigned" in snippet_lower or "unassigned" in snippet_lower)
        self.assertIn("must not be invented", res["reasoning"].lower())

    def test_req_4_missing_genetic_test_result_remains_unknown_not_wild_type(self):
        """
        TEST 4: Missing genetic test result must remain UNKNOWN, not wild-type.
        Distinguish:
        - Confirmed mutation detected
        - Confirmed negative genetic test
        - Not tested
        - Not documented
        Never infer wild-type from absence of a mutation mention.
        """
        # 1. Profile check
        self.assertEqual(self.demo_profile["genetic_testing_status"], "NOT_DOCUMENTED")
        self.assertEqual(self.demo_profile["active_mutations"], [])
        self.assertNotIn("Wild-Type / None", self.demo_profile["active_mutations"])

        # 2. Criterion evaluation check
        gene_crit = "Documented deleterious germline or somatic BRCA1 or BRCA2 mutation."
        res = evaluate_single_criterion(gene_crit, "inclusion", self.demo_profile)
        
        self.assertEqual(res["status"], CriterionStatus.UNKNOWN)
        self.assertNotEqual(res["status"], CriterionStatus.NOT_MET)
        self.assertIn("not documented", res["evidence_snippet"].lower())
        self.assertIn("not wild-type", res["reasoning"].lower())

    def test_req_5_completed_and_terminated_trials_never_appear_as_active_matches(self):
        """
        TEST 5: Completed trials must not appear as active recruiting matches.
        NCT03901469 is administratively terminated/completed and must NOT be shown as an active opportunity.
        """
        trial_nct = "NCT03901469"
        trial_text = f"Trial Title: ZEN003694 and Talazoparib\nNCT ID: {trial_nct}\nStatus: TERMINATED\n\nInclusion Criteria:\n1. Triple negative breast cancer"
        
        trial_eval = {
            "status": "POTENTIAL_MATCH",
            "recruitment_status": "TERMINATED",
            "criteria_evaluations": []
        }
        
        enforced = enforce_trial_eligibility_policy(trial_eval, self.demo_profile, trial_text)
        
        # Must be EXCLUDED, NEVER POTENTIAL_MATCH!
        self.assertEqual(enforced["status"], TrialMatchStatus.EXCLUDED)
        self.assertNotEqual(enforced["status"], TrialMatchStatus.POTENTIAL_MATCH)
        self.assertIn("TERMINATED", enforced["reason"])
        self.assertIn("not be shown as an active", enforced["reason"].lower())

    def test_req_6_every_decision_retains_source_document_evidence(self):
        """
        TEST 6: Every decision must retain source-document evidence.
        """
        criteria = [
            ("ECOG performance status 0-1", "inclusion"),
            ("Metastatic lesion in liver", "inclusion"),
            ("Formal TNM stage classification", "inclusion"),
            ("Prior therapy with anti-PD-1", "exclusion"),
            ("Deleterious BRCA mutation", "inclusion")
        ]
        
        for text, c_type in criteria:
            eval_res = evaluate_single_criterion(text, c_type, self.demo_profile)
            self.assertIn(eval_res["status"], [CriterionStatus.MET, CriterionStatus.NOT_MET, CriterionStatus.UNKNOWN])
            self.assertTrue(len(eval_res["evidence_snippet"]) > 0, f"Missing evidence for {text}")
            self.assertIsNotNone(eval_res["source_document"], f"Missing source doc for {text}")
            self.assertTrue(len(eval_res["reasoning"]) > 0, f"Missing reasoning for {text}")

    # =========================================================================
    # ISSUE 4: Medication Aggregation Tests
    # =========================================================================

    def test_medication_aggregation_preserves_regimen_count_setting_and_dates(self):
        """
        ISSUE 4: Extract and retain medication names, regimen count, treatment setting and dates when present.
        Do not invent missing details.
        """
        std = standardize_biomarkers(self.demo_profile)
        self.assertEqual(len(std["prior_therapies_detailed"]), 1)
        detailed = std["prior_therapies_detailed"][0]
        
        self.assertEqual(detailed["regimen_count"], 2)
        self.assertEqual(detailed["setting"], "Metastatic")
        self.assertEqual(detailed["dates_or_timing"], "Completed 6 weeks before assessment")
        self.assertIsNone(detailed["regimen_name"])  # Missing drug names NOT invented!

    # =========================================================================
    # REGRESSION TESTS (Multi-document Sarah profile)
    # =========================================================================

    def test_regression_sarah_null_stage_yields_unknown_and_not_excluded(self):
        criterion_text = "Histologically confirmed Stage IV or locally advanced breast cancer."
        result = evaluate_single_criterion(criterion_text, "inclusion", self.sarah_profile)
        self.assertEqual(result["status"], CriterionStatus.UNKNOWN)
        
        trial_eval = {"status": "POTENTIAL_MATCH", "criteria_evaluations": [result]}
        enforced = enforce_trial_eligibility_policy(trial_eval, self.sarah_profile, f"Inclusion Criteria:\n1. {criterion_text}")
        self.assertEqual(enforced["status"], TrialMatchStatus.NEEDS_MORE_INFORMATION)

    def test_regression_brca1_vs_brca2_precision(self):
        strict_brca1_crit = "Confirmed deleterious germline or somatic BRCA1 mutation."
        res_a = evaluate_single_criterion(strict_brca1_crit, "inclusion", self.sarah_profile)
        self.assertEqual(res_a["status"], CriterionStatus.NOT_MET)
        
        dual_brca_crit = "Documented pathogenic variant in BRCA1 or BRCA2."
        res_b = evaluate_single_criterion(dual_brca_crit, "inclusion", self.sarah_profile)
        self.assertEqual(res_b["status"], CriterionStatus.MET)

    def test_regression_verified_hard_exclusion_yields_excluded(self):
        criterion_text = "Prior therapy with anti-PD-1, anti-PD-L1, or pembrolizumab is prohibited."
        result = evaluate_single_criterion(criterion_text, "exclusion", self.sarah_profile)
        self.assertEqual(result["status"], CriterionStatus.MET)
        
        trial_eval = {"status": "POTENTIAL_MATCH", "criteria_evaluations": [result]}
        enforced = enforce_trial_eligibility_policy(trial_eval, self.sarah_profile, f"Exclusion Criteria:\n1. {criterion_text}")
        self.assertEqual(enforced["status"], TrialMatchStatus.EXCLUDED)

if __name__ == "__main__":
    unittest.main()
