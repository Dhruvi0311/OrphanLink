from database import HybridDB
from clinical_protocol_parser import TrialChunk

def seed():
    db = HybridDB()
    chunks = [
        TrialChunk(
            nct_id="NCT01234567",
            title="Afatinib in EGFR Mutated Lung Cancer",
            chunk_type="inclusion",
            text="Trial Title: Afatinib in EGFR Mutated Lung Cancer\nNCT ID: NCT01234567\nRequirement: Inclusion Criteria\nDetails:\nPatients must have a confirmed EGFR mutation. Must be 18 years or older."
        ),
        TrialChunk(
            nct_id="NCT01234567",
            title="Afatinib in EGFR Mutated Lung Cancer",
            chunk_type="exclusion",
            text="Trial Title: Afatinib in EGFR Mutated Lung Cancer\nNCT ID: NCT01234567\nRequirement: Exclusion Criteria\nDetails:\nPatients with prior Afatinib treatment are excluded. Patients with active brain metastases are excluded."
        ),
        TrialChunk(
            nct_id="NCT09876543",
            title="BRCA1 Targeted Therapy",
            chunk_type="inclusion",
            text="Trial Title: BRCA1 Targeted Therapy\nNCT ID: NCT09876543\nRequirement: Inclusion Criteria\nDetails:\nPatients must have a confirmed BRCA1 mutation."
        )
    ]
    db.add_chunks(chunks)
    print("Database seeded with mock trial chunks.")

if __name__ == "__main__":
    seed()
