"""
indexer.py — One-time ingestion script.

Run this script each time new agricultural PDFs are added to /data/rag/.

Pipeline:
PDFs → Load → Chunk → Embeddings → FAISS Vector Index

Usage (from krishi-setu/backend):
    python rag/indexer.py
"""

import sys
from pathlib import Path

# Allow imports from backend root
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from langchain_community.document_loaders import PyPDFDirectoryLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from rag.embeddings import get_embeddings


# ─────────────────────────────────────────────────────────────
# Paths
# ─────────────────────────────────────────────────────────────
BACKEND_ROOT = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_ROOT.parent

PDF_DIR = PROJECT_ROOT / "data" / "rag"
VECTORSTORE_DIR = BACKEND_ROOT / "rag" / "vectorstore"


# ─────────────────────────────────────────────────────────────
# Chunking Configuration (Optimized for RAG)
# ─────────────────────────────────────────────────────────────
CHUNK_SIZE = 700
CHUNK_OVERLAP = 120


def run_indexer():

    print("\n[Krishi-Setu RAG Indexer]")
    print(f"[Indexer] Loading PDFs from: {PDF_DIR}")

    if not PDF_DIR.exists():
        print("[Indexer] ERROR: data/rag folder does not exist.")
        sys.exit(1)

    pdf_files = list(PDF_DIR.glob("*.pdf"))

    if len(pdf_files) == 0:
        print("[Indexer] ERROR: No PDFs found in data/rag/")
        print("[Indexer] Add agricultural PDFs before indexing.")
        sys.exit(1)

    print(f"[Indexer] Found {len(pdf_files)} PDF file(s)")

    # ─────────────────────────────────────────────
    # Step 1 — Load PDFs
    # ─────────────────────────────────────────────
    loader = PyPDFDirectoryLoader(str(PDF_DIR))
    documents = loader.load()

    print(f"[Indexer] Loaded {len(documents)} page(s)")


    # ─────────────────────────────────────────────
    # Step 2 — Split into chunks
    # ─────────────────────────────────────────────
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=[
            "\n\n",
            "\n",
            ". ",
            " ",
            ""
        ],
        length_function=len,
    )

    chunks = splitter.split_documents(documents)

    print(f"[Indexer] Split into {len(chunks)} chunk(s)")


    # ─────────────────────────────────────────────
    # Step 3 — Generate Embeddings
    # ─────────────────────────────────────────────
    print("[Indexer] Generating embeddings...")

    embeddings = get_embeddings()

    vectorstore = FAISS.from_documents(
        chunks,
        embeddings
    )


    # ─────────────────────────────────────────────
    # Step 4 — Save FAISS Index
    # ─────────────────────────────────────────────
    VECTORSTORE_DIR.mkdir(parents=True, exist_ok=True)

    vectorstore.save_local(str(VECTORSTORE_DIR))

    print(f"[Indexer] Vectorstore saved to: {VECTORSTORE_DIR}")
    print("[Indexer] Indexing complete.\n")


if __name__ == "__main__":
    run_indexer()
