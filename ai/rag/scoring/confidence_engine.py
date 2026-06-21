from pydantic import BaseModel
from typing import Dict

class AegisConfidenceScore(BaseModel):
    retrieval_confidence: float
    similarity_confidence: float
    recommendation_confidence: float
    overall_confidence: float
    auto_heal_eligible: bool

class AegisConfidenceEngine:
    """
    Calculates the multi-dimensional reliability of the system's 
    findings and recommendations.
    """
    def calculate(
        self, 
        retrieval_score: float, 
        similarity_score: float, 
        fix_confidence: float
    ) -> AegisConfidenceScore:
        """
        Weighted calculation of confidence levels.
        """
        # Weights can be adjusted based on production feedback
        overall = (retrieval_score * 0.3) + (similarity_score * 0.4) + (fix_confidence * 0.3)
        
        # Threshold for auto-healing eligibility
        eligible = overall > 0.85 

        return AegisConfidenceScore(
            retrieval_confidence=retrieval_score,
            similarity_confidence=similarity_score,
            recommendation_confidence=fix_confidence,
            overall_confidence=round(overall, 4),
            auto_heal_eligible=eligible
        )
