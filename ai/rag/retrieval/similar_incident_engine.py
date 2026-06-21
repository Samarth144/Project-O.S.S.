from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from ai.rag.retrieval.hybrid_retriever import AegisHybridRetriever
from ai.rag.schema.metadata import IncidentMetadata

class SimilarIncident(BaseModel):
    incident_id: str
    similarity_score: float
    service: str
    root_cause: Optional[str] = None
    resolution: Optional[str] = None
    summary: str

class SimilarIncidentEngine:
    """
    Engine responsible for finding and ranking historical incidents 
    similar to the current active incident.
    """
    def __init__(self):
        self.hybrid_retriever = AegisHybridRetriever()

    def find_similar(
        self, 
        description: str, 
        error_codes: Optional[List[str]] = None, 
        service: Optional[str] = None,
        k: int = 5
    ) -> List[SimilarIncident]:
        """
        Retrieves similar incidents using hybrid search and calculates 
        similarity confidence scores.
        """
        query = f"{description} {' '.join(error_codes) if error_codes else ''}"
        
        # Perform filtered search if service is provided
        raw_results = self.hybrid_retriever.search_with_filter(
            query=query, 
            service=service, 
            k=k
        )

        similar_incidents = []
        for i, doc in enumerate(raw_results):
            # In a real implementation, scores would be derived from the retriever's 
            # distance metric or RRF rank. Here we mock/derive from rank for the demo.
            # Chroma similarity is often distance-based (0 to 2, where 0 is identical).
            # We'll normalize or use a mock score for this phase.
            metadata = doc.metadata
            
            # Ensure we are only looking at incidents
            if metadata.get("doc_type") != "incident":
                continue

            similar_incidents.append(SimilarIncident(
                incident_id=metadata.get("incident_id", f"HIST-{i}"),
                similarity_score=max(0.0, 1.0 - (i * 0.1)), # Mock score decay
                service=metadata.get("service", "unknown"),
                root_cause=metadata.get("root_cause"),
                resolution=metadata.get("resolution"),
                summary=doc.page_content[:200]
            ))

        return sorted(similar_incidents, key=lambda x: x.similarity_score, reverse=True)

if __name__ == "__main__":
    engine = SimilarIncidentEngine()
    # Example usage
    # incidents = engine.find_similar("Database connection timeout", error_codes=["ETIMEDOUT"])
    # print(incidents)
