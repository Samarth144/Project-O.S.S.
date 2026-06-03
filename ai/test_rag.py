import os
from dotenv import load_dotenv
from ai.rag.ingest import KnowledgeIngestor

# Load environment variables from ai/.env
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

from ai.rag.retriever import AegisRetriever
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser

def run_test():
    # 1. Ingest documents
    print("--- Phase 1: Ingestion ---")
    ingestor = KnowledgeIngestor()
    ingestor.ingest_all()

    # 2. Retrieve documents
    print("\n--- Phase 2: Retrieval ---")
    retriever = AegisRetriever()
    query = "payment service timeout due to database issue"
    results = retriever.search(query)

    print(f"\nFound {len(results)} relevant documents for query: '{query}'")
    for i, doc in enumerate(results):
        print(f"\n[{i+1}] Source: {doc.metadata.get('source')}")
        print(f"Content snippet: {doc.page_content[:150]}...")

    # 3. Generation (Optional but demonstrates Gemini usage)
    print("\n--- Phase 3: Generation (Gemini) ---")
    if not os.getenv("GOOGLE_API_KEY"):
        print("Skipping generation: GOOGLE_API_KEY not set.")
        return

    llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0)
    
    template = """
    You are an AI SRE Assistant for the Aegis Platform. 
    Use the following pieces of retrieved context to answer the user question. 
    If you don't know the answer, just say that you don't know, don't try to make up an answer.
    
    Context:
    {context}
    
    Question: {question}
    
    Helpful Answer:
    """
    prompt = ChatPromptTemplate.from_template(template)

    def format_docs(docs):
        return "\n\n".join([d.page_content for d in docs])

    rag_chain = (
        {"context": lambda x: format_docs(results), "question": RunnablePassthrough()}
        | prompt
        | llm
        | StrOutputParser()
    )

    print("Generating response based on retrieved data...")
    response = rag_chain.invoke(query)
    print(f"\nGemini Response:\n{response}")

if __name__ == "__main__":
    run_test()
