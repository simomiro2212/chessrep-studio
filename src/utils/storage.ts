import { createDefaultSampleRepertoire } from '../data/sampleRepertoire';
import type { OpeningRepertoire, RepertoireDatabase } from '../types/repertoire';

const STORAGE_KEY = 'chessrep_studio_db_v1';
const IDB_NAME = 'chessrep_studio_idb';
const IDB_STORE = 'repertoires';

function isValidOpening(item: unknown): item is OpeningRepertoire {
  if (!item || typeof item !== 'object') return false;
  const op = item as Partial<OpeningRepertoire>;
  return (
    typeof op.id === 'string' &&
    typeof op.name === 'string' &&
    (op.color === 'white' || op.color === 'black') &&
    typeof op.rootId === 'string' &&
    typeof op.nodes === 'object' &&
    op.nodes !== null &&
    op.rootId in op.nodes
  );
}

export function loadRepertoiresSync(): OpeningRepertoire[] {
  if (typeof window === 'undefined') {
    return createDefaultSampleRepertoire();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const defaults = createDefaultSampleRepertoire();
      saveRepertoiresSync(defaults);
      return defaults;
    }
    const parsed = JSON.parse(raw) as Partial<RepertoireDatabase>;
    if (Array.isArray(parsed.openings)) {
      return parsed.openings.filter(isValidOpening);
    }
  } catch {
    // Fallback al repertorio di esempio in caso di dati corrotti
  }
  const defaults = createDefaultSampleRepertoire();
  saveRepertoiresSync(defaults);
  return defaults;
}

export function saveRepertoiresSync(openings: OpeningRepertoire[]): void {
  if (typeof window === 'undefined') return;

  const payload: RepertoireDatabase = {
    version: 1,
    exportedAt: new Date().toISOString(),
    openings,
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Se localStorage supera la quota, IndexedDB mantiene comunque la copia
  }

  void saveToIndexedDB(payload);
}

async function saveToIndexedDB(payload: RepertoireDatabase): Promise<void> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return;
  try {
    const req = window.indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(payload, 'current');
      tx.oncomplete = () => db.close();
    };
  } catch {
    // IndexedDB opzionale
  }
}

export function exportDatabaseToJson(openings: OpeningRepertoire[]): string {
  const payload: RepertoireDatabase = {
    version: 1,
    exportedAt: new Date().toISOString(),
    openings,
  };
  return JSON.stringify(payload, null, 2);
}

export function parseDatabaseFromJson(jsonText: string): OpeningRepertoire[] {
  const parsed = JSON.parse(jsonText) as unknown;
  if (Array.isArray(parsed)) {
    const valid = parsed.filter(isValidOpening);
    if (valid.length === 0) throw new Error('Nessuna apertura valida trovata nel file JSON.');
    return valid;
  }
  if (parsed && typeof parsed === 'object' && 'openings' in parsed) {
    const db = parsed as Partial<RepertoireDatabase>;
    if (!Array.isArray(db.openings)) {
      throw new Error('Il campo "openings" non è un array valido.');
    }
    const valid = db.openings.filter(isValidOpening);
    if (valid.length === 0) throw new Error('Nessuna apertura valida trovata nel file JSON.');
    return valid;
  }
  throw new Error('Formato JSON non riconosciuto. Usa un export di ChessRep Studio.');
}

export function downloadTextFile(filename: string, content: string, mimeType = 'application/json') {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
