import os
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings

class VectorStoreManager:
    def __init__(self, persist_directory="./chroma_db", embedding_model_name="all-MiniLM-L6-v2"):
        self.persist_directory = persist_directory
        self.embeddings = HuggingFaceEmbeddings(model_name=embedding_model_name)
        self.vector_store = self._init_vector_store()

    def _init_vector_store(self):
        """Initializes or loads the ChromaDB vector store."""
        return Chroma(
            persist_directory=self.persist_directory,
            embedding_function=self.embeddings,
            collection_name="aegis_knowledge_base"
        )

    def add_documents(self, documents):
        """Adds documents to the vector store."""
        self.vector_store.add_documents(documents)
        print(f"Added {len(documents)} document chunks to {self.persist_directory}")

    def get_retriever(self, search_kwargs={"k": 5}):
        """Returns a retriever object."""
        return self.vector_store.as_retriever(search_kwargs=search_kwargs)

if __name__ == "__main__":
    # Quick test initialization
    vsm = VectorStoreManager()
    print("Vector Store Initialized.")
