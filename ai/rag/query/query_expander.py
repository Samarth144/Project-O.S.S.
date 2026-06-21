from typing import List
from langchain_google_genai import ChatGeminiAI
from pydantic import BaseModel, Field

class QueryExpansionOutput(BaseModel):
    expanded_queries: List[str] = Field(..., description="List of technical variations of the query")

class AegisQueryExpander:
    """
    Expands simple user/agent queries into multiple technical variations
    to improve retrieval recall in the knowledge base.
    """
    def __init__(self, model_name: str = "gemini-1.5-flash"):
        self.llm = ChatGeminiAI(model=model_name)

    def expand(self, query: str, service: Optional[str] = None) -> List[str]:
        """
        Uses Gemini to generate synonyms, error codes, and service-specific 
        technical terms related to the query.
        """
        prompt = f"""
        You are an SRE Expert. Expand the following incident query into technical search terms 
        for a RAG system. Include error codes, related system components, and synonyms.
        
        Query: {query}
        Service Context: {service if service else "General"}
        
        Return a list of 5 search terms.
        """
        
        # Simplified for demonstration; in production use structured output parsing
        response = self.llm.invoke(prompt)
        # Mocking parsing for now or extracting lines
        lines = [line.strip("- ").strip("12345. ") for line in response.content.split("\n") if line.strip()]
        
        # Always include the original query
        if query not in lines:
            lines.insert(0, query)
            
        return lines[:6]

if __name__ == "__main__":
    expander = AegisQueryExpander()
    # print(expander.expand("database timeout", service="payment-service"))
