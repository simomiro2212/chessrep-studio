import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  Cloud,
  Crown,
  Download,
  Dumbbell,
  HardDrive,
  LogOut,
  Menu,
  Palette,
  PencilRuler,
  Upload,
  UserIcon,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { BOARD_THEMES } from './components/BoardThemes';
import { EditorView } from './components/EditorView';
import { ImportPgnModal, NewOpeningModal } from './components/Modals';
import { RepertoireSidebar } from './components/RepertoireSidebar';
import { TrainingView } from './components/TrainingView';
import { AuthModal } from './components/AuthModal';
import { MigrationBanner } from './components/MigrationBanner';
import { createDefaultSampleRepertoire } from './data/sampleRepertoire';
import type {
  AppMode,
  BoardThemeKey,
  OpeningRepertoire,
  RepertoireColor,
  TrainingLine,
  TrainingSubMode,
} from './types/repertoire';
import { importPgnIntoOpening } from './utils/pgn';
import { soundEngine } from './utils/sound';
import {
  downloadTextFile,
  loadRepertoiresSync,
  parseDatabaseFromJson,
} from './utils/storage';
import {
  fetchOpeningsFromDb,
  upsertOpeningToDb,
  deleteOpeningFromDb,
  replaceAllOpeningsInDb,
  migrateLocalToCloud,
  detectLocalRepertoire,
  buildExportJson,
} from './utils/supabaseStorage';
import { supabase } from './utils/supabaseClient';
import { createEmptyOpening } from './utils/tree';

// ─── Costanti ───────────────────────────────────────────────────────────────
const MIGRATION_DISMISSED_KEY = 'chessrep_migration_dismissed_v1';

export function App() {
  // ─── Auth ──────────────────────────────────────────────────────────────────
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // ─── Dati repertorio ───────────────────────────────────────────────────────
  const [openings, setOpenings] = useState<OpeningRepertoire[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // ─── Migrazione localStorage → cloud ──────────────────────────────────────
  const [showMigrationBanner, setShowMigrationBanner] = useState(false);
  const [migrating, setMigrating] = useState(false);

  // ─── UI state ─────────────────────────────────────────────────────────────
  const [activeColorTab, setActiveColorTab] = useState<RepertoireColor>('white');
  const [selectedOpeningId, setSelectedOpeningId] = useState<string | null>(null);
  const [mode, setMode] = useState<AppMode>('editor');
  const [trainingLaunch, setTrainingLaunch] = useState<{
    subMode: TrainingSubMode;
    openingId: string | null;
    lineId: string | null;
    nonce: number;
  }>({ subMode: 'targeted', openingId: null, lineId: null, nonce: 0 });

  const [muted, setMuted] = useState(false);
  const [boardTheme, setBoardTheme] = useState<BoardThemeKey>('emerald');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [importPgnOpen, setImportPgnOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const dashboardJsonInputRef = useRef<HTMLInputElement>(null);
  const toastTimerRef = useRef<number | null>(null);

  // ─── Supabase auth listener ────────────────────────────────────────────────
  useEffect(() => {
    // Sessione iniziale
    void supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    // Listener per login/logout in tempo reale
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => { listener.subscription.unsubscribe(); };
  }, []);

  // ─── Caricamento dati (dipende da user) ───────────────────────────────────
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      // Non autenticato: carica da localStorage (fallback offline)
      const local = loadRepertoiresSync();
      setOpenings(local);
      setSelectedOpeningId(local[0]?.id ?? null);
      return;
    }

    // Autenticato: carica dal DB
    setDataLoading(true);
    fetchOpeningsFromDb().then((dbOpenings) => {
      if (dbOpenings.length > 0) {
        setOpenings(dbOpenings);
        setSelectedOpeningId(dbOpenings[0]?.id ?? null);
        setShowMigrationBanner(false);
      } else {
        // DB vuoto: controlla se c'è un repertorio locale da migrare
        const local = detectLocalRepertoire();
        const dismissed = localStorage.getItem(MIGRATION_DISMISSED_KEY) === '1';
        if (local.length > 0 && !dismissed) {
          setShowMigrationBanner(true);
          setOpenings(local); // mostra comunque i dati locali nell'attesa
          setSelectedOpeningId(local[0]?.id ?? null);
        } else {
          // DB vuoto e nessun locale: mostra aperture di esempio
          const defaults = createDefaultSampleRepertoire();
          setOpenings(defaults);
          setSelectedOpeningId(defaults[0]?.id ?? null);
        }
      }
      setDataLoading(false);
    });
  }, [user, authLoading]);

  useEffect(() => { soundEngine.setMuted(muted); }, [muted]);

  // ─── Toast helper ─────────────────────────────────────────────────────────
  const showToast = useCallback((msg: string, duration = 3000) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), duration);
  }, []);

  // ─── Persist helpers ──────────────────────────────────────────────────────
  /**
   * Aggiorna lo stato locale e, se autenticato, esegue l'upsert sul DB.
   * Non blocca la UI: aggiornamento ottimistico.
   */
  const persistOpening = useCallback(
    (updated: OpeningRepertoire) => {
      setOpenings((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      if (user) {
        void upsertOpeningToDb(updated, user.id);
      }
    },
    [user]
  );

  // ─── CRUD Aperture ────────────────────────────────────────────────────────
  const handleUpdateOpening = useCallback(
    (updated: OpeningRepertoire) => { persistOpening(updated); },
    [persistOpening]
  );

  const handleCreateOpening = useCallback(
    (data: {
      name: string;
      color: RepertoireColor;
      folder: string;
      eco: string;
      description: string;
    }) => {
      const created = createEmptyOpening(data);
      setOpenings((prev) => [created, ...prev]);
      setActiveColorTab(created.color);
      setSelectedOpeningId(created.id);
      setMode('editor');
      if (user) {
        void upsertOpeningToDb(created, user.id);
      }
      showToast(`Apertura "${created.name}" creata.`);
    },
    [user, showToast]
  );

  const handleImportPgn = useCallback(
    (data: { pgn: string; name: string; color: RepertoireColor; folder: string }) => {
      const imported = importPgnIntoOpening(data.pgn, {
        name: data.name,
        color: data.color,
        folder: data.folder,
      });
      setOpenings((prev) => [imported, ...prev]);
      setActiveColorTab(imported.color);
      setSelectedOpeningId(imported.id);
      setMode('editor');
      if (user) {
        void upsertOpeningToDb(imported, user.id);
      }
      showToast(`PGN importato in "${imported.name}".`);
    },
    [user, showToast]
  );

  const handleDeleteOpening = useCallback(
    (openingId: string) => {
      const target = openings.find((o) => o.id === openingId);
      if (!target) return;
      if (!window.confirm(`Eliminare "${target.name}"?`)) return;

      const remaining = openings.filter((o) => o.id !== openingId);
      setOpenings(remaining);
      if (selectedOpeningId === openingId) {
        const fallback =
          remaining.find((o) => o.color === activeColorTab) ?? remaining[0] ?? null;
        setSelectedOpeningId(fallback?.id ?? null);
      }
      if (user) {
        void deleteOpeningFromDb(openingId);
      }
      showToast(`Apertura "${target.name}" eliminata.`);
    },
    [openings, selectedOpeningId, activeColorTab, user, showToast]
  );

  // ─── Export / Import JSON ─────────────────────────────────────────────────
  const handleExportJson = useCallback(() => {
    const json = buildExportJson(openings);
    const date = new Date().toISOString().slice(0, 10);
    downloadTextFile(`chessrep-studio-${date}.json`, json);
    showToast('Backup JSON esportato.');
  }, [openings, showToast]);

  const handleImportJson = useCallback(
    async (jsonText: string) => {
      try {
        const imported = parseDatabaseFromJson(jsonText);
        setOpenings(imported);
        setSelectedOpeningId(imported[0]?.id ?? null);
        if (imported[0]) setActiveColorTab(imported[0].color);

        if (user) {
          await replaceAllOpeningsInDb(imported, user.id);
        }
        showToast(`Importate ${imported.length} aperture dal backup JSON.`);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Errore importazione JSON.');
      }
    },
    [user, showToast]
  );

  const handleResetSamples = useCallback(async () => {
    if (!window.confirm('Ripristinare il repertorio di esempio?')) return;
    const defaults = createDefaultSampleRepertoire();
    setOpenings(defaults);
    setActiveColorTab('white');
    setSelectedOpeningId(defaults[0]?.id ?? null);
    setMode('editor');
    if (user) {
      await replaceAllOpeningsInDb(defaults, user.id);
    }
    showToast('Repertorio di esempio ripristinato.');
  }, [user, showToast]);

  // ─── Migrazione locale → cloud ────────────────────────────────────────────
  const handleMigrateToCloud = useCallback(async () => {
    if (!user) return;
    setMigrating(true);
    const count = await migrateLocalToCloud(user.id);
    setMigrating(false);
    setShowMigrationBanner(false);
    localStorage.setItem(MIGRATION_DISMISSED_KEY, '1');
    if (count > 0) {
      const refreshed = await fetchOpeningsFromDb();
      setOpenings(refreshed);
      setSelectedOpeningId(refreshed[0]?.id ?? null);
      showToast(`${count} aperture importate nel cloud con successo!`, 4000);
    } else {
      showToast('Nessuna apertura locale trovata da migrare.');
    }
  }, [user, showToast]);

  const dismissMigrationBanner = useCallback(() => {
    setShowMigrationBanner(false);
    localStorage.setItem(MIGRATION_DISMISSED_KEY, '1');
  }, []);

  // ─── Logout ───────────────────────────────────────────────────────────────
  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    // Torna ai dati locali dopo il logout
    const local = loadRepertoiresSync();
    setOpenings(local);
    setSelectedOpeningId(local[0]?.id ?? null);
    showToast('Logout effettuato.');
  }, [showToast]);

  // ─── Navigazione ──────────────────────────────────────────────────────────
  const handleChangeColorTab = (color: RepertoireColor) => {
    setActiveColorTab(color);
    if (!selectedOpening || selectedOpening.color !== color) {
      const firstOfColor = openings.find((o) => o.color === color);
      if (firstOfColor) setSelectedOpeningId(firstOfColor.id);
    }
  };

  const handleSelectOpening = (openingId: string) => {
    setSelectedOpeningId(openingId);
    const op = openings.find((o) => o.id === openingId);
    if (op) setActiveColorTab(op.color);
    setMode('editor');
  };

  const launchTargetedTraining = (openingId: string, specificLine?: TrainingLine) => {
    setTrainingLaunch((prev) => ({
      subMode: 'targeted',
      openingId,
      lineId: specificLine?.id ?? null,
      nonce: prev.nonce + 1,
    }));
    setMode('training');
  };

  const cycleBoardTheme = () => {
    const keys = Object.keys(BOARD_THEMES) as BoardThemeKey[];
    const next = keys[(keys.indexOf(boardTheme) + 1) % keys.length];
    setBoardTheme(next);
    showToast(`Tema: ${BOARD_THEMES[next].label}`);
  };

  const selectedOpening = useMemo(
    () => openings.find((o) => o.id === selectedOpeningId) ?? null,
    [openings, selectedOpeningId]
  );

  const existingFolders = useMemo(() => {
    const set = new Set<string>();
    for (const op of openings) { if (op.folder) set.add(op.folder); }
    return Array.from(set);
  }, [openings]);

  const localCount = useMemo(() => detectLocalRepertoire().length, []);

  // ─── Loading spinner ───────────────────────────────────────────────────────
  if (authLoading || dataLoading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#161512] text-stone-100">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/20">
          <Crown className="h-6 w-6 text-stone-950" />
        </div>
        <p className="text-sm text-stone-400">
          {authLoading ? 'Verifica sessione...' : 'Caricamento repertorio...'}
        </p>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#161512] text-stone-100">
      {/* ── Top Navbar ──────────────────────────────────────────────────────── */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#32302a] bg-[#1e1d1a] px-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen((s) => !s)}
            className="rounded-xl border border-[#32302a] bg-[#242320] p-2 text-stone-300 transition hover:bg-[#2d2b27]"
          >
            {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>

          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-stone-950 shadow-md shadow-emerald-500/20">
              <Crown className="h-4 w-4" />
            </div>
            <span className="text-sm font-bold tracking-tight text-stone-100">
              ChessRep <span className="text-emerald-400">Studio</span>
            </span>
            {/* Indicatore sync cloud */}
            {user && (
              <span className="hidden items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400 sm:flex">
                <Cloud className="h-3 w-3" />
                Cloud
              </span>
            )}
          </div>
        </div>

        {/* Switch Editor / Allenamento */}
        <div className="flex items-center gap-1 rounded-xl bg-[#161512] p-1 ring-1 ring-[#32302a]">
          <button
            type="button"
            onClick={() => setMode('editor')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              mode === 'editor'
                ? 'bg-emerald-500 text-stone-950 shadow-sm'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <PencilRuler className="h-3.5 w-3.5" />
            Editor
          </button>
          <button
            type="button"
            onClick={() => {
              setTrainingLaunch((prev) => ({
                subMode: prev.subMode,
                openingId: selectedOpening?.id ?? null,
                lineId: null,
                nonce: prev.nonce + 1,
              }));
              setMode('training');
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              mode === 'training'
                ? 'bg-emerald-500 text-stone-950 shadow-sm'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Dumbbell className="h-3.5 w-3.5" />
            Allenamento
          </button>
        </div>

        {/* Destra: tema, audio, auth */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={cycleBoardTheme}
            title={`Tema: ${BOARD_THEMES[boardTheme].label}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#32302a] bg-[#242320] px-2.5 py-1.5 text-xs font-medium text-stone-300 transition hover:bg-[#2d2b27]"
          >
            <Palette className="h-3.5 w-3.5 text-emerald-400" />
            <span className="hidden md:inline">{BOARD_THEMES[boardTheme].label}</span>
          </button>

          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            className="rounded-xl border border-[#32302a] bg-[#242320] p-2 text-stone-300 transition hover:bg-[#2d2b27]"
          >
            {muted ? (
              <VolumeX className="h-4 w-4 text-rose-400" />
            ) : (
              <Volume2 className="h-4 w-4 text-emerald-400" />
            )}
          </button>

          {user ? (
            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-1.5 rounded-xl border border-[#32302a] bg-[#242320] px-2.5 py-1.5 md:flex">
                <UserIcon className="h-3.5 w-3.5 text-emerald-400" />
                <span className="max-w-[140px] truncate text-xs font-medium text-stone-200">
                  {user.email}
                </span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                title="Logout"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#32302a] bg-[#242320] px-2.5 py-1.5 text-xs font-medium text-rose-400 transition hover:border-rose-500/40 hover:bg-rose-500/10"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/50 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
            >
              <UserIcon className="h-3.5 w-3.5" />
              Accedi
            </button>
          )}
        </div>
      </header>

      {/* ── Main Content ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen && (
          <div className="w-72 shrink-0 overflow-hidden sm:w-80">
            <RepertoireSidebar
              openings={openings}
              activeColorTab={activeColorTab}
              selectedOpeningId={selectedOpeningId}
              onChangeColorTab={handleChangeColorTab}
              onSelectOpening={handleSelectOpening}
              onTrainOpening={(id) => launchTargetedTraining(id)}
              onDeleteOpening={handleDeleteOpening}
              onOpenNewModal={() => setNewModalOpen(true)}
              onOpenImportPgnModal={() => setImportPgnOpen(true)}
              onExportJson={handleExportJson}
              onImportJson={(text) => { void handleImportJson(text); }}
              onResetSamples={() => { void handleResetSamples(); }}
            />
          </div>
        )}

        <main className="flex flex-1 flex-col overflow-y-auto p-4 sm:p-6">
          {/* ── Barra Backup + Cloud ──────────────────────────────────────── */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#32302a] bg-[#1e1d1a] px-4 py-2.5">
            <div className="flex items-center gap-2 text-xs text-stone-400">
              {user ? (
                <>
                  <Cloud className="h-4 w-4 text-emerald-400" />
                  <span>Sincronizzato con il cloud · {openings.length} aperture</span>
                </>
              ) : (
                <>
                  <HardDrive className="h-4 w-4 text-amber-400" />
                  <span>Dati nel browser locale · {openings.length} aperture ·{' '}
                    <button
                      type="button"
                      onClick={() => setAuthModalOpen(true)}
                      className="font-semibold text-emerald-400 hover:underline"
                    >
                      Accedi per sincronizzare
                    </button>
                  </span>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportJson}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
              >
                <Download className="h-3.5 w-3.5" />
                Esporta Repertorio (JSON)
              </button>
              <button
                type="button"
                onClick={() => dashboardJsonInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-sky-400/35 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-300 transition hover:bg-sky-500/20"
              >
                <Upload className="h-3.5 w-3.5" />
                Importa Repertorio (JSON)
              </button>
              <input
                ref={dashboardJsonInputRef}
                type="file"
                accept=".json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    if (typeof reader.result === 'string') {
                      void handleImportJson(reader.result);
                    }
                  };
                  reader.readAsText(file);
                  e.target.value = '';
                }}
                className="hidden"
              />
            </div>
          </div>

          {/* ── Banner Migrazione ─────────────────────────────────────────── */}
          {showMigrationBanner && user && (
            <div className="mb-4">
              <MigrationBanner
                localCount={localCount}
                migrating={migrating}
                onMigrate={() => { void handleMigrateToCloud(); }}
                onDismiss={dismissMigrationBanner}
              />
            </div>
          )}

          {/* ── Vista Principale ──────────────────────────────────────────── */}
          {mode === 'editor' ? (
            selectedOpening ? (
              <EditorView
                opening={selectedOpening}
                boardTheme={boardTheme}
                onUpdateOpening={handleUpdateOpening}
                onTrainOpening={launchTargetedTraining}
                onNotify={(msg) => showToast(msg)}
              />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-[#32302a] bg-[#1e1d1a]/60 p-8 text-center">
                <Crown className="mb-3 h-10 w-10 text-emerald-400" />
                <h2 className="text-lg font-bold text-stone-100">
                  Seleziona o crea un'apertura
                </h2>
                <p className="mt-1 max-w-md text-sm text-stone-400">
                  Costruisci il tuo repertorio personale per il Bianco e per il Nero
                  con alberi di varianti, commenti strategici e allenamento stile Chessreps.
                </p>
                <button
                  type="button"
                  onClick={() => setNewModalOpen(true)}
                  className="mt-4 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-stone-950 hover:bg-emerald-400"
                >
                  + Crea Nuova Apertura
                </button>
              </div>
            )
          ) : (
            <TrainingView
              key={trainingLaunch.nonce}
              openings={openings}
              initialOpeningId={trainingLaunch.openingId ?? selectedOpening?.id ?? null}
              initialLineId={trainingLaunch.lineId}
              initialSubMode={trainingLaunch.subMode}
              boardTheme={boardTheme}
              onExitToEditor={(opId) => {
                if (opId) setSelectedOpeningId(opId);
                setMode('editor');
              }}
            />
          )}
        </main>
      </div>

      {/* ── Modali ────────────────────────────────────────────────────────── */}
      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthenticated={() => {
          setAuthModalOpen(false);
          showToast('Accesso effettuato. Caricamento repertorio...', 3000);
        }}
      />

      <NewOpeningModal
        open={newModalOpen}
        defaultColor={activeColorTab}
        existingFolders={existingFolders}
        onClose={() => setNewModalOpen(false)}
        onCreate={handleCreateOpening}
      />

      <ImportPgnModal
        open={importPgnOpen}
        defaultColor={activeColorTab}
        onClose={() => setImportPgnOpen(false)}
        onImport={handleImportPgn}
      />

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-xs rounded-xl border border-emerald-500/40 bg-[#1e1d1a] px-4 py-2.5 text-xs font-medium text-emerald-300 shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}

export default App;
