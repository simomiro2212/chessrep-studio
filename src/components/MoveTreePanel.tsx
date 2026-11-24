import React, { useMemo, useState } from 'react';
import {
  ArrowUpCircle,
  Check,
  Edit3,
  GitBranch,
  ListTree,
  MessageSquare,
  Play,
  Trash2,
} from 'lucide-react';
import type { MoveNode, OpeningRepertoire, TrainingLine } from '../types/repertoire';
import { extractLines, formatMovePrefix } from '../utils/tree';

interface MoveTreePanelProps {
  opening: OpeningRepertoire;
  currentNodeId: string;
  onSelectNode: (nodeId: string) => void;
  onDeleteBranch: (nodeId: string) => void;
  onPromoteVariation: (nodeId: string) => void;
  onRenameNodeLine: (nodeId: string, lineName: string) => void;
  onTrainSpecificLine: (line: TrainingLine) => void;
}

export const MoveTreePanel: React.FC<MoveTreePanelProps> = ({
  opening,
  currentNodeId,
  onSelectNode,
  onDeleteBranch,
  onPromoteVariation,
  onRenameNodeLine,
  onTrainSpecificLine,
}) => {
  const [activeTab, setActiveTab] = useState<'tree' | 'lines'>('tree');
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

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
      {/* Header Tabs Albero / Linee */}
      <div className="flex items-center justify-between border-b border-[#32302a] px-3 py-2">
        <div className="flex items-center gap-1">
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
          <button
            type="button"
            onClick={() => setActiveTab('lines')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
              activeTab === 'lines'
                ? 'bg-[#2d2b27] text-emerald-300'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <ListTree className="h-3.5 w-3.5" />
            Linee ({lines.length})
          </button>
        </div>

        {currentNodeId !== opening.rootId && (
          <button
            type="button"
            onClick={() => onDeleteBranch(currentNodeId)}
            title="Elimina ramo dalla mossa selezionata"
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-rose-400/90 transition hover:bg-rose-500/15"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Elimina ramo
          </button>
        )}
      </div>

      {/* Contenuto Tab */}
      <div className="max-h-64 min-h-[160px] overflow-y-auto p-3">
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
          <div className="flex h-32 items-center justify-center text-xs text-stone-400">
            Inserisci almeno una mossa per generare una linea allenabile.
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

                    <div className="flex items-center gap-1">
                      {!isEditing && (
                        <button
                          type="button"
                          onClick={() => startRename(lastMove.id, line.lineName)}
                          title="Rinomina linea"
                          className="rounded p-1 text-stone-400 hover:bg-[#32302a] hover:text-stone-200"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onTrainSpecificLine(line)}
                        title="Allena questa linea"
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/25"
                      >
                        <Play className="h-3 w-3 fill-current" />
                        Allena
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectNode(lastMove.id)}
                    className="mt-1.5 block w-full truncate text-left font-mono text-[11px] text-stone-400 hover:text-stone-200"
                  >
                    {line.moves
                      .map((m) =>
                        m.ply % 2 === 1 ? `${formatMovePrefix(m.ply)} ${m.san}` : m.san
                      )
                      .join(' ')}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
