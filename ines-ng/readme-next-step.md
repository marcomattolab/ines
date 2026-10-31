# INES — Prossimi passi (Spese Casa)

> Roadmap dei prossimi sviluppi per la tab **Spese** (dashboard delle spese domestiche).
> Le funzionalità già completate (agente SLM, scansione email/PDF/OCR, Telegram, MD mensile,
> ammortamento bimestrale/annuale, budget, vista annuale, auto-scan, badge sidebar) sono
> operative; qui sotto solo le evoluzioni future.

## Completate (ultimo ciclo)

- **Filtro / ordinamento avanzato** della lista spese: ordinamento per data, importo o categoria
  (asc/disc), filtro per categoria singola/multipla, intervallo di date, integrato con la ricerca
  testuale (`searchQuery`) e pulsante di reset.
- **Export CSV** mensile e annuale (`downloadMonthCsv` / `downloadYearCsv`), con colonne
  `mese` (solo anno), `data`, `categoria`, `descrizione`, `fornitore`, `importo`, `quota mensile`,
  `frequenza`, `fonte`, `allegato`; riusano `DomUtilsService.saveTextFile` con MIME `text/csv`.
- **Grafico donut** in SVG nativo (nessuna dipendenza) per la ripartizione per categoria su
  mese/anno, con tooltip importo + percentuale, colori per categoria (`donutColors`) e legenda.
- **Scadenzario** delle bollette ricorrenti: prossime scadenze con giorni mancanti, stato
  (`scaduta` / `in scadenza` / `prossima`) e promemoria integrato con `ReminderService`.
- **Scansione email paginata**: etichette Gmail configurabili (es. `scontrini`), numero massimo di
  email per scansione e scorrimento di tutta la cronologia via `pageToken`.
- **Nuclei familiari**: configurazione di più nuclei (nome, componenti, indirizzi di fatturazione),
  attribuzione automatica della spesa al nucleo via LLM (persona/indirizzo), filtro per nucleo in
  dashboard, colonna `nucleo` in MD/CSV e **budget separato per nucleo**.

## Backlog (facoltativo)

- Riconciliazione manuale: unire/collegare due spese duplicate rilevate da fonti diverse.
- Statistiche "mese su mese" per categoria (variazione percentuale).
- Note e tag personalizzati sulle spese.
- Esportazione di tutti i mesi in un unico file MD (già parzialmente coperto dalla vista
  annuale e dall'export annuale).
