import os
import re
import unicodedata

from flask import Flask, render_template, request, jsonify
from werkzeug.utils import secure_filename
from flask import send_from_directory

import PyPDF2          # pip install PyPDF2
import docx            # pip install python-docx

app = Flask(__name__)

# --- Config ---
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {"pdf", "docx"}

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024  # 50 MB per upload

@app.route("/download/<path:filename>")
def download_file(filename):
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename, as_attachment=True)

# --- Helpers ---

def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def extract_text_from_pdf(path: str) -> str:
    text = []
    with open(path, "rb") as f:
        reader = PyPDF2.PdfReader(f)
        for page in reader.pages:
            page_text = page.extract_text() or ""
            text.append(page_text)
    return "\n".join(text)


def extract_text_from_docx(path: str) -> str:
    document = docx.Document(path)
    paragraphs = [p.text for p in document.paragraphs]
    return "\n".join(paragraphs)


def extract_text(path: str) -> str:
    ext = os.path.splitext(path)[1].lower()
    if ext == ".pdf":
        return extract_text_from_pdf(path)
    elif ext == ".docx":
        return extract_text_from_docx(path)
    else:
        return ""


def strip_accents(s: str) -> str:
    """Remove accents/diacritics from a string."""
    if not s:
        return ""
    return "".join(
        c for c in unicodedata.normalize("NFD", s)
        if unicodedata.category(c) != "Mn"
    )


def find_keyword_sentences(text: str, keyword: str):
    """
    Split text into sentences and return those containing the keyword,
    ignoring accents and case. Keyword highlighting is case-insensitive.
    """
    # Normalize whitespace
    text = re.sub(r"\s+", " ", text)

    # Rough sentence split
    sentences = re.split(r"(?<=[.!?])\s+", text)

    norm_keyword = strip_accents(keyword).lower()
    if not norm_keyword:
        return []

    # For highlighting (case-insensitive; accent-sensitive)
    pattern_highlight = re.compile(re.escape(keyword), re.IGNORECASE)

    matches = []

    for s in sentences:
        norm_s = strip_accents(s).lower()

        # Accent & case-insensitive match
        if norm_keyword in norm_s:
            # Try to highlight exact occurrences of the typed keyword
            if pattern_highlight.search(s):
                highlighted = pattern_highlight.sub(
                    lambda m: f"<mark>{m.group(0)}</mark>",
                    s
                )
            else:
                # If we can't find the exact form, return the sentence as-is
                highlighted = s

            matches.append(highlighted.strip())

    return matches

# --- Routes ---

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/upload", methods=["POST"])
def upload_files():
    if "files" not in request.files:
        return jsonify({"error": "No files part in the request"}), 400

    files = request.files.getlist("files")
    saved_files = []
    rejected_files = []

    for file in files:
        if file.filename == "":
            continue

        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            dest = os.path.join(app.config["UPLOAD_FOLDER"], filename)
            file.save(dest)
            saved_files.append(filename)
        else:
            rejected_files.append(file.filename)

    return jsonify({
        "ok": True,
        "saved": saved_files,
        "rejected": rejected_files
    })


@app.route("/search", methods=["POST"])
def search():
    data = request.get_json(silent=True) or {}
    query = (data.get("query") or "").strip()
    pdf_choice = data.get("pdfChoice", "all")  # NEW

    if not query:
        return jsonify({"error": "Empty search query"}), 400

    results = []

    # Loop through all files
    for filename in os.listdir(app.config["UPLOAD_FOLDER"]):
        if not allowed_file(filename):
            continue

        # Filter by user's choice
        if pdf_choice != "all" and filename != pdf_choice:
            continue

        path = os.path.join(app.config["UPLOAD_FOLDER"], filename)

        try:
            text = extract_text(path)
        except:
            continue

        snippets = find_keyword_sentences(text, query)

        if snippets:
            results.append({
                "filename": filename,
                "snippets": snippets
            })

    return jsonify({
        "query": query,
        "results": results
    })

if __name__ == "__main__":
    # Run the app
    app.run(debug=True)
