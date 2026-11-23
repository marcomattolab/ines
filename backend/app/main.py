from __future__ import annotations

import base64
import json
import os
import re
import shutil
import subprocess
import tempfile
import threading
import time
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

APP_NAME = "MiniCPM Document Studio"
HOST = os.getenv("APP_HOST", "127.0.0.1")
PORT = int(os.getenv("APP_PORT", "8000"))
OCR_COMMAND = os.getenv("MINICPM_OCR_COMMAND", "minicpmvocr")
OCR_SERVER_URL = os.getenv("MINICPM_OCR_SERVER_URL", "http://127.0.0.1:18499")
OCR_MODEL = os.getenv("MINICPM_OCR_MODEL", "minicpm-ocr")
OCR_DEVICE = os.getenv("MINICPM_OCR_DEVICE", "cpu")
OCR_BACKEND = os.getenv("MINICPM_OCR_BACKEND", "")

# Second pass: converte i diagrammi di flusso grafici (blocchi immagine) in Mermaid.
DIAGRAM_MERMAID_ENABLED = os.getenv("MINICPM_DIAGRAM_MERMAID", "0") == "1"
DIAGRAM_TIMEOUT = int(os.getenv("MINICPM_DIAGRAM_TIMEOUT", "120"))
# Endpoint/modello usati per la seconda passata (default: lo stesso dell'OCR).
DIAGRAM_SERVER_URL = os.getenv("MINICPM_DIAGRAM_SERVER_URL", OCR_SERVER_URL)
DIAGRAM_MODEL = os.getenv("MINICPM_DIAGRAM_MODEL", OCR_MODEL)

OCR_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".bmp", ".webp", ".tif", ".tiff", ".gif"}
OFFICE_EXTENSIONS = {".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".odt", ".ods", ".odp", ".rtf"}
TEXT_EXTENSIONS = {".txt", ".md", ".markdown", ".csv", ".json", ".xml", ".html", ".htm", ".log"}
SUPPORTED = OCR_EXTENSIONS | OFFICE_EXTENSIONS | TEXT_EXTENSIONS

app = FastAPI(title=APP_NAME, version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200", "http://127.0.0.1:4200"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

jobs: dict[str, dict[str, Any]] = {}
lock = threading.Lock()


class StartRequest(BaseModel):
    source_dir: str = Field(min_length=1)
    output_dir: str = Field(min_length=1)
    recursive: bool = True
    overwrite: bool = False


def _utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_child_name(path: Path, root: Path) -> Path:
    rel = path.relative_to(root)
    target = root / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    return target


def _to_markdown_text(source: Path, target: Path) -> None:
    ext = source.suffix.lower()
    raw = source.read_text(encoding="utf-8", errors="replace")
    if ext in {".md", ".markdown"}:
        content = raw
    elif ext == ".csv":
        rows = [line.split(",") for line in raw.splitlines() if line.strip()]
        if rows:
            width = max(map(len, rows))
            rows = [r + [""] * (width - len(r)) for r in rows]
            content = "| " + " | ".join(rows[0]) + " |\n| " + " | ".join(["---"] * width) + " |\n"
            content += "\n".join("| " + " | ".join(r) + " |" for r in rows[1:])
        else:
            content = ""
    elif ext in {".html", ".htm"}:
        content = re.sub(r"(?is)<(script|style).*?>.*?</\1>", "", raw)
        content = re.sub(r"(?i)<br\\s*/?>|</p>|</div>|</h[1-6]>", "\n", content)
        content = re.sub(r"<[^>]+>", " ", content)
        content = re.sub(r"&nbsp;", " ", content)
    else:
        language = {".json": "json", ".xml": "xml", ".log": "text"}.get(ext, "text")
        content = f"```{language}\n{raw}\n```"
    target.write_text(f"# {source.stem}\n\n{content}\n", encoding="utf-8")


def _convert_office_to_pdf(source: Path, temp_dir: Path) -> Path:
    executable = shutil.which("libreoffice") or shutil.which("soffice")
    if not executable:
        raise RuntimeError("LibreOffice non trovato: installalo per convertire documenti Office in PDF.")
    profile = Path(temp_dir) / "lo-profile"
    cmd = [executable, "-env:UserInstallation=" + profile.as_uri(), "--headless", "--convert-to", "pdf", "--outdir", temp_dir, str(source)]
    completed = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
    converted = Path(temp_dir) / f"{source.stem}.pdf"
    if completed.returncode != 0 or not converted.exists():
        raise RuntimeError((completed.stderr or completed.stdout or "Conversione LibreOffice fallita").strip())
    return converted


def _page_count(path: Path) -> int:
    """Numero di pagine atteso (0 = sconosciuto). PDF via pypdf, immagini = 1 pagina."""
    if path.suffix.lower() == ".pdf":
        try:
            from pypdf import PdfReader
            return max(len(PdfReader(str(path)).pages), 1)
        except Exception:
            return 0
    return 1


def _run_ocr(source: Path, markdown_target: Path, on_page=None) -> None:
    cmd = [OCR_COMMAND, "parse", str(source), "-o", str(markdown_target), "--server-url", OCR_SERVER_URL, "--model", OCR_MODEL, "--device", OCR_DEVICE]
    if OCR_BACKEND:
        cmd += ["--backend", OCR_BACKEND]

    run_tag = None
    pages_dir: Path | None = None
    total_pages = 0
    if on_page is not None:
        run_tag = f"job-{uuid.uuid4().hex[:8]}-{source.stem[:40]}"
        cmd += ["--run-tag", run_tag]
        pages_dir = Path(os.getenv("OCR_RUN_ROOT", ".")) / run_tag / "pages_json"
        total_pages = _page_count(source)

    stderr_f = tempfile.TemporaryFile(mode="w+")
    proc = subprocess.Popen(cmd, stdout=stderr_f, stderr=subprocess.STDOUT, text=True)

    if on_page is not None:
        done = 0
        on_page(done, total_pages)
        while proc.poll() is None:
            time.sleep(0.5)
            if pages_dir and pages_dir.exists():
                done = len(list(pages_dir.glob("*.json")))
                on_page(min(done, total_pages) if total_pages else done, total_pages)
        on_page(total_pages or done, total_pages)

    proc.wait(timeout=60 * 60)
    stderr_f.seek(0)
    output = stderr_f.read()
    stderr_f.close()
    if proc.returncode != 0:
        details = (output or "Errore MiniCPM-OCR").strip()
        raise RuntimeError(details[-3000:])
    if not markdown_target.exists():
        raise RuntimeError("MiniCPM-OCR ha terminato senza produrre il file Markdown atteso.")


_ARROW_LINE_RE = re.compile(r"^\s*[^->→⟶\n]+(?:\s*(?:-->|->|→|⟶)\s*[^->→⟶\n]+)+\s*$")


def _add_mermaid_if_possible(markdown: str) -> str:
    """Preserve OCR output; convert explicit arrow chains into a Mermaid flowchart."""
    if "```mermaid" in markdown.lower():
        return markdown
    edges: list[tuple[str, str]] = []
    for line in markdown.splitlines():
        if _ARROW_LINE_RE.match(line):
            edges.extend(_edges_from_arrow_text(line))
    if not edges:
        return markdown
    diagram = ["", "## Diagramma di flusso (ricostruito da frecce riconosciute)", "", "```mermaid", _render_mermaid(edges), "```", ""]
    return markdown.rstrip() + "\n" + "\n".join(diagram)


_IMAGE_REF_RE = re.compile(r"!\[[^\]]*\]\(([^)]+\.(?:png|jpe?g|webp|bmp))\)", re.IGNORECASE)
_ARROW_SPLIT_RE = re.compile(r"\s*(?:-->|->|→|⟶)\s*")
_NODE_SYNTAX_RE = re.compile(r"^[A-Za-z0-9_]+[\[({](.*)[\])}]$")


def _clean_node_label(label: str) -> str:
    label = label.strip().strip("`*_")
    match = _NODE_SYNTAX_RE.match(label)
    if match:
        label = match.group(1)
    return label.strip(" .;:\"'")


def _edges_from_arrow_text(text: str) -> list[tuple[str, str]]:
    edges: list[tuple[str, str]] = []
    for line in text.splitlines():
        parts = [_clean_node_label(p) for p in _ARROW_SPLIT_RE.split(line)]
        parts = [p for p in parts if p]
        for i in range(len(parts) - 1):
            edges.append((parts[i], parts[i + 1]))
    return edges


def _render_mermaid(edges: list[tuple[str, str]]) -> str:
    nodes: dict[str, str] = {}

    def node_id(label: str) -> str:
        if label not in nodes:
            nodes[label] = f"N{len(nodes) + 1}"
        return nodes[label]

    lines = ["flowchart LR"]
    for left, right in edges:
        lines.append(
            f'    {node_id(left)}["{left.replace(chr(34), chr(39))}"] --> '
            f'{node_id(right)}["{right.replace(chr(34), chr(39))}"]'
        )
    return "\n".join(lines)


def _extract_mermaid(raw: str) -> str | None:
    text = (raw or "").strip()
    if not text or text.upper().strip(" .") in {"NONE", "NO", "N/A"}:
        return None
    fenced = re.search(r"```[^\n]*\n(.*?)```", text, re.S)
    if fenced:
        text = fenced.group(1).strip()
    else:
        text = text.strip("` \n\t")
    if not any(token in text for token in ("-->", "->", "→", "⟶", "flowchart", "graph")):
        return None
    edges = _edges_from_arrow_text(text)
    if not edges:
        return None
    return _render_mermaid(edges)


def _diagram_image_to_mermaid(image_path: Path) -> str | None:
    """Chiede al servizio di inferenza se l'immagine è un diagramma e, se sì, lo rende Mermaid."""
    try:
        b64 = base64.b64encode(image_path.read_bytes()).decode("ascii")
    except OSError:
        return None
    prompt = (
        "You are analyzing an image extracted from a document. Decide whether it is a "
        "FLOWCHART: a diagram made of boxes or nodes connected by arrows, representing a "
        "process or sequence of steps. Bar charts, column charts, line charts, pie charts, "
        "plots, tables, photographs and logos are NOT flowcharts.\n"
        "If it is a flowchart, output ONLY a Mermaid diagram using `-->` arrows, for example:\n"
        "```mermaid\nflowchart LR\n    A[Start] --> B[End]\n```\n"
        "If it is NOT a flowchart, output exactly the single word: NONE"
    )
    payload = {
        "model": DIAGRAM_MODEL,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
                {"type": "text", "text": prompt},
            ],
        }],
        "max_tokens": 512,
        "temperature": 0.1,
        "stream": False,
    }
    try:
        req = urllib.request.Request(
            f"{DIAGRAM_SERVER_URL}/v1/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=DIAGRAM_TIMEOUT) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        content = (data.get("choices") or [{}])[0].get("message", {}).get("content", "")
    except Exception:
        return None
    return _extract_mermaid(content)


def _add_mermaid_from_diagrams(markdown: str, markdown_path: Path) -> str:
    """Per ogni blocco immagine, tenta di estrarne un flowchart Mermaid (seconda passata)."""
    base = markdown_path.parent

    def repl(match: re.Match) -> str:
        image = (base / match.group(1)).resolve()
        if not image.exists():
            return match.group(0)
        code = _diagram_image_to_mermaid(image)
        if not code:
            return match.group(0)
        return (
            f"{match.group(0)}\n\n"
            f"## Diagramma di flusso (dal diagramma)\n\n"
            f"```mermaid\n{code}\n```\n"
        )

    return _IMAGE_REF_RE.sub(repl, markdown)


def _process_job(job_id: str, request: StartRequest) -> None:
    with lock:
        job = jobs[job_id]
        job["status"] = "running"
        job["started_at"] = _utc()
    source_root = Path(request.source_dir).expanduser().resolve()
    output_root = Path(request.output_dir).expanduser().resolve()
    try:
        if not source_root.exists() or not source_root.is_dir():
            raise ValueError("La cartella sorgente non esiste o non è una directory.")
        if source_root == output_root or source_root in output_root.parents:
            raise ValueError("La cartella di destinazione non può coincidere con la sorgente né trovarsi al suo interno.")
        output_root.mkdir(parents=True, exist_ok=True)
        iterator = source_root.rglob("*") if request.recursive else source_root.glob("*")
        files = sorted(p for p in iterator if p.is_file() and p.suffix.lower() in SUPPORTED and not any(part.startswith(".") for part in p.relative_to(source_root).parts))
        with lock:
            job["total"] = len(files)
            job["message"] = f"Trovati {len(files)} documenti supportati"
            job["files"] = [{"file": str(p.relative_to(source_root)), "status": "pending"} for p in files]
        if not files:
            raise ValueError("Nessun documento supportato trovato nella cartella selezionata.")

        def on_page(done: int, total: int) -> None:
            with lock:
                job["pages_done"] = done
                job["pages_total"] = total

        for index, source in enumerate(files, start=1):
            rel = source.relative_to(source_root)
            target = (output_root / rel).with_suffix(".md")
            target.parent.mkdir(parents=True, exist_ok=True)
            with lock:
                job["current_file"] = str(rel)
                job["message"] = f"Elaborazione {index}/{len(files)}: {rel}"
                job["files"][index - 1]["status"] = "processing"
                job["pages_done"] = 0
                job["pages_total"] = 0
            if target.exists() and not request.overwrite:
                with lock:
                    job["skipped"] += 1
                    job["completed"] = index
                    job["files"][index - 1]["status"] = "skipped"
                continue
            try:
                if source.suffix.lower() in TEXT_EXTENSIONS:
                    _to_markdown_text(source, target)
                else:
                    with tempfile.TemporaryDirectory(prefix="minicpm-doc-") as temp_dir:
                        input_for_ocr = _convert_office_to_pdf(source, temp_dir) if source.suffix.lower() in OFFICE_EXTENSIONS else source
                        _run_ocr(input_for_ocr, target, on_page=on_page)
                    text = target.read_text(encoding="utf-8", errors="replace")
                    text = _add_mermaid_if_possible(text)
                    if DIAGRAM_MERMAID_ENABLED:
                        text = _add_mermaid_from_diagrams(text, target)
                    target.write_text(text, encoding="utf-8")
                with lock:
                    job["succeeded"] += 1
                    job["files"][index - 1]["status"] = "done"
            except Exception as exc:
                with lock:
                    job["failed"] += 1
                    job["errors"].append({"file": str(rel), "error": str(exc)})
                    job["files"][index - 1]["status"] = "error"
            with lock:
                job["completed"] = index
        with lock:
            job["status"] = "completed" if job["failed"] == 0 else "completed_with_errors"
            job["message"] = "Elaborazione completata"
            job["finished_at"] = _utc()
    except Exception as exc:
        with lock:
            job["status"] = "failed"
            job["message"] = str(exc)
            job["finished_at"] = _utc()


@app.get("/api/health")
def health():
    cli = shutil.which(OCR_COMMAND)
    return {
        "status": "ok",
        "ocr_command": OCR_COMMAND,
        "ocr_cli_available": bool(cli),
        "ocr_server_url": OCR_SERVER_URL,
        "ocr_model": OCR_MODEL,
        "ocr_device": OCR_DEVICE,
        "ocr_backend": OCR_BACKEND or "vllm",
        "diagram_mermaid_enabled": DIAGRAM_MERMAID_ENABLED,
        "diagram_server_url": DIAGRAM_SERVER_URL,
        "diagram_model": DIAGRAM_MODEL,
        "libreoffice_available": bool(shutil.which("libreoffice") or shutil.which("soffice")),
    }


@app.post("/api/jobs", status_code=202)
def start_job(request: StartRequest):
    source = Path(request.source_dir).expanduser()
    if not source.exists() or not source.is_dir():
        raise HTTPException(status_code=400, detail="Cartella sorgente non valida o non accessibile.")
    job_id = str(uuid.uuid4())
    with lock:
        jobs[job_id] = {
            "id": job_id, "status": "queued", "message": "Job in coda", "source_dir": str(source.resolve()),
            "output_dir": str(Path(request.output_dir).expanduser().resolve()), "total": 0, "completed": 0,
            "succeeded": 0, "failed": 0, "skipped": 0, "current_file": None, "errors": [], "created_at": _utc(),
            "pages_done": 0, "pages_total": 0, "files": [],
        }
    thread = threading.Thread(target=_process_job, args=(job_id, request), daemon=True)
    thread.start()
    return {"id": job_id, "status": "queued"}


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str):
    with lock:
        job = jobs.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job non trovato")
        return dict(job)
