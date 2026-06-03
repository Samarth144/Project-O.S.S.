from ai.rag.vector_store import VectorStoreManager

class AegisRetriever:
    def __init__(self):
        self.vsm = VectorStoreManager()
        self.retriever = self.vsm.get_retriever(search_kwargs={"k": 5})

    def search(self, query):
        """Searches the vector store for the query and returns relevant documents."""
        print(f"Searching for: {query}")
        results = self.retriever.invoke(query)
        return results

if __name__ == "__main__":
    retriever = AegisRetriever()
    query = "payment service timeout due to database issue"
    results = retriever.search(query)
    
    for i, doc in enumerate(results):
        print(f"\nResult {i+1}:")
        print(f"Source: {doc.metadata.get('source')}")
        print(f"Content: {doc.page_content[:200]}...")
