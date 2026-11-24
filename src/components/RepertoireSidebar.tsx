import React, { useMemo, useRef } from 'react';
import {
  BookOpen,
  Download,
  FileUp,
  Folder,
  MessageSquare,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import type { OpeningRepertoire, RepertoireColor } from '../types/repertoire';
import { countOpeningNodes } from '../utils/tree';

interface RepertoireSidebarProps {
  openings: OpeningRepertoire[];
  activeColorTab: RepertoireColor;
  selectedOpeningId: string | null;
  onChangeColorTab: (color: RepertoireColor) => void;
  onSelectOpening: (openingId: string) => void;
  onTrainOpening: (openingId: string) => void;
  onDeleteOpening: (openingId: string) => void;
  onOpenNewModal: () => void;
  onOpenImportPgnModal: () => void;
  onExportJson: () => void;
  onImportJson: (jsonText: string) => void;
  onResetSamples: () => void;
}

export const RepertoireSidebar: React.FC<RepertoireSidebarProps> = ({
  openings,
  activeColorTab,
  selectedOpeningId,
  onChangeColorTab,
  onSelectOpening,
  onTrainOpening,
  onDeleteOpening,
  onOpenNewModal,
  onOpenImportPgnModal,
  onExportJson,
  onImportJson,
  onResetSamples,
}) => {
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const whiteCount = useMemo(
    () => openings.filter((o) => o.color === 'white').length,
    [openings]
  );
  const blackCount = useMemo(
    () => openings.filter((o) => o.color === 'black').length,
    [openings]
  );

  const groupedByFolder = useMemo(() => {
    const filtered = openings.filter((o) => o.color === activeColorTab);
    const map = new Map<string, OpeningRepertoire[]>();
    for (const op of filtered) {
      const folder = op.folder || 'Generale';
      if (!map.has(folder)) map.set(folder, []);
      map.get(folder)!.push(op);
    }
    return Array.from(map.entries());
  }, [openings, activeColorTab]);

  const handleJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onImportJson(reader.result);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <aside className="flex h-full flex-col border-r border-[#32302a] bg-[#1e1d1a]">
      {/* Tab Bianco vs Nero */}
      <div className="border-b border-[#32302a] p-3">
        <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-[#161512] p-1">
          <button
            onClick={() => onChangeColorTab('white')}
            className={`flex items-center justify-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold transition ${
              activeColorTab === 'white'
                ? 'bg-[#2a2824] text-stone-100 shadow-sm ring-1 ring-emerald-500/40'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <span className="h-3 w-3 rounded-full border border-stone-400 bg-stone-100" />
            Bianco
            <span className="rounded-full bg-stone-800 px-1.5 py-0.5 text-[10px] text-stone-300">
              {whiteCount}
            </span>
          </button>
          <button
            onClick={() => onChangeColorTab('black')}
            className={`flex items-center justify-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold transition ${
              activeColorTab === 'black'
                ? 'bg-[#2a2824] text-stone-100 shadow-sm ring-1 ring-sky-400/40'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <span className="h-3 w-3 rounded-full border border-stone-500 bg-stone-900" />
            Nero
            <span className="rounded-full bg-stone-800 px-1.5 py-0.5 text-[10px] text-stone-300">
              {blackCount}
            </span>
          </button>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            onClick={onOpenNewModal}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-stone-950 transition hover:bg-emerald-400"
          >
            <Plus className="h-4 w-4" />
            Nuova Apertura
          </button>
          <button
            onClick={onOpenImportPgnModal}
            title="Importa da PGN"
            className="flex items-center justify-center gap-1 rounded-xl border border-[#32302a] bg-[#242320] px-2.5 py-2 text-xs font-medium text-stone-300 transition hover:border-sky-400/50 hover:text-sky-300"
          >
            <FileUp className="h-4 w-4" />
            PGN
          </button>
        </div>
      </div>

      {/* Lista Cartelle & Aperture */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {groupedByFolder.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#32302a] p-5 text-center">
            <BookOpen className="mx-auto mb-2 h-6 w-6 text-stone-500" />
            <p className="text-xs text-stone-400">
              Nessuna apertura per il {activeColorTab === 'white' ? 'Bianco' : 'Nero'}.
            </p>
            <button
              onClick={onOpenNewModal}
              className="mt-3 text-xs font-semibold text-emerald-400 hover:text-emerald-300"
            >
              + Crea la prima apertura
            </button>
          </div>
        ) : (
          groupedByFolder.map(([folderName, items]) => (
            <div key={folderName} className="space-y-1.5">
              <div className="flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                <Folder className="h-3.5 w-3.5 text-amber-400/80" />
                <span className="truncate">{folderName}</span>
              </div>

              <div className="space-y-1.5">
                {items.map((op) => {
                  const stats = countOpeningNodes(op);
                  const isSelected = op.id === selectedOpeningId;
                  return (
                    <div
                      key={op.id}
                      onClick={() => onSelectOpening(op.id)}
                      className={`group cursor-pointer rounded-xl border p-3 transition ${
                        isSelected
                          ? 'border-emerald-500/60 bg-[#262925] shadow-sm'
                          : 'border-[#32302a] bg-[#242320] hover:border-stone-600 hover:bg-[#2a2925]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {op.eco && (
                              <span className="rounded bg-[#161512] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-300">
                                {op.eco}
                              </span>
                            )}
                            <h3 className="truncate text-sm font-semibold text-stone-100">
                              {op.name}
                            </h3>
                          </div>

                          <div className="mt-1.5 flex items-center gap-3 text-[11px] text-stone-400">
                            <span>{stats.linesCount} {stats.linesCount === 1 ? 'linea' : 'linee'}</span>
                            <span>•</span>
                            <span>{stats.movesCount} mosse</span>
                            {stats.commentsCount > 0 && (
                              <>
                                <span>•</span>
                                <span className="inline-flex items-center gap-1 text-amber-400/90">
                                  <MessageSquare className="h-3 w-3" />
                                  {stats.commentsCount}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-[#32302a]/80 pt-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onTrainOpening(op.id);
                          }}
                          disabled={stats.linesCount === 0}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Play className="h-3 w-3 fill-current" />
                          Allena
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteOpening(op.id);
                          }}
                          title="Elimina apertura"
                          className="rounded-lg p-1 text-stone-500 opacity-70 transition hover:bg-rose-500/15 hover:text-rose-400 group-hover:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Backup JSON */}
      <div className="space-y-1.5 border-t border-[#32302a] p-3">
        <button
          type="button"
          onClick={onExportJson}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#32302a] bg-[#242320] px-2.5 py-1.5 text-[11px] font-medium text-stone-200 transition hover:border-emerald-500/40 hover:bg-[#2d2b27]"
        >
          <Download className="h-3.5 w-3.5 text-emerald-400" />
          Esporta Repertorio (JSON)
        </button>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => jsonInputRef.current?.click()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#32302a] bg-[#242320] px-2.5 py-1.5 text-[11px] font-medium text-stone-200 transition hover:border-sky-400/40 hover:bg-[#2d2b27]"
          >
            <Upload className="h-3.5 w-3.5 text-sky-400" />
            Importa Repertorio (JSON)
          </button>
          <button
            type="button"
            onClick={onResetSamples}
            title="Ripristina aperture di esempio"
            className="rounded-lg border border-[#32302a] bg-[#242320] p-1.5 text-stone-400 transition hover:text-amber-300"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
        <input
          ref={jsonInputRef}
          type="file"
          accept=".json"
          onChange={handleJsonFile}
          className="hidden"
        />
      </div>
    </aside>
  );
};
