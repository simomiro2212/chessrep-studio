-- ============================================================
-- ChessRep Studio – Schema SQL per Supabase
-- Incolla intero blocco nell'SQL Editor di Supabase ed esegui.
-- ============================================================

-- Tabella principale: un record per ogni apertura dell'utente.
-- I nodi dell'albero di varianti sono serializzati come JSONB
-- (struttura Record<string, MoveNode> identica al JSON locale).

CREATE TABLE IF NOT EXISTS public.openings (
  id          TEXT        PRIMARY KEY,            -- UUID generato lato client
  user_id     UUID        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name        TEXT        NOT NULL DEFAULT '',
  folder      TEXT        NOT NULL DEFAULT 'Generale',
  eco         TEXT        NOT NULL DEFAULT '',
  description TEXT        NOT NULL DEFAULT '',
  color       TEXT        NOT NULL CHECK (color IN ('white', 'black')),
  root_id     TEXT        NOT NULL,
  nodes       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indici utili per le query più frequenti
CREATE INDEX IF NOT EXISTS openings_user_id_idx ON public.openings (user_id);
CREATE INDEX IF NOT EXISTS openings_color_idx    ON public.openings (user_id, color);
CREATE INDEX IF NOT EXISTS openings_updated_at_idx ON public.openings (user_id, updated_at DESC);

-- Trigger per aggiornare updated_at automaticamente
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS openings_updated_at ON public.openings;
CREATE TRIGGER openings_updated_at
  BEFORE UPDATE ON public.openings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Row Level Security (RLS)
-- Ogni utente legge/scrive/elimina SOLO i propri record.
-- ============================================================
ALTER TABLE public.openings ENABLE ROW LEVEL SECURITY;

-- Lettura: solo i propri
DROP POLICY IF EXISTS "openings: select own" ON public.openings;
CREATE POLICY "openings: select own"
  ON public.openings FOR SELECT
  USING (auth.uid() = user_id);

-- Inserimento: solo con il proprio user_id
DROP POLICY IF EXISTS "openings: insert own" ON public.openings;
CREATE POLICY "openings: insert own"
  ON public.openings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Aggiornamento: solo i propri
DROP POLICY IF EXISTS "openings: update own" ON public.openings;
CREATE POLICY "openings: update own"
  ON public.openings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Eliminazione: solo i propri
DROP POLICY IF EXISTS "openings: delete own" ON public.openings;
CREATE POLICY "openings: delete own"
  ON public.openings FOR DELETE
  USING (auth.uid() = user_id);
