import sys
import json
import os
from dotenv import load_dotenv

# Add the project root directory to the python path dynamically
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Load env variables from local ai/.env
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

from ai.rag.retriever import AegisRetriever

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No query provided"}))
        sys.exit(1)

    query = sys.argv[1]
    try:
        retriever = AegisRetriever()
        results = retriever.search(query)
        
        output = []
        for doc in results:
            output.append({
                "content": doc.page_content,
                "metadata": doc.metadata
            })
            
        print(json.dumps(output))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
