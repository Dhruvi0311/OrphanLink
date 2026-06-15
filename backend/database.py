import os
import pickle
import uuid
import chromadb
from rank_bm25 import BM25Okapi
from typing import List
from clinical_protocol_parser import TrialChunk

class HybridDB:
    """
    Manages both the dense vector store (ChromaDB) and sparse keyword store (BM25)
    for zero-cost local hybrid retrieval.
    """
    def __init__(self, persist_directory: str = "./chroma_db", bm25_path: str = "./bm25.pkl"):
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

    def add_chunks(self, chunks: List[TrialChunk]):
        if not chunks:
            return
            
        ids = []
        documents = []
        metadatas = []
        
        for chunk in chunks:
            doc_id = str(uuid.uuid4())
            ids.append(doc_id)
            documents.append(chunk.text)
            metadatas.append({
                "nct_id": chunk.nct_id,
                "title": chunk.title,
                "chunk_type": chunk.chunk_type
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
        
        print(f"Added {len(chunks)} chunks to HybridDB.")

if __name__ == "__main__":
    db = HybridDB()
    print("Hybrid Database Initialized successfully.")
