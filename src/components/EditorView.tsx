import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  Download,
  FlipVertical2,
  MessageSquare,
  Play,
  Sparkles,
  Tag,
} from 'lucide-react';
import type { BoardThemeKey, OpeningRepertoire, TrainingLine } from '../types/repertoire';
import { BOARD_THEMES } from './BoardThemes';
import { MoveTreePanel } from './MoveTreePanel';
import { exportOpeningToPgn } from '../utils/pgn';
import { soundEngine } from '../utils/sound';
import { downloadTextFile } from '../utils/storage';
import {
  addOrSelectMove,
  countOpeningNodes,
  deleteBranch,
  formatMovePrefix,
  getMainlineEndId,
  promoteVariation,
  renameNodeLine,
  updateNodeComment,
} from '../utils/tree';

interface EditorViewProps {
  opening: OpeningRepertoire;
  boardTheme: BoardThemeKey;
  onUpdateOpening: (updated: OpeningRepertoire) => void;
  onTrainOpening: (openingId: string, specificLine?: TrainingLine) => void;
}

type PromotionChoice = 'q' | 'r' | 'b' | 'n';

export const EditorView: React.FC<EditorViewProps> = ({
  opening,
  boardTheme,
  onUpdateOpening,
  onTrainOpening,
}) => {
  const [currentNodeId, setCurrentNodeId] = useState<string>(opening.rootId);
  const [flipped, setFlipped] = useState(false);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [promotionPiece, setPromotionPiece] = useState<PromotionChoice>('q');
  const [copiedFen, setCopiedFen] = useState(false);
  const [boardWidth, setBoardWidth] = useState(480);

  const boardContainerRef = useRef<HTMLDivElement>(null);

  // Quando cambia apertura, riposiziona sulla radice (o sulla fine della linea principale se preferito; partiamo dalla radice)
  useEffect(() => {
    setCurrentNodeId(opening.rootId);
    setSelectedSquare(null);
    setFlipped(false);
  }, [opening.id, opening.rootId]);

  // Se il nodo corrente non esiste più (es. dopo delete), torna a rootId
  const currentNode = opening.nodes[currentNodeId] ?? opening.nodes[opening.rootId];
  const activeNodeId = currentNode.id;

  // Responsive chessboard sizing
  useEffect(() => {
    const el = boardContainerRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      const availableW = rect.width - 36;
      const maxH = Math.max(260, window.innerHeight - 240);
      const size = Math.floor(Math.min(availableW, maxH, 560));
      setBoardWidth(Math.max(220, size));
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    window.addEventListener('resize', updateSize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  const orientation = useMemo(() => {
    const base = opening.color;
    if (!flipped) return base;
    return base === 'white' ? 'black' : 'white';
  }, [opening.color, flipped]);

  const attemptMove = useCallback(
    (from: Square, to: Square): boolean => {
      const res = addOrSelectMove(opening, activeNodeId, {
        from,
        to,
        promotion: promotionPiece,
      });
      if (!res) return false;

      if (res.opening !== opening) {
        onUpdateOpening(res.opening);
      }
      setCurrentNodeId(res.targetNodeId);
      setSelectedSquare(null);

      if (res.move.san.includes('+') || res.move.san.includes('#')) {
        soundEngine.playCheck();
      } else if (res.move.captured) {
        soundEngine.playCapture();
      } else {
        soundEngine.playMove();
      }
      return true;
    },
    [opening, activeNodeId, promotionPiece, onUpdateOpening]
  );

  const onPieceDrop = useCallback(
    (sourceSquare: Square, targetSquare: Square) => {
      return attemptMove(sourceSquare, targetSquare);
    },
    [attemptMove]
  );

  const onSquareClick = useCallback(
    (square: Square) => {
      if (selectedSquare === square) {
        setSelectedSquare(null);
        return;
      }

      if (selectedSquare) {
        const moved = attemptMove(selectedSquare, square);
        if (moved) return;
      }

      const chess = new Chess(currentNode.fen);
      const piece = chess.get(square);
      if (piece && piece.color === chess.turn()) {
        setSelectedSquare(square);
      } else {
        setSelectedSquare(null);
      }
    },
    [selectedSquare, attemptMove, currentNode.fen]
  );

  // Navigazione da tastiera (evitando conflitti quando si scrive nei campi di testo)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentNode.parentId) {
          setCurrentNodeId(currentNode.parentId);
          setSelectedSquare(null);
          soundEngine.playMove();
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (currentNode.childrenIds.length > 0) {
          setCurrentNodeId(currentNode.childrenIds[0]);
          setSelectedSquare(null);
          soundEngine.playMove();
        }
      } else if (e.key === 'Home') {
        e.preventDefault();
        setCurrentNodeId(opening.rootId);
        setSelectedSquare(null);
      } else if (e.key === 'End') {
        e.preventDefault();
        setCurrentNodeId(getMainlineEndId(opening, activeNodeId));
        setSelectedSquare(null);
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentNode, opening, activeNodeId]);

  // Evidenziazione ultima mossa + mosse legali dal pezzo selezionato
  const customSquareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};

    if (currentNode.from && currentNode.to) {
      styles[currentNode.from] = { backgroundColor: 'rgba(245, 158, 11, 0.25)' };
      styles[currentNode.to] = { backgroundColor: 'rgba(245, 158, 11, 0.35)' };
    }

    if (selectedSquare) {
      styles[selectedSquare] = { backgroundColor: 'rgba(16, 185, 129, 0.42)' };
      const chess = new Chess(currentNode.fen);
      const legalMoves = chess.moves({ square: selectedSquare, verbose: true });
      for (const m of legalMoves) {
        const hasTargetPiece = Boolean(chess.get(m.to));
        styles[m.to] = hasTargetPiece
          ? {
              background:
                'radial-gradient(circle, transparent 58%, rgba(16, 185, 129, 0.55) 60%)',
            }
          : {
              background:
                'radial-gradient(circle, rgba(16, 185, 129, 0.55) 22%, transparent 24%)',
            };
      }
    }

    return styles;
  }, [currentNode.from, currentNode.to, currentNode.fen, selectedSquare]);

  // Frecce delicate per mostrare le continuazioni già presenti nel repertorio dalla posizione attuale
  const customArrows = useMemo(() => {
    const arrows: NonNullable<React.ComponentProps<typeof Chessboard>['customArrows']> = [];
    currentNode.childrenIds.forEach((cid, idx) => {
      const child = opening.nodes[cid];
      if (child?.from && child?.to) {
        arrows.push([
          child.from,
          child.to,
          idx === 0 ? 'rgba(16, 185, 129, 0.65)' : 'rgba(56, 189, 248, 0.55)',
        ]);
      }
    });
    return arrows;
  }, [currentNode.childrenIds, opening.nodes]);

  const theme = BOARD_THEMES[boardTheme];
  const stats = useMemo(() => countOpeningNodes(opening), [opening]);

  const handleCopyFen = () => {
    void navigator.clipboard?.writeText(currentNode.fen);
    setCopiedFen(true);
    setTimeout(() => setCopiedFen(false), 1500);
  };

  const handleExportPgn = () => {
    const pgn = exportOpeningToPgn(opening);
    const safeName = opening.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    downloadTextFile(`${safeName || 'apertura'}.pgn`, pgn, 'application/x-chess-pgn');
  };

  const handleDeleteBranch = (nodeId: string) => {
    const { opening: nextOp, fallbackNodeId } = deleteBranch(opening, nodeId);
    onUpdateOpening(nextOp);
    setCurrentNodeId(fallbackNodeId);
    setSelectedSquare(null);
  };

  const quickCommentTag = (prefix: string) => {
    const current = currentNode.comment;
    const next = current.trim() ? `${current}\n${prefix}: ` : `${prefix}: `;
    onUpdateOpening(updateNodeComment(opening, activeNodeId, next));
  };

  const moveLabel =
    currentNode.parentId === null
      ? 'Posizione Iniziale'
      : `${formatMovePrefix(currentNode.ply)} ${currentNode.san}`;

  return (
    <div className="grid h-full grid-cols-1 gap-5 lg:grid-cols-12">
      {/* Colonna Sinistra: Scacchiera & Controlli */}
      <div className="flex flex-col items-center justify-start lg:col-span-7">
        <div
          ref={boardContainerRef}
          className="flex w-full max-w-[600px] flex-col items-center rounded-2xl border border-[#32302a] bg-[#1e1d1a] p-4 shadow-xl"
        >
          {/* Barra stato turno */}
          <div className="mb-3 flex w-full items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  currentNode.fen.split(' ')[1] === 'w'
                    ? 'bg-stone-100 ring-2 ring-stone-400/50'
                    : 'bg-stone-900 ring-2 ring-stone-500'
                }`}
              />
              <span className="font-medium text-stone-300">
                Tocca al {currentNode.fen.split(' ')[1] === 'w' ? 'Bianco' : 'Nero'}
              </span>
              {currentNode.childrenIds.length > 0 && (
                <span className="rounded-full bg-[#242320] px-2 py-0.5 text-[11px] text-emerald-400">
                  {currentNode.childrenIds.length}{' '}
                  {currentNode.childrenIds.length === 1 ? 'continuazione' : 'varianti'} nel
                  repertorio
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-stone-500">Promozione:</span>
              {(['q', 'r', 'b', 'n'] as PromotionChoice[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPromotionPiece(p)}
                  className={`rounded px-1.5 py-0.5 font-mono text-[11px] uppercase transition ${
                    promotionPiece === p
                      ? 'bg-emerald-500/20 font-bold text-emerald-300'
                      : 'text-stone-400 hover:bg-[#2d2b27]'
                  }`}
                >
                  {p === 'q' ? 'D' : p === 'r' ? 'T' : p === 'b' ? 'A' : 'C'}
                </button>
              ))}
            </div>
          </div>

          {/* Scacchiera */}
          <div className="overflow-hidden rounded-xl shadow-2xl ring-1 ring-black/40">
            <Chessboard
              id="editor-board"
              position={currentNode.fen}
              boardWidth={boardWidth}
              boardOrientation={orientation}
              onPieceDrop={onPieceDrop}
              onSquareClick={onSquareClick}
              customSquareStyles={customSquareStyles}
              customArrows={customArrows}
              customLightSquareStyle={{ backgroundColor: theme.lightSquare }}
              customDarkSquareStyle={{ backgroundColor: theme.darkSquare }}
              animationDuration={180}
            />
          </div>

          {/* Controlli Navigazione */}
          <div className="mt-3.5 flex w-full flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentNodeId(opening.rootId)}
                disabled={activeNodeId === opening.rootId}
                title="Inizio (Home)"
                className="rounded-xl border border-[#32302a] bg-[#242320] p-2 text-stone-300 transition hover:bg-[#2d2b27] disabled:opacity-35"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => currentNode.parentId && setCurrentNodeId(currentNode.parentId)}
                disabled={!currentNode.parentId}
                title="Mossa precedente (Freccia Sinistra)"
                className="rounded-xl border border-[#32302a] bg-[#242320] p-2 text-stone-300 transition hover:bg-[#2d2b27] disabled:opacity-35"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  currentNode.childrenIds[0] && setCurrentNodeId(currentNode.childrenIds[0])
                }
                disabled={currentNode.childrenIds.length === 0}
                title="Mossa successiva (Freccia Destra)"
                className="rounded-xl border border-[#32302a] bg-[#242320] p-2 text-stone-300 transition hover:bg-[#2d2b27] disabled:opacity-35"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentNodeId(getMainlineEndId(opening, activeNodeId))}
                disabled={currentNode.childrenIds.length === 0}
                title="Fine linea principale (Fine)"
                className="rounded-xl border border-[#32302a] bg-[#242320] p-2 text-stone-300 transition hover:bg-[#2d2b27] disabled:opacity-35"
              >
                <ChevronsRight className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFlipped((f) => !f)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#32302a] bg-[#242320] px-3 py-2 text-xs font-medium text-stone-300 transition hover:bg-[#2d2b27]"
              >
                <FlipVertical2 className="h-3.5 w-3.5" />
                Ruota
              </button>
              <button
                type="button"
                onClick={handleCopyFen}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#32302a] bg-[#242320] px-3 py-2 text-xs font-medium text-stone-300 transition hover:bg-[#2d2b27]"
              >
                <Copy className="h-3.5 w-3.5" />
                {copiedFen ? 'FEN copiato!' : 'FEN'}
              </button>
              <button
                type="button"
                onClick={handleExportPgn}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#32302a] bg-[#242320] px-3 py-2 text-xs font-medium text-stone-300 transition hover:bg-[#2d2b27]"
              >
                <Download className="h-3.5 w-3.5" />
                PGN
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Colonna Destra: Info Apertura, Albero Varianti & Editor Commenti */}
      <div className="flex flex-col gap-4 lg:col-span-5">
        {/* Card Intestazione Apertura */}
        <div className="rounded-2xl border border-[#32302a] bg-[#1e1d1a] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    opening.color === 'white'
                      ? 'bg-stone-100 text-stone-900'
                      : 'bg-stone-900 text-stone-200 ring-1 ring-stone-600'
                  }`}
                >
                  {opening.color === 'white' ? 'Bianco' : 'Nero'}
                </span>
                {opening.eco && (
                  <span className="rounded-md bg-[#242320] px-2 py-0.5 font-mono text-[11px] font-semibold text-amber-300">
                    ECO {opening.eco}
                  </span>
                )}
                <span className="text-xs text-stone-400">{opening.folder}</span>
              </div>

              <h1 className="mt-2 text-lg font-bold tracking-tight text-stone-100">
                {opening.name}
              </h1>
              {opening.description && (
                <p className="mt-1 text-xs leading-relaxed text-stone-400">
                  {opening.description}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => onTrainOpening(opening.id)}
              disabled={stats.linesCount === 0}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-bold text-stone-950 shadow-lg shadow-emerald-500/10 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              Allena ({stats.linesCount})
            </button>
          </div>
        </div>

        {/* Albero delle Varianti */}
        <MoveTreePanel
          opening={opening}
          currentNodeId={activeNodeId}
          onSelectNode={(id) => {
            setCurrentNodeId(id);
            setSelectedSquare(null);
            soundEngine.playMove();
          }}
          onDeleteBranch={handleDeleteBranch}
          onPromoteVariation={(id) => onUpdateOpening(promoteVariation(opening, id))}
          onRenameNodeLine={(id, name) => onUpdateOpening(renameNodeLine(opening, id, name))}
          onTrainSpecificLine={(line) => onTrainOpening(opening.id, line)}
        />

        {/* Pannello Annotazione & Nome Linea */}
        <div className="flex flex-1 flex-col rounded-2xl border border-[#32302a] bg-[#1e1d1a] p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-semibold text-stone-100">
                Annotazione Mossa:{' '}
                <span className="font-mono text-emerald-400">{moveLabel}</span>
              </span>
            </div>
            <span className="text-[11px] text-stone-500">Salvataggio automatico</span>
          </div>

          {/* Nome Variante / Linea associata al nodo */}
          <div className="mb-3">
            <label className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-stone-400">
              <Tag className="h-3 w-3 text-sky-400" />
              Nome Linea / Variante (opzionale)
            </label>
            <input
              type="text"
              value={currentNode.lineName ?? ''}
              onChange={(e) =>
                onUpdateOpening(renameNodeLine(opening, activeNodeId, e.target.value))
              }
              placeholder={
                activeNodeId === opening.rootId
                  ? 'es. Linea Principale'
                  : 'es. Variante con 6.Bg5'
              }
              className="w-full rounded-xl border border-[#32302a] bg-[#161512] px-3 py-2 text-xs text-stone-100 placeholder-stone-500 focus:border-sky-400 focus:outline-none"
            />
          </div>

          {/* Box Commento */}
          <div className="flex flex-1 flex-col">
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <label className="text-[11px] font-medium uppercase tracking-wider text-stone-400">
                Spiegazione Strategica / Piani / Trappole
              </label>
              <div className="flex items-center gap-1">
                {['Piano', 'Trappola', 'Idea chiave'].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => quickCommentTag(tag)}
                    className="inline-flex items-center gap-1 rounded-md border border-[#32302a] bg-[#242320] px-2 py-0.5 text-[10px] font-medium text-stone-300 transition hover:border-amber-400/40 hover:text-amber-300"
                  >
                    <Sparkles className="h-2.5 w-2.5 text-amber-400" />
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              rows={4}
              value={currentNode.comment}
              onChange={(e) =>
                onUpdateOpening(updateNodeComment(opening, activeNodeId, e.target.value))
              }
              placeholder="Scrivi qui perché questa mossa è forte, i piani nel mediogioco o le trappole tattiche da ricordare durante l'allenamento..."
              className="w-full flex-1 resize-none rounded-xl border border-[#32302a] bg-[#161512] p-3 text-sm leading-relaxed text-stone-100 placeholder-stone-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
