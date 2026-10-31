# INES — Prossimi passi (Spese Casa)

> Roadmap dei prossimi sviluppi per la tab **Spese** (dashboard delle spese domestiche).
> Le funzionalità già completate (agente SLM, scansione email/PDF/OCR, Telegram, MD mensile,
> ammortamento bimestrale/annuale, budget, vista annuale, auto-scan, badge sidebar) sono
> operative; qui sotto solo le evoluzioni future.

## 1. Filtro / ordinamento avanzato della lista spese

- Ordinamento della lista per **data**, **importo** o **categoria** (ascendente/discendente).
- Filtri combinabili: categoria singola o multipla, intervallo di date.
- Integrazione con la ricerca testuale già presente (`searchQuery`).

## 2. Export CSV

- Esportazione **mensile** e **annuale** in formato CSV, oltre a MD e JSON già esistenti.
- Colonne previste: `data`, `categoria`, `descrizione`, `fornitore`, `importo`,
  `quota mensile`, `frequenza`, `fonte`, `allegato`.
- Riutilizzare `DomUtilsService.saveTextFile` con MIME `text/csv` (già predisposto per il
  selettore file nativo con fallback al download).

## 3. Grafico a torta / donut per le categorie

- Vista a torta (o donut) della ripartizione delle spese **per categoria** su mese/anno.
- Implementazione in **SVG nativo** (nessuna dipendenza aggiuntiva), coerente con il design
  e i token esistenti.
- Tooltip con importo e percentuale, colori per categoria già definiti in
  `EXPENSE_CATEGORIES`.

## 4. Scadenzario delle bollette ricorrenti + promemoria

- Vista **"Scadenzario"** che elenca le prossime scadenze delle spese ricorrenti
  (mensili / bimestrali / trimestrali / annuali) a partire dalla data dell'ultima spesa.
- Indicazione dei **giorni mancanti** alla scadenza e stato (in scadenza / scaduta).
- Integrazione con `ReminderService` già presente per notifiche/promemoria vocali o toast.

## Backlog minore (facoltativo)

- Riconciliazione manuale: unire/collegare due spese duplicate rilevate da fonti diverse.
- Statistiche "mese su mese" per categoria (variazione percentuale).
- Note e tag personalizzati sulle spese.
- Esportazione di tutti i mesi in un unico file MD (già parzialmente coperto dalla vista
  annuale e dall'export annuale).
