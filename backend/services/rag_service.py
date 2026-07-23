"""
rag_service.py — Orchestrates RAG retrieval + Ollama LLM response.

Pipeline:
    retrieve_docs() → extract context + sources → build prompt → ollama_client → append citations
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from rag.retriever import retrieve_docs
import ollama_client

FALLBACK_RESPONSE = "I am not sure. Please consult a Krishi Mitra."


def generate_rag_response(query: str) -> str:
    """
    Retrieve relevant ICAR context chunks for the query, ask Llama 3.1:8b
    to answer with one DO and one DON'T, then append source citations
    (filename + page number) to the response.

    Falls back to a safe message if no context is available.
    """
    # Step 1 — Retrieve full Document objects from FAISS (includes metadata)
    docs = retrieve_docs(query)

    if not docs:
        return FALLBACK_RESPONSE

    # Step 2 — Extract page text and source citations from metadata
    context_block = "\n\n".join(
        f"[Chunk {i + 1}]\n{doc.page_content}" for i, doc in enumerate(docs)
    )

    # Build source citations: "Filename (Page N)"
    sources = []
    seen = set()
    for doc in docs:
        source_path = doc.metadata.get("source", "")
        page_num = doc.metadata.get("page", None)

        # Extract clean filename without extension
        source_name = Path(source_path).stem if source_path else "Unknown Source"

        # Format: "Filename (Page N)" or just "Filename"
        citation = f"{source_name} (Page {page_num + 1})" if page_num is not None else source_name

        if citation not in seen:
            sources.append(citation)
            seen.add(citation)

    # Step 3 — Build structured prompt
    prompt = (
        f"Context:\n{context_block}\n\n"
        f"Question:\n{query}\n\n"
        "Answer clearly with DO and DON'T."
    )

    # Step 4 — Send to Ollama (system prompt applied in ollama_client)
    response = ollama_client.generate_response(prompt=prompt)

    # Step 5 — Safety fallback if Ollama returns nothing useful
    if not response or response.strip().lower().startswith("error"):
        return FALLBACK_RESPONSE

    # Step 6 — Append source citations to the response
    if sources:
        source_line = "\n\nSource: " + ", ".join(sources)
        response = response.rstrip() + source_line

    return response
