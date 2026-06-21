import os
from typing import List, Optional
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.retrievers import BM25Retriever
from langchain.retrievers import EnsembleRetriever
from langchain_core.documents import Document
from ai.rag.vector_store import VectorStoreManager

class AegisHybridRetriever:
    def __init__(self, persist_directory="./chroma_db"):
        self.vsm = VectorStoreManager(persist_directory=persist_directory)
        self.vector_store = self.vsm.vector_store
        self.embeddings = self.vsm.embeddings

    def _get_all_documents(self) -> List[Document]:
        """Helper to fetch all documents from the vector store for BM25 initialization."""
        # Note: In a massive production DB, you'd cache this or use a persistent BM25 index.
        results = self.vector_store.get()
        docs = []
        for i in range(len(results['documents'])):
            docs.append(Document(
                page_content=results['documents'][i],
                metadata=results['metadatas'][i]
            ))
        return docs

    def get_hybrid_retriever(self, k: int = 5, weight_vector: float = 0.7, weight_bm25: float = 0.3):
        """
        Creates an EnsembleRetriever combining Vector Search and BM25.
        """
        all_docs = self._get_all_documents()
        
        if not all_docs:
            print("Warning: No documents found to initialize BM25. Falling back to Vector only.")
            return self.vector_store.as_retriever(search_kwargs={"k": k})

        # 1. Vector Retriever
        vector_retriever = self.vector_store.as_retriever(search_kwargs={"k": k})

        # 2. BM25 Retriever (Keyword matching)
        bm25_retriever = BM25Retriever.from_documents(all_docs)
        bm25_retriever.k = k

        # 3. Ensemble (Hybrid)
        ensemble_retriever = EnsembleRetriever(
            retrievers=[vector_retriever, bm25_retriever],
            weights=[weight_vector, weight_bm25]
        )
        return ensemble_retriever

    def search_with_filter(self, query: str, service: Optional[str] = None, severity: Optional[str] = None, k: int = 5):
        """
        Performs a filtered search. 
        Note: Filtering is currently applied at the vector store level.
        """
        filter_dict = {}
        if service:
            filter_dict["service"] = service
        if severity:
            filter_dict["severity"] = severity

        print(f"Searching for '{query}' with filters: {filter_dict}")
        
        # We use the vector store directly for filtered search as EnsembleRetriever 
        # doesn't natively propagate filters to all sub-retrievers easily in this version.
        # In a full enterprise setup, we'd wrap this in a custom retriever class.
        return self.vector_store.similarity_search(query, k=k, filter=filter_dict if filter_dict else None)

if __name__ == "__main__":
    # Test initialization
    ahr = AegisHybridRetriever()
    hybrid = ahr.get_hybrid_retriever()
    print("Hybrid Retriever Initialized.")
    
    # Example search
    # results = hybrid.invoke("database connection timeout")
    # print(f"Found {len(results)} results.")
