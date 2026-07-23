"""
retriever.py — FAISS similarity search against the local vector index.

Loads the persisted FAISS vectorstore and returns the top-k most
relevant LangChain Document objects (content + metadata) for a given query.
Metadata includes 'source' (file path) and 'page' (page number).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from rag.embeddings import get_embeddings

VECTORSTORE_DIR = Path(__file__).resolve().parent / "vectorstore"
TOP_K = 3


def retrieve_docs(query: str) -> list[Document]:
    """
    Embed the query, search the FAISS index, and return the top-K
    Document objects (each has .page_content and .metadata).

    Returns an empty list if the vectorstore doesn't exist yet.
    """
    if not VECTORSTORE_DIR.exists():
        return []

    embeddings = get_embeddings()
    vectorstore = FAISS.load_local(
        str(VECTORSTORE_DIR),
        embeddings,
        allow_dangerous_deserialization=True,
    )

    return vectorstore.similarity_search(query, k=TOP_K)
