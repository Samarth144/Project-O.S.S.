import os
from datetime import datetime
from langchain_core.documents import Document
from ai.rag.vector_store import VectorStoreManager
from ai.rag.schema.metadata import IncidentMetadata, RunbookMetadata

class AutoLearningPipeline:
    """
    Automatically ingests resolved incidents and scribe reports 
    back into the knowledge base to improve future retrieval.
    """
    def __init__(self):
        self.vsm = VectorStoreManager()

    def ingest_resolved_incident(self, report_data: dict):
        """
        Converts a resolved incident report into a vector-stored document.
        """
        # Extract metadata
        metadata = IncidentMetadata(
            source="scribe_agent",
            doc_type="incident",
            incident_id=report_data.get("incident_id", "UNK"),
            service=report_data.get("service"),
            severity=report_data.get("severity"),
            status="resolved",
            root_cause=report_data.get("root_cause"),
            resolution=report_data.get("resolution"),
            created_at=datetime.utcnow().isoformat()
        )

        content = f"""
        Incident Report: {report_data.get('title')}
        Service: {report_data.get('service')}
        Description: {report_data.get('description')}
        Root Cause: {report_data.get('root_cause')}
        Resolution: {report_data.get('resolution')}
        """

        doc = Document(
            page_content=content,
            metadata=metadata.model_dump()
        )

        self.vsm.add_documents([doc])
        print(f"Auto-learned from incident: {metadata.incident_id}")

if __name__ == "__main__":
    pipeline = AutoLearningPipeline()
    # pipeline.ingest_resolved_incident({...})
