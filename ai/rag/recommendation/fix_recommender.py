from typing import List, Optional
from pydantic import BaseModel
from ai.rag.retrieval.similar_incident_engine import SimilarIncident
from ai.rag.compression.context_compressor import CompressedContext

class FixRecommendation(BaseModel):
    recommended_fix: str
    confidence: float
    auto_heal_possible: bool
    reference_incidents: List[str]

class AegisFixRecommender:
    """
    Generates actionable fix recommendations based on historical 
    incident similarity and runbook retrieval.
    """
    def __init__(self):
        pass

    def recommend(
        self, 
        current_context: str, 
        similar_incidents: List[SimilarIncident],
        compressed_knowledge: CompressedContext
    ) -> FixRecommendation:
        """
        Ranks potential fixes and identifies if an automated shield 
        action (Auto-Heal) is applicable.
        """
        # In a real scenario, this would use an LLM to synthesize the recommendation
        # based on the similarity of the current issue to past fixes.
        
        best_fix = "No clear recommendation found."
        if compressed_knowledge.resolutions:
            best_fix = compressed_knowledge.resolutions[0]
            
        confidence = 0.0
        if similar_incidents:
            confidence = similar_incidents[0].similarity_score * 0.9 # Weight by similarity
            
        # Example heuristic for auto-heal
        auto_heal = any("restart" in r.lower() or "clear cache" in r.lower() for r in compressed_knowledge.resolutions)

        return FixRecommendation(
            recommended_fix=best_fix,
            confidence=round(confidence * 100, 2),
            auto_heal_possible=auto_heal,
            reference_incidents=[inc.incident_id for inc in similar_incidents[:2]]
        )
