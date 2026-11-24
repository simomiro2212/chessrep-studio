import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Crown,
  Download,
  Dumbbell,
  HardDrive,
  Menu,
  Palette,
  PencilRuler,
  Upload,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { BOARD_THEMES } from './components/BoardThemes';
import { EditorView } from './components/EditorView';
import { ImportPgnModal, NewOpeningModal } from './components/Modals';
import { RepertoireSidebar } from './components/RepertoireSidebar';
import { TrainingView } from './components/TrainingView';
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
  exportDatabaseToJson,
  loadRepertoiresSync,
  parseDatabaseFromJson,
  saveRepertoiresSync,
} from './utils/storage';
import { createEmptyOpening } from './utils/tree';

export function App() {
  const [openings, setOpenings] = useState<OpeningRepertoire[]>(() => loadRepertoiresSync());
  const [activeColorTab, setActiveColorTab] = useState<RepertoireColor>('white');
  const [selectedOpeningId, setSelectedOpeningId] = useState<string | null>(
    () => openings.find((o) => o.color === 'white')?.id ?? openings[0]?.id ?? null
  );
  const [mode, setMode] = useState<AppMode>('editor');
  const [trainingLaunch, setTrainingLaunch] = useState<{
    subMode: TrainingSubMode;
    openingId: string | null;
    lineId: string | null;
    nonce: number;
  }>({
    subMode: 'targeted',
    openingId: null,
    lineId: null,
    nonce: 0,
  });

  const [muted, setMuted] = useState(false);
  const [boardTheme, setBoardTheme] = useState<BoardThemeKey>('emerald');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [importPgnOpen, setImportPgnOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const dashboardJsonInputRef = useRef<HTMLInputElement>(null);

  // Salvataggio automatico immediato su LocalStorage + IndexedDB
  useEffect(() => {
    saveRepertoiresSync(openings);
  }, [openings]);

  useEffect(() => {
    soundEngine.setMuted(muted);
  }, [muted]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 3000);
  };

  const selectedOpening = useMemo(
    () => openings.find((o) => o.id === selectedOpeningId) ?? null,
    [openings, selectedOpeningId]
  );

  const existingFolders = useMemo(() => {
    const set = new Set<string>();
    for (const op of openings) {
      if (op.folder) set.add(op.folder);
    }
    return Array.from(set);
  }, [openings]);

  const handleChangeColorTab = (color: RepertoireColor) => {
    setActiveColorTab(color);
    if (!selectedOpening || selectedOpening.color !== color) {
      const firstOfColor = openings.find((o) => o.color === color);
      if (firstOfColor) {
        setSelectedOpeningId(firstOfColor.id);
      }
    }
  };

  const handleSelectOpening = (openingId: string) => {
    setSelectedOpeningId(openingId);
    const op = openings.find((o) => o.id === openingId);
    if (op) setActiveColorTab(op.color);
    setMode('editor');
  };

  const handleUpdateOpening = (updated: OpeningRepertoire) => {
    setOpenings((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  };

  const handleCreateOpening = (data: {
    name: string;
    color: RepertoireColor;
    folder: string;
    eco: string;
    description: string;
  }) => {
    const created = createEmptyOpening(data);
    setOpenings((prev) => [...prev, created]);
    setActiveColorTab(created.color);
    setSelectedOpeningId(created.id);
    setMode('editor');
    showToast(`Apertura "${created.name}" creata.`);
  };

  const handleImportPgn = (data: {
    pgn: string;
    name: string;
    color: RepertoireColor;
    folder: string;
  }) => {
    const imported = importPgnIntoOpening(data.pgn, {
      name: data.name,
      color: data.color,
      folder: data.folder,
    });
    setOpenings((prev) => [...prev, imported]);
    setActiveColorTab(imported.color);
    setSelectedOpeningId(imported.id);
    setMode('editor');
    showToast(`PGN importato in "${imported.name}".`);
  };

  const handleDeleteOpening = (openingId: string) => {
    const target = openings.find((o) => o.id === openingId);
    if (!target) return;
    if (!window.confirm(`Eliminare l'apertura "${target.name}"?`)) return;

    const remaining = openings.filter((o) => o.id !== openingId);
    setOpenings(remaining);
    if (selectedOpeningId === openingId) {
      const fallback =
        remaining.find((o) => o.color === activeColorTab) ?? remaining[0] ?? null;
      setSelectedOpeningId(fallback?.id ?? null);
    }
    showToast(`Apertura "${target.name}" eliminata.`);
  };

  const handleExportJson = () => {
    const json = exportDatabaseToJson(openings);
    const date = new Date().toISOString().slice(0, 10);
    downloadTextFile(`chessrep-studio-${date}.json`, json);
    showToast('Backup JSON esportato.');
  };

  const handleImportJson = (jsonText: string) => {
    try {
      const imported = parseDatabaseFromJson(jsonText);
      setOpenings(imported);
      setSelectedOpeningId(imported[0]?.id ?? null);
      if (imported[0]) setActiveColorTab(imported[0].color);
      showToast(`Importate ${imported.length} aperture dal backup JSON.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Errore importazione JSON.');
    }
  };

  const handleResetSamples = () => {
    if (
      !window.confirm(
        'Ripristinare il repertorio di esempio? Le modifiche correnti verranno sostituite.'
      )
    ) {
      return;
    }
    const defaults = createDefaultSampleRepertoire();
    setOpenings(defaults);
    setActiveColorTab('white');
    setSelectedOpeningId(defaults[0]?.id ?? null);
    setMode('editor');
    showToast('Repertorio di esempio ripristinato.');
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
    showToast(`Tema scacchiera: ${BOARD_THEMES[next].label}`);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#161512] text-stone-100">
      {/* Top Navbar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#32302a] bg-[#1e1d1a] px-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen((s) => !s)}
            className="rounded-xl border border-[#32302a] bg-[#242320] p-2 text-stone-300 transition hover:bg-[#2d2b27]"
            title="Mostra/Nascondi Repertorio"
          >
            {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>

          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-stone-950 shadow-md shadow-emerald-500/20">
              <Crown className="h-4 w-4" />
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight text-stone-100">
                ChessRep <span className="text-emerald-400">Studio</span>
              </span>
              <span className="ml-2 hidden rounded-md bg-[#242320] px-1.5 py-0.5 text-[10px] font-medium text-stone-400 sm:inline-block">
                Opening Trainer
              </span>
            </div>
          </div>
        </div>

        {/* Switch Modalità Editor vs Allenamento */}
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

        {/* Controlli Audio & Tema */}
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
            title={muted ? 'Attiva suoni' : 'Disattiva suoni'}
            className="rounded-xl border border-[#32302a] bg-[#242320] p-2 text-stone-300 transition hover:bg-[#2d2b27]"
          >
            {muted ? (
              <VolumeX className="h-4 w-4 text-rose-400" />
            ) : (
              <Volume2 className="h-4 w-4 text-emerald-400" />
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="relative flex flex-1 overflow-hidden">
        {sidebarOpen && (
          <div className="fixed inset-y-14 left-0 z-30 w-72 shrink-0 overflow-hidden shadow-2xl lg:static lg:inset-auto lg:w-80 lg:shadow-none">
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
              onImportJson={handleImportJson}
              onResetSamples={handleResetSamples}
            />
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {/* Barra Backup Dati nella Dashboard principale */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#32302a] bg-[#1e1d1a] px-4 py-2.5">
            <div className="flex items-center gap-2 text-xs text-stone-400">
              <HardDrive className="h-4 w-4 text-emerald-400" />
              <span>
                Dati salvati nel browser ({openings.length}{' '}
                {openings.length === 1 ? 'apertura' : 'aperture'})
              </span>
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
                      handleImportJson(reader.result);
                    }
                  };
                  reader.readAsText(file);
                  e.target.value = '';
                }}
                className="hidden"
              />
            </div>
          </div>

          {mode === 'editor' ? (
            selectedOpening ? (
              <EditorView
                opening={selectedOpening}
                boardTheme={boardTheme}
                onUpdateOpening={handleUpdateOpening}
                onTrainOpening={launchTargetedTraining}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-[#32302a] bg-[#1e1d1a]/60 p-8 text-center">
                <Crown className="mb-3 h-10 w-10 text-emerald-400" />
                <h2 className="text-lg font-bold text-stone-100">
                  Seleziona o crea un’apertura
                </h2>
                <p className="mt-1 max-w-md text-sm text-stone-400">
                  Costruisci il tuo repertorio personale per il Bianco e per il Nero con alberi
                  di varianti, commenti strategici e allenamento stile Chessreps.
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

      {/* Modali */}
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

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 rounded-xl border border-emerald-500/40 bg-[#1e1d1a] px-4 py-2.5 text-xs font-medium text-emerald-300 shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}

export default App;
