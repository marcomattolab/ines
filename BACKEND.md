# Backend MiniCPM Document Studio (integrato in INES)

Il backend OCR Edge AI ora vive **dentro questo repo**, così la vecchia
`minicpm-document-studio` può essere abbandonata. La UI è il tab **Documents**
di INES (`ines-ng/`).

## Struttura

```text
ines/
├── ines-ng/                  # frontend Angular 22 (tab Documents)
├── backend/                  # backend FastAPI
│   ├── app/main.py           # API + pipeline OCR
│   ├── requirements.txt
│   └── run.py
├── scripts/
│   ├── setup.sh              # installa backend / SDK / llm / office (idempotente)
│   ├── start_be.sh           # avvia OCR + backend insieme
│   ├── start_ocr.sh          # solo servizio di inferenza (porta 18499)
│   ├── start_backend.sh      # solo FastAPI (porta 8000)
│   ├── health.sh             # verifica i tre endpoint
│   └── migrate_assets.sh     # copia modelli/binari dalla vecchia repo
├── models/                   # (gitignored) modelli GGUF ~2 GB
├── tools/                    # (gitignored) binari llama.cpp
└── .minicpm-ocr/             # (gitignored) venv SDK MiniCPM-OCR
```

## Setup (una tantum)

```bash
cd /Users/marcomartorana/myMacDesktop/workspace/ines

# Opzione A — tutto da zero (riscarica i modelli ~2 GB):
./scripts/setup.sh all

# Opzione B — migra i modelli/binari dalla vecchia repo, poi ricrea i venv:
./scripts/migrate_assets.sh /Users/marcomartorana/Downloads/minicpm-document-studio
./scripts/setup.sh backend
./scripts/setup.sh sdk
./scripts/setup.sh office      # solo se converti file Office
```

> `setup.sh all` installa anche le dipendenze frontend di INES (`npm install`
> in `ines-ng/`).

## Avvio

```bash
cd /Users/marcomartorana/myMacDesktop/workspace/ines

# Terminale 1 — OCR + backend insieme
./scripts/start_be.sh

# Terminale 2 — frontend INES
cd ines-ng && npm start
```

Apri `http://localhost:4200` → tab **Documents**.

Servizi:

| Servizio | Porta | Endpoint |
|---|---|---|
| Inferenza OCR (llama.cpp) | `18499` | `http://127.0.0.1:18499/health` |
| Backend FastAPI | `8000` | `http://127.0.0.1:8000/api/health` |
| Frontend INES | `4200` | `http://localhost:4200` |

## Verifica

```bash
./scripts/health.sh
```

## Variabili d'ambiente (backend)

| Variabile | Default | Descrizione |
|---|---|---|
| `APP_HOST` / `APP_PORT` | `127.0.0.1` / `8000` | ascolto backend |
| `MINICPM_OCR_SERVER_URL` | `http://127.0.0.1:18499` | servizio di inferenza |
| `MINICPM_OCR_MODEL` | `minicpm-ocr` | nome modello |
| `MINICPM_OCR_BACKEND` | `llamacpp` | backend di inferenza |
| `MINICPM_OCR_DEVICE` | `cpu` (auto) | device layout detection |
| `MINICPM_DIAGRAM_MERMAID` | `1` | diagrammi → Mermaid (seconda passata) |

Gli script `start_be.sh` / `start_backend.sh` impostano già i valori corretti.

## Note integrazione INES

- Il backend ha **CORS** per `http://localhost:4200` e `http://127.0.0.1:4200`.
- Nel tab **Documents** l'URL del backend è configurabile (default
  `http://127.0.0.1:8000`) e salvato in `localStorage`.
- I file pesanti (`models/`, `tools/`, `.minicpm-ocr/`, `backend/.venv/`) sono
  **esclusi da git** (vedi `.gitignore`).

## Abbandono della vecchia repo

Dopo la migrazione e la verifica puoi eliminare la cartella:

```bash
rm -rf /Users/marcomartorana/Downloads/minicpm-document-studio
```

> Prima verifica che `models/` e `tools/` siano stati copiati correttamente in
> INES e che `./scripts/health.sh` risponda ✅.
