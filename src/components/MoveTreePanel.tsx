import React, { useMemo, useState } from 'react';
import {
  ArrowUpCircle,
  Check,
  Copy,
  Edit3,
  FileUp,
  GitBranch,
  ListTree,
  MessageSquare,
  Play,
  Plus,
  Trash2,
} from 'lucide-react';
import type { MoveNode, OpeningRepertoire, TrainingLine } from '../types/repertoire';
import { extractLines, formatMovePrefix } from '../utils/tree';

interface MoveTreePanelProps {
  opening: OpeningRepertoire;
  currentNodeId: string;
  onSelectNode: (nodeId: string) => void;
  onDeleteBranch: (nodeId: string) => void;
  onDeleteVariant: (leafNodeId: string) => void;
  onDuplicateVariant: (leafNodeId: string) => void;
  onPromoteVariation: (nodeId: string) => void;
  onRenameNodeLine: (nodeId: string, lineName: string) => void;
  onTrainSpecificLine: (line: TrainingLine) => void;
  onStartNewVariant: (name: string) => void;
  onOpenImportPgn: () => void;
}

export const MoveTreePanel: React.FC<MoveTreePanelProps> = ({
  opening,
  currentNodeId,
  onSelectNode,
  onDeleteBranch,
  onDeleteVariant,
  onDuplicateVariant,
  onPromoteVariation,
  onRenameNodeLine,
  onTrainSpecificLine,
  onStartNewVariant,
  onOpenImportPgn,
}) => {
  const [activeTab, setActiveTab] = useState<'variants' | 'tree'>('variants');
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [creatingVariant, setCreatingVariant] = useState(false);
  const [newVariantName, setNewVariantName] = useState('');

  const lines = useMemo(() => extractLines(opening), [opening]);
  const root = opening.nodes[opening.rootId];

  const startRename = (nodeId: string, currentName: string) => {
    setEditingLineId(nodeId);
    setEditingName(currentName);
  };

  const commitRename = (nodeId: string) => {
    onRenameNodeLine(nodeId, editingName);
    setEditingLineId(null);
  };

  const handleCreateVariantSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newVariantName.trim() || `Variante #${lines.length + 1}`;
    onStartNewVariant(trimmed);
    setNewVariantName('');
    setCreatingVariant(false);
  };

  const renderMovePill = (node: MoveNode, showBlackNumber: boolean) => {
    const isActive = node.id === currentNodeId;
    const hasComment = node.comment.trim().length > 0;
    const moveNumber = Math.ceil(node.ply / 2);
    const prefix =
      node.ply % 2 === 1 ? `${moveNumber}.` : showBlackNumber ? `${moveNumber}...` : '';

    return (
      <button
        key={node.id}
        type="button"
        onClick={() => onSelectNode(node.id)}
        className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-xs transition ${
          isActive
            ? 'bg-emerald-500 font-bold text-stone-950 shadow-sm'
            : 'text-stone-200 hover:bg-[#32302a]'
        }`}
      >
        {prefix && (
          <span className={isActive ? 'text-stone-900/80' : 'text-stone-500'}>{prefix}</span>
        )}
        <span>{node.san}</span>
        {hasComment && (
          <MessageSquare
            className={`h-3 w-3 ${isActive ? 'text-stone-950' : 'text-amber-400'}`}
          />
        )}
        {node.lineName && (
          <span
            className={`ml-0.5 rounded px-1 text-[10px] font-sans font-semibold ${
              isActive
                ? 'bg-stone-950/20 text-stone-950'
                : 'bg-sky-500/15 text-sky-300'
            }`}
          >
            {node.lineName}
          </span>
        )}
      </button>
    );
  };

  /**
   * Renderizza ricorsivamente una catena di mosse.
   * Quando incontra una diramazione (parent con >1 figli), mostra il ramo principale inline
   * e renderizza ciascuna sottovariante in un blocco indentato con controlli di gestione.
   */
  const renderSequence = (
    startChildId: string,
    forceInitialBlackNum: boolean,
    depth = 0
  ): React.ReactNode => {
    const elements: React.ReactNode[] = [];
    let cursorId: string | undefined = startChildId;
    let forceNum = forceInitialBlackNum;

    while (cursorId) {
      const node: MoveNode | undefined = opening.nodes[cursorId];
      if (!node) break;

      const parentNode: MoveNode | undefined = node.parentId
        ? opening.nodes[node.parentId]
        : undefined;
      const hasPreviousComment = Boolean(parentNode && parentNode.comment.trim().length > 0);
      const showBlackNum = forceNum || hasPreviousComment;

      elements.push(renderMovePill(node, showBlackNum));

      const siblings = parentNode ? parentNode.childrenIds : [];
      // Se `node` è il primo figlio del proprio padre E il padre ha delle varianti secondarie,
      // mostra le varianti secondarie subito dopo la prima mossa principale di quel bivio.
      if (siblings.length > 1 && siblings[0] === node.id) {
        const varIds = siblings.slice(1);
        elements.push(
          <div
            key={`vars-${node.id}`}
            className="my-1.5 w-full space-y-1.5 border-l-2 border-sky-500/35 pl-3"
          >
            {varIds.map((varId) => {
              const varNode = opening.nodes[varId];
              if (!varNode) return null;
              return (
                <div
                  key={varId}
                  className="group/var flex flex-wrap items-center gap-1 rounded-lg bg-[#1a1916] px-2 py-1.5"
                >
                  <GitBranch className="mr-1 h-3 w-3 shrink-0 text-sky-400" />
                  <div className="flex flex-1 flex-wrap items-center gap-1">
                    {renderSequence(varId, true, depth + 1)}
                  </div>
                  <div className="ml-auto flex items-center gap-1 opacity-75 transition group-hover/var:opacity-100">
                    <button
                      type="button"
                      onClick={() => onPromoteVariation(varId)}
                      title="Promuovi a linea principale"
                      className="rounded p-1 text-stone-400 hover:bg-[#2d2b27] hover:text-emerald-400"
                    >
                      <ArrowUpCircle className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteBranch(varId)}
                      title="Elimina questa variante"
                      className="rounded p-1 text-stone-400 hover:bg-rose-500/15 hover:text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        );
        forceNum = true;
      } else {
        forceNum = false;
      }

      cursorId = node.childrenIds[0];
    }

    return elements;
  };

  return (
    <div className="flex flex-col rounded-2xl border border-[#32302a] bg-[#1e1d1a]">
      {/* Header Tabs Varianti / Albero Mosse */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#32302a] px-3 py-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('variants')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
              activeTab === 'variants'
                ? 'bg-[#2d2b27] text-emerald-300'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <ListTree className="h-3.5 w-3.5" />
            Varianti ({lines.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tree')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
              activeTab === 'tree'
                ? 'bg-[#2d2b27] text-emerald-300'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <GitBranch className="h-3.5 w-3.5" />
            Albero Mosse
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {activeTab === 'variants' ? (
            <>
              <button
                type="button"
                onClick={() => setCreatingVariant((v) => !v)}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2 py-1 text-[11px] font-semibold text-emerald-300 transition hover:bg-emerald-500/25"
              >
                <Plus className="h-3 w-3" />
                Nuova Variante
              </button>
              <button
                type="button"
                onClick={onOpenImportPgn}
                title="Importa PGN in questa cartella"
                className="inline-flex items-center gap-1 rounded-lg border border-[#32302a] bg-[#242320] px-2 py-1 text-[11px] font-medium text-sky-300 transition hover:border-sky-400/50"
              >
                <FileUp className="h-3 w-3" />
                PGN
              </button>
            </>
          ) : (
            currentNodeId !== opening.rootId && (
              <button
                type="button"
                onClick={() => onDeleteBranch(currentNodeId)}
                title="Elimina ramo dalla mossa selezionata"
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-rose-400/90 transition hover:bg-rose-500/15"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Elimina ramo
              </button>
            )
          )}
        </div>
      </div>

      {/* Form inline "+ Nuova Variante Manuale" */}
      {creatingVariant && (
        <form
          onSubmit={handleCreateVariantSubmit}
          className="flex items-center gap-2 border-b border-[#32302a] bg-[#1a1916] px-3 py-2"
        >
          <input
            type="text"
            autoFocus
            value={newVariantName}
            onChange={(e) => setNewVariantName(e.target.value)}
            placeholder="Nome variante (es. Variante Alapin)"
            className="flex-1 rounded-lg border border-emerald-500/50 bg-[#161512] px-2.5 py-1.5 text-xs text-stone-100 placeholder-stone-500 focus:border-emerald-400 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-emerald-500 px-2.5 py-1.5 text-xs font-semibold text-stone-950 hover:bg-emerald-400"
          >
            Crea
          </button>
          <button
            type="button"
            onClick={() => {
              setCreatingVariant(false);
              setNewVariantName('');
            }}
            className="rounded-lg border border-[#32302a] px-2 py-1.5 text-xs text-stone-400 hover:text-stone-200"
          >
            Annulla
          </button>
        </form>
      )}

      {/* Contenuto Tab */}
      <div className="max-h-72 min-h-[170px] overflow-y-auto p-3">
        {activeTab === 'tree' ? (
          !root || root.childrenIds.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center text-center text-xs text-stone-400">
              <p>Nessuna mossa inserita.</p>
              <p className="mt-1 text-stone-500">
                Muovi i pezzi sulla scacchiera per costruire il repertorio.
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1 leading-relaxed">
              <button
                type="button"
                onClick={() => onSelectNode(opening.rootId)}
                className={`mr-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium transition ${
                  currentNodeId === opening.rootId
                    ? 'bg-emerald-500 font-bold text-stone-950'
                    : 'bg-[#242320] text-stone-400 hover:text-stone-200'
                }`}
              >
                Start
              </button>
              {renderSequence(root.childrenIds[0], true, 0)}
            </div>
          )
        ) : lines.length === 0 ? (
          <div className="flex h-36 flex-col items-center justify-center text-center text-xs text-stone-400">
            <p>Nessuna variante salvata in questa cartella.</p>
            <p className="mt-1 text-stone-500">
              Clicca <strong className="text-emerald-300">+ Nuova Variante</strong> o muovi i pezzi sulla scacchiera, oppure importa un <strong className="text-sky-300">PGN</strong>.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {lines.map((line, index) => {
              const lastMove = line.moves[line.moves.length - 1];
              const isEditing = editingLineId === lastMove.id;
              const isActiveLine = line.moves.some((m) => m.id === currentNodeId);

              return (
                <div
                  key={line.id}
                  className={`rounded-xl border p-2.5 transition ${
                    isActiveLine
                      ? 'border-emerald-500/45 bg-[#252823]'
                      : 'border-[#32302a] bg-[#242320]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="rounded bg-[#161512] px-1.5 py-0.5 font-mono text-[10px] text-stone-400">
                        #{index + 1}
                      </span>
                      {isEditing ? (
                        <div className="flex flex-1 items-center gap-1">
                          <input
                            type="text"
                            autoFocus
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitRename(lastMove.id);
                              if (e.key === 'Escape') setEditingLineId(null);
                            }}
                            className="flex-1 rounded-lg border border-emerald-500 bg-[#161512] px-2 py-0.5 text-xs text-stone-100 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => commitRename(lastMove.id)}
                            className="rounded p-1 text-emerald-400 hover:bg-emerald-500/15"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSelectNode(lastMove.id)}
                          className="truncate text-left text-xs font-semibold text-stone-100 hover:text-emerald-300"
                        >
                          {line.lineName}
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-0.5">
                      {!isEditing && (
                        <>
                          <button
                            type="button"
                            onClick={() => startRename(lastMove.id, line.lineName)}
                            title="Rinomina variante"
                            className="rounded p-1 text-stone-400 hover:bg-[#32302a] hover:text-stone-200"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDuplicateVariant(lastMove.id)}
                            title="Duplica variante"
                            className="rounded p-1 text-stone-400 hover:bg-[#32302a] hover:text-sky-300"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteVariant(lastMove.id)}
                            title="Elimina variante"
                            className="rounded p-1 text-stone-400 hover:bg-rose-500/15 hover:text-rose-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => onTrainSpecificLine(line)}
                        title="Allena questa variante"
                        className="ml-1 inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/25"
                      >
                        <Play className="h-3 w-3 fill-current" />
                        Allena
                      </button>
                    </div>
                  </div>

                  {/* Mosse cliccabili della variante */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    {line.moves.map((m) => {
                      const isMoveActive = m.id === currentNodeId;
                      const hasComment = m.comment.trim().length > 0;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => onSelectNode(m.id)}
                          className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 font-mono text-[11px] transition ${
                            isMoveActive
                              ? 'bg-emerald-500 font-bold text-stone-950'
                              : 'text-stone-400 hover:bg-[#32302a] hover:text-stone-100'
                          }`}
                        >
                          {m.ply % 2 === 1 ? `${formatMovePrefix(m.ply)} ` : ''}
                          {m.san}
                          {hasComment && (
                            <MessageSquare
                              className={`h-2.5 w-2.5 ${
                                isMoveActive ? 'text-stone-950' : 'text-amber-400'
                              }`}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
