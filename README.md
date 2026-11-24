# ChessRep Studio

Applicazione web interattiva per costruire, annotare e allenare il proprio repertorio personale di aperture scacchistiche (ispirata a Chessreps.com).

## Funzionalità principali
- **Gestione Repertorio Bianco vs Nero** organizzata per cartelle, con codice ECO e statistiche.
- **Modalità Editor** con albero delle varianti dinamico (`Record<string, MoveNode>`):
  - Creazione automatica di sottovarianti quando si torna indietro su una posizione e si gioca una mossa alternativa (zero duplicati sulle mosse già esistenti).
  - Editor di **commenti strategici** per ogni singola mossa e **rinomina/promozione/eliminazione** delle linee.
  - Import/Export completo in **JSON** (schema formale in `schemas/repertoire.schema.json`) e **PGN** (con supporto a varianti ricorsive e commenti `{...}`).
- **Modalità Allenamento (stile Chessreps)**:
  - **Allenamento Mirato**: singola apertura o singola variante, con opzione di ripetizione in loop.
  - **Allenamento Globale Casuale (Shuffle)**: mescola tutte le linee (filtrabili per Bianco, Nero o Entrambi).
  - **Feedback immediato**: risposta automatica dell'avversario, bordo rosso e freccia verde in caso di errore con possibilità di riprovare, visualizzazione dei commenti strategici durante l'esercizio, contatore `Linea X di Y`, accuratezza e serie.
- **Effetti sonori** sintetizzati via Web Audio API (mossa, cattura, scacco, successo, errore).
- **Persistenza locale immediata** tramite `localStorage` + backup asincrono su `IndexedDB`.

## Avvio locale

Assicurati di avere [Node.js](https://nodejs.org/) (v18+) installato:

```bash
npm install
npm run dev
```

Poi apri l'URL mostrato da Vite (tipicamente `http://localhost:5173`).
