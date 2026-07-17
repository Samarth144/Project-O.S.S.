import os
import sys

# Add the project root directory to the python path dynamically
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from langchain_community.document_loaders import TextLoader, DirectoryLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from ai.rag.vector_store import VectorStoreManager

class KnowledgeIngestor:
    def __init__(self, base_dir=None):
        if base_dir is None:
            base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "knowledge_base"))
        self.base_dir = base_dir
        self.vsm = VectorStoreManager()
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=500,
            chunk_overlap=50
        )

    def load_and_split(self, sub_dir):
        """Loads documents from a subdirectory and splits them into chunks."""
        full_path = os.path.join(self.base_dir, sub_dir)
        if not os.path.exists(full_path):
            print(f"Directory {full_path} does not exist. Skipping.")
            return []

        print(f"Loading documents from {full_path}...")
        loader = DirectoryLoader(full_path, glob="**/*.txt", loader_cls=TextLoader)
        docs = loader.load()
        
        chunks = self.text_splitter.split_documents(docs)
        print(f"Split {len(docs)} documents into {len(chunks)} chunks.")
        return chunks

    def ingest_all(self):
        """Ingests all documents from incidents, runbooks, and docs."""
        sub_dirs = ["incidents", "runbooks", "docs"]
        all_chunks = []
        for sub_dir in sub_dirs:
            chunks = self.load_and_split(sub_dir)
            all_chunks.extend(chunks)
        
        if all_chunks:
            self.vsm.add_documents(all_chunks)
            print("Ingestion complete.")
        else:
            print("No documents found to ingest.")

if __name__ == "__main__":
    ingestor = KnowledgeIngestor()
    ingestor.ingest_all()
