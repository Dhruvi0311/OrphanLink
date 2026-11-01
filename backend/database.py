import os
import pickle
import uuid
import chromadb
from rank_bm25 import BM25Okapi
from typing import List
from clinical_protocol_parser import TrialChunk

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_CHROMA_DIR = os.path.join(BASE_DIR, "chroma_db")
DEFAULT_BM25_PATH = os.path.join(BASE_DIR, "bm25.pkl")

class HybridDB:
    """
    Manages both the dense vector store (ChromaDB) and sparse keyword store (BM25)
    for zero-cost local hybrid retrieval.
    """
    def __init__(self, persist_directory: str = DEFAULT_CHROMA_DIR, bm25_path: str = DEFAULT_BM25_PATH):
        self.persist_directory = persist_directory
        self.bm25_path = bm25_path
        
        # Initialize ChromaDB
        self.chroma_client = chromadb.PersistentClient(path=self.persist_directory)
        self.collection = self.chroma_client.get_or_create_collection(name="clinical_trials")
        
        # Initialize BM25 structures
        self.bm25 = None
        self.bm25_corpus = []  # Tokenized corpus
        self.chunks_data = []  # Raw chunks with doc_id
        
        if os.path.exists(self.bm25_path):
            self.load_bm25()
            self.deduplicate()
            
    def load_bm25(self):
        with open(self.bm25_path, "rb") as f:
            data = pickle.load(f)
            self.bm25 = data["bm25"]
            self.bm25_corpus = data["corpus"]
            self.chunks_data = data["chunks"]
            
    def save_bm25(self):
        with open(self.bm25_path, "wb") as f:
            pickle.dump({
                "bm25": self.bm25,
                "corpus": self.bm25_corpus,
                "chunks": self.chunks_data
            }, f)

    def deduplicate(self):
        """
        Deduplicates chunks by (nct_id, chunk_type) and rebuilds BM25 and ChromaDB.
        """
        if not self.chunks_data:
            return
            
        unique_map = {}
        for c in self.chunks_data:
            key = f"{c.get('nct_id')}_{c.get('chunk_type', 'general')}"
            if key not in unique_map:
                c_copy = dict(c)
                c_copy["doc_id"] = key
                unique_map[key] = c_copy
                
        if len(unique_map) == len(self.chunks_data):
            return # Already deduplicated
            
        deduped_chunks = list(unique_map.values())
        old_count = len(self.chunks_data)
        self.chunks_data = deduped_chunks
        self.bm25_corpus = [c["text"].lower().split() for c in deduped_chunks]
        self.bm25 = BM25Okapi(self.bm25_corpus)
        self.save_bm25()
        
        # Reset ChromaDB collection with unique documents
        try:
            self.chroma_client.delete_collection(name="clinical_trials")
        except Exception:
            pass
        self.collection = self.chroma_client.get_or_create_collection(name="clinical_trials")
        
        docs = [c["text"] for c in deduped_chunks]
        metas = [{
            "nct_id": c.get("nct_id", "UNKNOWN"),
            "title": c.get("title", ""),
            "chunk_type": c.get("chunk_type", "general")
        } for c in deduped_chunks]
        ids = [c["doc_id"] for c in deduped_chunks]
        
        self.collection.upsert(
            documents=docs,
            metadatas=metas,
            ids=ids
        )
        print(f"HybridDB deduplicated from {old_count} to {len(deduped_chunks)} unique chunks.")

    def add_chunks(self, chunks: List[TrialChunk]):
        if not chunks:
            return
            
        existing_keys = {
            f"{c.get('nct_id')}_{c.get('chunk_type', 'general')}"
            for c in self.chunks_data
        }
        
        new_chunks = []
        for chunk in chunks:
            key = f"{chunk.nct_id}_{chunk.chunk_type}"
            if key not in existing_keys:
                existing_keys.add(key)
                new_chunks.append(chunk)
                
        if not new_chunks:
            return
            
        ids = []
        documents = []
        metadatas = []
        
        for chunk in new_chunks:
            doc_id = f"{chunk.nct_id}_{chunk.chunk_type}"
            ids.append(doc_id)
            documents.append(chunk.text)
            metadatas.append({
                "nct_id": chunk.nct_id,
                "title": chunk.title,
                "chunk_type": chunk.chunk_type,
                "recruitment_status": chunk.recruitment_status or "UNKNOWN",
                "has_indian_site": bool(chunk.has_indian_site)
            })
            
            # Prepare for BM25
            tokenized_doc = chunk.text.lower().split()
            self.bm25_corpus.append(tokenized_doc)
            
            chunk_dict = chunk.model_dump()
            chunk_dict["doc_id"] = doc_id
            self.chunks_data.append(chunk_dict)
            
        # Add to ChromaDB
        self.collection.upsert(
            documents=documents,
            metadatas=metadatas,
            ids=ids
        )
        
        # Re-build BM25 index
        self.bm25 = BM25Okapi(self.bm25_corpus)
        self.save_bm25()
        
        print(f"Added {len(new_chunks)} unique chunks to HybridDB.")

if __name__ == "__main__":
    db = HybridDB()
    print("Hybrid Database Initialized successfully.")
