from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class AegisMetadata(BaseModel):
    """Base metadata schema for all Aegis documents."""
    source: str
    doc_type: str = Field(..., description="Type of document: incident, runbook, or doc")
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    service: Optional[str] = None
    severity: Optional[str] = None
    component: Optional[str] = None
    error_code: Optional[str] = None
    tags: List[str] = []

class IncidentMetadata(AegisMetadata):
    """Specific metadata for historical incidents."""
    incident_id: str
    status: str  # e.g., resolved, investigating
    root_cause: Optional[str] = None
    resolution: Optional[str] = None

class RunbookMetadata(AegisMetadata):
    """Specific metadata for runbooks."""
    runbook_id: str
    steps: List[str] = []
    applicable_services: List[str] = []
