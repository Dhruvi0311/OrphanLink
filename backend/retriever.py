from typing import List
from database import HybridDB

class HybridRetriever:
    """
    Executes a hybrid search querying both ChromaDB (dense) and BM25 (sparse),
    merging results via Reciprocal Rank Fusion (RRF).
    """
    def __init__(self, db: HybridDB):
        self.db = db
        
    def search(self, query: str, top_k: int = 3, rrf_k: int = 60) -> List[dict]:
        """
        Executes a hybrid search and returns top_k chunks.
        """
        if not self.db.chunks_data or not self.db.bm25:
            return []
            
        n_results = min(10, len(self.db.chunks_data))
        
        # 1. Semantic Search (ChromaDB)
        chroma_results = self.db.collection.query(
            query_texts=[query],
            n_results=n_results
        )
        
        # 2. Keyword Search (BM25)
        tokenized_query = query.lower().split()
        bm25_scores = self.db.bm25.get_scores(tokenized_query)
        
        # Get top indices from BM25
        top_bm25_indices = sorted(range(len(bm25_scores)), key=lambda i: bm25_scores[i], reverse=True)[:n_results]
        
        # 3. Apply RRF
        rrf_scores = {}
        
        # Add dense ranks
        if chroma_results and chroma_results["ids"] and len(chroma_results["ids"]) > 0:
            for rank, doc_id in enumerate(chroma_results["ids"][0]):
                if doc_id not in rrf_scores:
                    rrf_scores[doc_id] = 0.0
                rrf_scores[doc_id] += 1.0 / (rrf_k + rank + 1)
                
        # Add sparse ranks
        for rank, idx in enumerate(top_bm25_indices):
            doc_id = self.db.chunks_data[idx]["doc_id"]
            if doc_id not in rrf_scores:
                rrf_scores[doc_id] = 0.0
            rrf_scores[doc_id] += 1.0 / (rrf_k + rank + 1)
            
        # 4. Sort and retrieve top_k chunks
        sorted_doc_ids = sorted(rrf_scores.keys(), key=lambda x: rrf_scores[x], reverse=True)[:top_k]
        
        # Fast lookup mapping
        chunks_lookup = {chunk["doc_id"]: chunk for chunk in self.db.chunks_data}
        
        top_chunks = []
        for doc_id in sorted_doc_ids:
            if doc_id in chunks_lookup:
                top_chunks.append(chunks_lookup[doc_id])
                
        return top_chunks

if __name__ == "__main__":
    from database import HybridDB
    db = HybridDB()
    retriever = HybridRetriever(db)
    print("Hybrid Retriever initialized.")
