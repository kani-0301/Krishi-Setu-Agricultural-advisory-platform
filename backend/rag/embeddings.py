"""
embeddings.py — Centralized sentence-transformer embedding model.

Used by both indexer.py (at index-build time) and retriever.py (at query time)
to ensure the same model is always used for both vectors.
"""
from langchain_community.embeddings import HuggingFaceEmbeddings

# Using all-MiniLM-L6-v2: lightweight, fast, strong English semantic similarity
EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"


def get_embeddings() -> HuggingFaceEmbeddings:
    """Return a shared HuggingFaceEmbeddings instance."""
    return HuggingFaceEmbeddings(
        model_name=EMBEDDING_MODEL_NAME,
        model_kwargs={"device": "cpu"},
        encode_kwargs={"normalize_embeddings": True},
    )
