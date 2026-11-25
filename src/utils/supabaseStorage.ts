import type { OpeningRepertoire } from '../types/repertoire';
import { supabase } from './supabaseClient';
import {
  loadRepertoiresSync,
  exportDatabaseToJson,
  parseDatabaseFromJson,
} from './storage';

// ─── Tipi ────────────────────────────────────────────────────────────────────

interface DbRow {
  id: string;
  user_id: string;
  name: string;
  folder: string;
  eco: string;
  description: string;
  color: 'white' | 'black';
  root_id: string;
  nodes: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ─── Conversioni db ↔ app ────────────────────────────────────────────────────

function rowToOpening(row: DbRow): OpeningRepertoire {
  return {
    id: row.id,
    name: row.name,
    folder: row.folder,
    eco: row.eco,
    description: row.description,
    color: row.color,
    rootId: row.root_id,
    nodes: row.nodes as OpeningRepertoire['nodes'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function openingToRow(op: OpeningRepertoire, userId: string): Omit<DbRow, 'user_id'> & { user_id: string } {
  return {
    id: op.id,
    user_id: userId,
    name: op.name,
    folder: op.folder,
    eco: op.eco ?? '',
    description: op.description ?? '',
    color: op.color,
    root_id: op.rootId,
    nodes: op.nodes as Record<string, unknown>,
    created_at: op.createdAt,
    updated_at: op.updatedAt,
  };
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

/** Carica tutte le aperture dell'utente autenticato dal DB. */
export async function fetchOpeningsFromDb(): Promise<OpeningRepertoire[]> {
  const { data, error } = await supabase
    .from('openings')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[Supabase] fetchOpenings:', error.message);
    return [];
  }

  return (data as DbRow[]).map(rowToOpening);
}

/** Upsert (inserisce o aggiorna) una singola apertura. */
export async function upsertOpeningToDb(
  opening: OpeningRepertoire,
  userId: string
): Promise<boolean> {
  const row = openingToRow(opening, userId);

  const { error } = await supabase
    .from('openings')
    .upsert(row, { onConflict: 'id' });

  if (error) {
    console.error('[Supabase] upsertOpening:', error.message);
    return false;
  }
  return true;
}

/** Elimina una singola apertura per ID. */
export async function deleteOpeningFromDb(openingId: string): Promise<boolean> {
  const { error } = await supabase
    .from('openings')
    .delete()
    .eq('id', openingId);

  if (error) {
    console.error('[Supabase] deleteOpening:', error.message);
    return false;
  }
  return true;
}

/** Upsert batch: sostituisce tutte le aperture dell'utente sul DB con la lista passata. */
export async function replaceAllOpeningsInDb(
  openings: OpeningRepertoire[],
  userId: string
): Promise<boolean> {
  // Svuota prima tutto quello che appartiene all'utente
  const { error: delError } = await supabase
    .from('openings')
    .delete()
    .eq('user_id', userId);

  if (delError) {
    console.error('[Supabase] replaceAll (delete):', delError.message);
    return false;
  }

  if (openings.length === 0) return true;

  const rows = openings.map((op) => openingToRow(op, userId));
  const { error: insertError } = await supabase.from('openings').insert(rows);

  if (insertError) {
    console.error('[Supabase] replaceAll (insert):', insertError.message);
    return false;
  }
  return true;
}

// ─── Migrazione localStorage → DB ────────────────────────────────────────────

/** Rileva se il localStorage contiene aperture non ancora sincronizzate. */
export function detectLocalRepertoire(): OpeningRepertoire[] {
  if (typeof window === 'undefined') return [];
  try {
    return loadRepertoiresSync();
  } catch {
    return [];
  }
}

/** Carica le aperture dal localStorage nel DB (chiamata una-tantum al primo login). */
export async function migrateLocalToCloud(userId: string): Promise<number> {
  const local = detectLocalRepertoire();
  if (local.length === 0) return 0;

  const rows = local.map((op) => openingToRow(op, userId));

  // Usa upsert per non sovrascrivere aperture già esistenti nel cloud
  const { error } = await supabase
    .from('openings')
    .upsert(rows, { onConflict: 'id', ignoreDuplicates: true });

  if (error) {
    console.error('[Supabase] migrateLocalToCloud:', error.message);
    return 0;
  }

  return local.length;
}

// ─── Export/Import JSON (cloud-aware) ────────────────────────────────────────

export function buildExportJson(openings: OpeningRepertoire[]): string {
  return exportDatabaseToJson(openings);
}

export { parseDatabaseFromJson };
