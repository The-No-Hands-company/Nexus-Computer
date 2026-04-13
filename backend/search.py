"""
Full-text file search with BM25 ranking.

Files are indexed on startup and when accessed through the file APIs.
Search respects workspace boundaries and policy constraints.
"""

import os
import json
import math
from pathlib import Path
from datetime import datetime, timezone
from collections import defaultdict


def _now():
    """Return current ISO timestamp."""
    return datetime.now(timezone.utc).isoformat()


class BM25Index:
    """Simple BM25 full-text search index.
    
    Stores inverted index of terms -> file locations with statistics.
    Ranks results using BM25 algorithm.
    """

    def __init__(self):
        self.inverted_index = defaultdict(list)  # term -> [{"file": path, "positions": [pos1, pos2]}, ...]
        self.documents = {}  # filepath -> {"size": bytes, "lines": n, "words": n, "indexed_at": iso}
        self.unique_terms = set()

    def _tokenize(self, text):
        """Simple word tokenization: lowercase, strip punctuation, split on whitespace."""
        import re
        text = text.lower()
        # Remove punctuation but keep hyphens for compound words
        text = re.sub(r'[^a-z0-9\s\-_./]', ' ', text)
        # Split on whitespace
        tokens = text.split()
        # Filter empty strings
        return [t for t in tokens if t and len(t) > 1]  # Ignore single-char tokens

    def index_file(self, filepath, content):
        """Add a file to the index."""
        tokens = self._tokenize(content)
        filename = self._tokenize(os.path.basename(filepath))
        
        # Boost filename matches: add filename tokens with virtual position 0
        all_tokens = filename + tokens
        
        # Build position map for BM25
        term_positions = defaultdict(list)
        for i, token in enumerate(all_tokens):
            term_positions[token].append(i)
        
        # Store in inverted index
        for term, positions in term_positions.items():
            self.inverted_index[term].append({
                "file": filepath,
                "positions": positions,  # Used for context snippets
            })
            self.unique_terms.add(term)
        
        # Store document metadata
        self.documents[filepath] = {
            "size": len(content),
            "lines": content.count('\n') + 1,
            "words": len(tokens),
            "indexed_at": _now(),
        }

    def remove_file(self, filepath):
        """Remove a file from the index."""
        # Rebuild inverted index without this file
        for term in list(self.inverted_index.keys()):
            self.inverted_index[term] = [
                entry for entry in self.inverted_index[term]
                if entry["file"] != filepath
            ]
            if not self.inverted_index[term]:
                del self.inverted_index[term]
        
        if filepath in self.documents:
            del self.documents[filepath]

    def search(self, query, limit=20):
        """Search for query, return ranked results using BM25.
        
        Returns list of dicts: {"file": path, "score": float, "preview": str}
        """
        query_tokens = self._tokenize(query)
        if not query_tokens:
            return []
        
        # Calculate BM25 scores for each document
        scores = defaultdict(float)
        
        # BM25 parameters: k1 controls term frequency saturation, b controls field length norm
        k1, b = 1.5, 0.75
        avg_doc_length = sum(doc["words"] for doc in self.documents.values()) / max(len(self.documents), 1)
        
        for term in query_tokens:
            if term not in self.inverted_index:
                continue
            
            # Inverse document frequency
            idf = math.log((len(self.documents) - len(self.inverted_index[term]) + 0.5) /
                          (len(self.inverted_index[term]) + 0.5) + 1.0)
            
            # For each document containing this term
            for entry in self.inverted_index[term]:
                filepath = entry["file"]
                term_freq = len(entry["positions"])
                doc_length = self.documents[filepath]["words"]
                
                # BM25 formula
                norm_term_freq = (term_freq * (k1 + 1)) / (
                    term_freq + k1 * (1 - b + b * (doc_length / avg_doc_length))
                )
                scores[filepath] += idf * norm_term_freq
        
        # Sort by score and return top results
        ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:limit]
        return [{"file": filepath, "score": score} for filepath, score in ranked]

    def to_dict(self):
        """Serialize index to dict for persistence."""
        return {
            "inverted_index": {term: entries for term, entries in self.inverted_index.items()},
            "documents": self.documents,
            "indexed_at": _now(),
        }

    def from_dict(self, data):
        """Load index from dict."""
        self.inverted_index = defaultdict(list, data.get("inverted_index", {}))
        self.documents = data.get("documents", {})
        self.unique_terms = set(self.inverted_index.keys())


class SearchIndexer:
    """Manages search index for a workspace."""

    def __init__(self, workspace_dir):
        self.workspace_dir = workspace_dir
        self.index_path = Path(workspace_dir) / ".nexus" / "search_index.json"
        self.index = BM25Index()
        self._ensure_index()

    def _ensure_index(self):
        """Load existing index or create empty one."""
        if self.index_path.exists():
            try:
                data = json.loads(self.index_path.read_text())
                self.index.from_dict(data)
            except (json.JSONDecodeError, ValueError):
                # Corrupt index, rebuild
                self.index = BM25Index()

    def _is_indexable(self, filepath):
        """Check if file should be indexed."""
        # Exclude system directories and common non-indexable files
        excluded = {'.nexus', '.git', 'node_modules', '.venv', '__pycache__', '.pytest_cache'}
        excluded_exts = {'.pyc', '.o', '.so', '.bin', '.exe', '.dll', '.dylib'}
        
        path = Path(filepath)
        
        # Check if any part of path is in excluded dirs
        for part in path.parts:
            if part in excluded:
                return False
        
        # Check file extension
        if path.suffix.lower() in excluded_exts:
            return False
        
        # Check file size: skip files > 10MB
        try:
            if path.stat().st_size > 10 * 1024 * 1024:
                return False
        except (OSError, ValueError):
            return False
        
        return True

    def _try_read_file(self, filepath):
        """Try to read file content, return None if not readable."""
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                return f.read()
        except (OSError, IOError, UnicodeDecodeError):
            return None

    def rebuild_from_workspace(self):
        """Scan workspace and rebuild index."""
        self.index = BM25Index()
        
        for root, dirs, files in os.walk(self.workspace_dir):
            # Skip excluded directories
            dirs[:] = [d for d in dirs if not d.startswith('.') and d not in {
                'node_modules', '__pycache__', '.venv'
            }]
            
            for file in files:
                filepath = os.path.join(root, file)
                if not self._is_indexable(filepath):
                    continue
                
                content = self._try_read_file(filepath)
                if content:
                    rel_path = os.path.relpath(filepath, self.workspace_dir)
                    self.index.index_file(rel_path, content)
        
        self._save_index()

    def index_file(self, filepath, content):
        """Add or update a file in the index."""
        abs_path = os.path.abspath(filepath)
        if not self._is_indexable(abs_path):
            return
        rel_path = os.path.relpath(abs_path, self.workspace_dir)
        self.index.index_file(rel_path, content)
        self._save_index()

    def remove_file(self, filepath):
        """Remove a file from the index."""
        abs_path = os.path.abspath(filepath)
        rel_path = os.path.relpath(abs_path, self.workspace_dir)
        self.index.remove_file(rel_path)
        self._save_index()

    def _save_index(self):
        """Persist index to disk."""
        try:
            self.index_path.parent.mkdir(parents=True, exist_ok=True)
            self.index_path.write_text(json.dumps(self.index.to_dict(), indent=2))
        except (OSError, IOError):
            pass

    def search(self, query, limit=20):
        """Search for query, return ranked results."""
        return self.index.search(query, limit)

    def get_status(self):
        """Get indexing status."""
        return {
            "indexed_files": len(self.index.documents),
            "unique_terms": len(self.index.unique_terms),
            "indexed_at": self.index.documents[next(iter(self.index.documents))]["indexed_at"]
            if self.index.documents else None,
        }
