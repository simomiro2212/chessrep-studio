import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import {
  AlertCircle,
  ArrowRight,
  Award,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Flame,
  FolderOpen,
  Lightbulb,
  MessageSquare,
  RotateCcw,
  Shuffle,
  Target,
  Trophy,
} from 'lucide-react';
import type {
  BoardThemeKey,
  MoveNode,
  OpeningRepertoire,
  ShuffleColorFilter,
  TrainingLine,
  TrainingSubMode,
} from '../types/repertoire';
import { BOARD_THEMES } from './BoardThemes';
import { soundEngine } from '../utils/sound';
import { buildShuffleQueue, buildTargetedQueue } from '../utils/training';
import { extractLines, formatMovePrefix, INITIAL_FEN } from '../utils/tree';

interface TrainingViewProps {
  openings: OpeningRepertoire[];
  initialOpeningId: string | null;
  initialLineId: string | null;
  initialSubMode: TrainingSubMode;
  boardTheme: BoardThemeKey;
  onExitToEditor: (openingId?: string) => void;
}

type FeedbackState =
  | { type: 'idle' }
  | { type: 'correct'; san: string }
  | { type: 'wrong'; attemptedSan: string; expectedSan: string; hintFrom: Square; hintTo: Square }
  | { type: 'complete' };

export const TrainingView: React.FC<TrainingViewProps> = ({
  openings,
  initialOpeningId,
  initialLineId,
  initialSubMode,
  boardTheme,
  onExitToEditor,
}) => {
  const trainableOpenings = useMemo(
    () => openings.filter((op) => extractLines(op).length > 0),
    [openings]
  );

  const [subMode, setSubMode] = useState<TrainingSubMode>(initialSubMode);
  const [selectedOpeningId, setSelectedOpeningId] = useState<string>(
    initialOpeningId && trainableOpenings.some((o) => o.id === initialOpeningId)
      ? initialOpeningId
      : trainableOpenings[0]?.id ?? ''
  );
  const [expandedOpeningId, setExpandedOpeningId] = useState<string>(
    initialOpeningId && trainableOpenings.some((o) => o.id === initialOpeningId)
      ? initialOpeningId
      : trainableOpenings[0]?.id ?? ''
  );
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>(
    initialLineId ? [initialLineId] : []
  );
  const [shuffleTargeted, setShuffleTargeted] = useState<boolean>(false);
  const [shuffleFilter, setShuffleFilter] = useState<ShuffleColorFilter>('both');
  const [autoAdvance, setAutoAdvance] = useState<boolean>(false);
  const [loopTargeted, setLoopTargeted] = useState<boolean>(true);

  const [queue, setQueue] = useState<TrainingLine[]>([]);
  const [lineIndex, setLineIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0); // indice in activeLine.moves (0 = prima mossa attesa)
  const [fen, setFen] = useState(INITIAL_FEN);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>({ type: 'idle' });
  const [activeComment, setActiveComment] = useState<{
    moveLabel: string;
    author: 'user' | 'opponent';
    text: string;
  } | null>(null);
  const [showHintArrow, setShowHintArrow] = useState(false);

  // Metriche sessione
  const [attemptedUserMoves, setAttemptedUserMoves] = useState(0);
  const [cleanUserMoves, setCleanUserMoves] = useState(0);
  const [hadErrorOnCurrentPly, setHadErrorOnCurrentPly] = useState(false);
  const [streak, setStreak] = useState(0);
  const [completedLinesCount, setCompletedLinesCount] = useState(0);
  const [sessionDone, setSessionDone] = useState(false);

  const [boardWidth, setBoardWidth] = useState(480);
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const opponentTimerRef = useRef<number | null>(null);
  const autoAdvanceTimerRef = useRef<number | null>(null);

  const selectedOpening = useMemo(
    () => trainableOpenings.find((o) => o.id === selectedOpeningId) ?? trainableOpenings[0],
    [trainableOpenings, selectedOpeningId]
  );

  const selectedOpeningLines = useMemo(
    () => (selectedOpening ? extractLines(selectedOpening) : []),
    [selectedOpening]
  );

  // Responsive board
  useEffect(() => {
    const el = boardContainerRef.current;
    if (!el) return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      const availableW = rect.width - 36;
      const maxH = Math.max(260, window.innerHeight - 240);
      setBoardWidth(Math.max(220, Math.floor(Math.min(availableW, maxH, 560))));
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

  const clearTimers = useCallback(() => {
    if (opponentTimerRef.current !== null) {
      window.clearTimeout(opponentTimerRef.current);
      opponentTimerRef.current = null;
    }
    if (autoAdvanceTimerRef.current !== null) {
      window.clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const initLineState = useCallback(
    (line: TrainingLine | undefined, currentOpenings: OpeningRepertoire[]) => {
      clearTimers();
      if (!line) {
        setFen(INITIAL_FEN);
        setStepIndex(0);
        setFeedback({ type: 'idle' });
        setActiveComment(null);
        return;
      }

      const op = currentOpenings.find((o) => o.id === line.openingId);
      const startFen = op?.nodes[op.rootId]?.fen ?? INITIAL_FEN;
      setFen(startFen);
      setStepIndex(0);
      setSelectedSquare(null);
      setFeedback({ type: 'idle' });
      setActiveComment(null);
      setShowHintArrow(false);
      setHadErrorOnCurrentPly(false);
    },
    [clearTimers]
  );

  const startSession = useCallback(
    (
      mode: TrainingSubMode,
      opId: string,
      lIds: string[],
      sTargeted: boolean,
      sFilter: ShuffleColorFilter
    ) => {
      clearTimers();
      let newQueue: TrainingLine[] = [];
      if (mode === 'targeted') {
        const op = trainableOpenings.find((o) => o.id === opId) ?? trainableOpenings[0];
        if (op) {
          newQueue = buildTargetedQueue(op, {
            lineIds: lIds.length > 0 ? lIds : null,
            shuffleOrder: sTargeted,
          });
        }
      } else {
        newQueue = buildShuffleQueue(trainableOpenings, sFilter);
      }

      setQueue(newQueue);
      setLineIndex(0);
      setAttemptedUserMoves(0);
      setCleanUserMoves(0);
      setStreak(0);
      setCompletedLinesCount(0);
      setSessionDone(false);
      initLineState(newQueue[0], openings);
    },
    [clearTimers, trainableOpenings, initLineState, openings]
  );

  // Avvio iniziale e sincronizzazione quando cambia modalità/filtro
  useEffect(() => {
    startSession(subMode, selectedOpeningId, selectedLineIds, shuffleTargeted, shuffleFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subMode, selectedOpeningId, selectedLineIds, shuffleTargeted, shuffleFilter]);

  const toggleLineSelection = (openingId: string, lineId: string) => {
    if (selectedOpeningId !== openingId) {
      setSelectedOpeningId(openingId);
      setSelectedLineIds([lineId]);
      return;
    }
    setSelectedLineIds((prev) =>
      prev.includes(lineId) ? prev.filter((id) => id !== lineId) : [...prev, lineId]
    );
  };

  const selectSingleLine = (openingId: string, lineId: string) => {
    setSelectedOpeningId(openingId);
    setSelectedLineIds([lineId]);
  };

  const selectAllLinesInOpening = (openingId: string) => {
    setSelectedOpeningId(openingId);
    setSelectedLineIds([]);
  };

  const activeLine = queue[lineIndex];
  const expectedNode: MoveNode | undefined = activeLine?.moves[stepIndex];
  const userColorCode = activeLine?.color === 'white' ? 'w' : 'b';

  // Esegui automaticamente le mosse dell'avversario quando è il suo turno
  useEffect(() => {
    if (!activeLine || sessionDone) return;

    if (stepIndex >= activeLine.moves.length) {
      if (feedback.type !== 'complete') {
        setFeedback({ type: 'complete' });
        setCompletedLinesCount((c) => c + 1);
        soundEngine.playSuccess();
      }
      return;
    }

    const node = activeLine.moves[stepIndex];
    if (node && node.color !== userColorCode) {
      opponentTimerRef.current = window.setTimeout(() => {
        setFen(node.fen);
        setSelectedSquare(null);
        if (node.san?.includes('+') || node.san?.includes('#')) {
          soundEngine.playCheck();
        } else if (node.san?.includes('x')) {
          soundEngine.playCapture();
        } else {
          soundEngine.playMove();
        }

        if (node.comment.trim()) {
          setActiveComment({
            moveLabel: `${formatMovePrefix(node.ply)} ${node.san}`,
            author: 'opponent',
            text: node.comment,
          });
        }

        setHadErrorOnCurrentPly(false);
        setStepIndex((s) => s + 1);
      }, 360);
    }

    return () => {
      if (opponentTimerRef.current !== null) {
        window.clearTimeout(opponentTimerRef.current);
      }
    };
  }, [activeLine, stepIndex, userColorCode, sessionDone, feedback.type]);

  const goToNextLine = useCallback(() => {
    if (queue.length === 0) return;

    const nextIdx = lineIndex + 1;
    if (nextIdx < queue.length) {
      setLineIndex(nextIdx);
      initLineState(queue[nextIdx], openings);
    } else if (subMode === 'targeted' && loopTargeted) {
      setLineIndex(0);
      initLineState(queue[0], openings);
    } else {
      setSessionDone(true);
    }
  }, [queue, lineIndex, subMode, loopTargeted, initLineState, openings]);

  // Auto-avanzamento opzionale al completamento linea
  useEffect(() => {
    if (feedback.type === 'complete' && autoAdvance && !sessionDone) {
      autoAdvanceTimerRef.current = window.setTimeout(() => {
        goToNextLine();
      }, 1250);
    }
    return () => {
      if (autoAdvanceTimerRef.current !== null) {
        window.clearTimeout(autoAdvanceTimerRef.current);
      }
    };
  }, [feedback.type, autoAdvance, sessionDone, goToNextLine]);

  // Scorciatoia tastiera Enter/Spazio per avanzare rapidamente alla prossima linea
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (feedback.type === 'complete' && !sessionDone && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        goToNextLine();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [feedback.type, sessionDone, goToNextLine]);

  const handleUserMove = useCallback(
    (from: Square, to: Square): boolean => {
      if (!activeLine || !expectedNode || expectedNode.color !== userColorCode || sessionDone) {
        return false;
      }

      const chess = new Chess(fen);
      let playedMove;
      try {
        playedMove = chess.move({ from, to, promotion: 'q' });
      } catch {
        return false;
      }
      if (!playedMove) return false;

      if (playedMove.san === expectedNode.san) {
        // Mossa corretta!
        setFen(expectedNode.fen);
        setSelectedSquare(null);
        setShowHintArrow(false);
        setAttemptedUserMoves((n) => n + 1);
        if (!hadErrorOnCurrentPly) {
          setCleanUserMoves((n) => n + 1);
          setStreak((s) => s + 1);
        }
        setHadErrorOnCurrentPly(false);
        setFeedback({ type: 'correct', san: expectedNode.san ?? playedMove.san });

        if (playedMove.san.includes('+') || playedMove.san.includes('#')) {
          soundEngine.playCheck();
        } else if (playedMove.captured) {
          soundEngine.playCapture();
        } else {
          soundEngine.playCorrect();
        }

        if (expectedNode.comment.trim()) {
          setActiveComment({
            moveLabel: `${formatMovePrefix(expectedNode.ply)} ${expectedNode.san}`,
            author: 'user',
            text: expectedNode.comment,
          });
        }

        setStepIndex((s) => s + 1);
        return true;
      }

      // Mossa errata rispetto al repertorio -> feedback rosso + freccia suggerimento + permetti di riprovare
      soundEngine.playError();
      setSelectedSquare(null);
      setStreak(0);
      if (!hadErrorOnCurrentPly) {
        setAttemptedUserMoves((n) => n + 1);
        setHadErrorOnCurrentPly(true);
      }
      if (expectedNode.from && expectedNode.to) {
        setShowHintArrow(true);
        setFeedback({
          type: 'wrong',
          attemptedSan: playedMove.san,
          expectedSan: expectedNode.san ?? '',
          hintFrom: expectedNode.from,
          hintTo: expectedNode.to,
        });
      }
      return false; // Fa tornare il pezzo indietro automaticamente
    },
    [activeLine, expectedNode, userColorCode, sessionDone, fen, hadErrorOnCurrentPly]
  );

  const onSquareClick = useCallback(
    (square: Square) => {
      if (!expectedNode || expectedNode.color !== userColorCode || sessionDone) return;

      if (selectedSquare === square) {
        setSelectedSquare(null);
        return;
      }

      if (selectedSquare) {
        const ok = handleUserMove(selectedSquare, square);
        if (ok) return;
      }

      const chess = new Chess(fen);
      const piece = chess.get(square);
      if (piece && piece.color === userColorCode) {
        setSelectedSquare(square);
      } else {
        setSelectedSquare(null);
      }
    },
    [expectedNode, userColorCode, sessionDone, selectedSquare, handleUserMove, fen]
  );

  const customArrows = useMemo(() => {
    const arrows: NonNullable<React.ComponentProps<typeof Chessboard>['customArrows']> = [];
    if (showHintArrow && expectedNode?.from && expectedNode?.to) {
      arrows.push([expectedNode.from, expectedNode.to, 'rgba(16, 185, 129, 0.9)']);
    }
    return arrows;
  }, [showHintArrow, expectedNode]);

  const customSquareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    const prevNode = stepIndex > 0 ? activeLine?.moves[stepIndex - 1] : undefined;

    if (prevNode?.from && prevNode?.to) {
      const highlight =
        feedback.type === 'correct'
          ? 'rgba(16, 185, 129, 0.35)'
          : 'rgba(245, 158, 11, 0.25)';
      styles[prevNode.from] = { backgroundColor: highlight };
      styles[prevNode.to] = { backgroundColor: highlight };
    }

    if (selectedSquare) {
      styles[selectedSquare] = { backgroundColor: 'rgba(56, 189, 248, 0.42)' };
      const chess = new Chess(fen);
      for (const m of chess.moves({ square: selectedSquare, verbose: true })) {
        styles[m.to] = {
          background:
            'radial-gradient(circle, rgba(56, 189, 248, 0.5) 22%, transparent 24%)',
        };
      }
    }

    return styles;
  }, [stepIndex, activeLine, feedback.type, selectedSquare, fen]);

  const accuracy =
    attemptedUserMoves === 0
      ? 100
      : Math.round((cleanUserMoves / attemptedUserMoves) * 100);

  const theme = BOARD_THEMES[boardTheme];

  if (trainableOpenings.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-[#32302a] bg-[#1e1d1a] p-8 text-center">
        <Target className="mb-3 h-10 w-10 text-stone-500" />
        <h2 className="text-lg font-bold text-stone-100">Nessuna linea da allenare</h2>
        <p className="mt-1 max-w-md text-sm text-stone-400">
          Inserisci almeno una mossa nelle tue aperture in modalità Editor per iniziare ad
          allenare il repertorio.
        </p>
        <button
          type="button"
          onClick={() => onExitToEditor()}
          className="mt-4 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-stone-950 hover:bg-emerald-400"
        >
          Torna all’Editor
        </button>
      </div>
    );
  }

  return (
    <div className="grid h-full grid-cols-1 gap-5 lg:grid-cols-12">
      {/* Colonna Sinistra: Scacchiera Allenamento */}
      <div className="flex flex-col items-center justify-start lg:col-span-7">
        <div
          ref={boardContainerRef}
          className={`flex w-full max-w-[600px] flex-col items-center rounded-2xl border bg-[#1e1d1a] p-4 shadow-xl transition-colors duration-200 ${
            feedback.type === 'wrong'
              ? 'border-rose-500 ring-2 ring-rose-500/35'
              : feedback.type === 'correct' || feedback.type === 'complete'
              ? 'border-emerald-500/70 ring-1 ring-emerald-500/20'
              : 'border-[#32302a]'
          }`}
        >
          {/* Barra Linea Corrente & Progresso */}
          <div className="mb-3 flex w-full items-center justify-between gap-2 text-xs">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                    activeLine?.color === 'white'
                      ? 'bg-stone-100 ring-1 ring-stone-400'
                      : 'bg-stone-900 ring-1 ring-stone-500'
                  }`}
                />
                <span className="truncate font-semibold text-stone-100">
                  {activeLine?.openingName}
                </span>
                <span className="text-stone-500">&rsaquo;</span>
                <span className="truncate font-semibold text-sky-300">
                  {activeLine?.lineName}
                </span>
              </div>
            </div>

            <div className="shrink-0 rounded-xl bg-[#161512] px-3 py-1.5 font-mono text-xs font-semibold text-emerald-400">
              Linea {Math.min(lineIndex + 1, queue.length)} di {queue.length}
            </div>
          </div>

          {/* Barra di avanzamento mosse nella linea */}
          {activeLine && (
            <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-[#161512]">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                style={{
                  width: `${Math.round((stepIndex / activeLine.moves.length) * 100)}%`,
                }}
              />
            </div>
          )}

          {/* Scacchiera Interattiva */}
          <div className="overflow-hidden rounded-xl shadow-2xl ring-1 ring-black/40">
            <Chessboard
              id="training-board"
              position={fen}
              boardWidth={boardWidth}
              boardOrientation={activeLine?.color ?? 'white'}
              onPieceDrop={handleUserMove}
              onSquareClick={onSquareClick}
              arePiecesDraggable={
                !sessionDone &&
                Boolean(expectedNode && expectedNode.color === userColorCode)
              }
              customSquareStyles={customSquareStyles}
              customArrows={customArrows}
              customLightSquareStyle={{ backgroundColor: theme.lightSquare }}
              customDarkSquareStyle={{ backgroundColor: theme.darkSquare }}
              animationDuration={220}
            />
          </div>

          {/* Controlli Rapidi */}
          <div className="mt-3.5 flex w-full flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => initLineState(activeLine, openings)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#32302a] bg-[#242320] px-3 py-2 text-xs font-medium text-stone-300 transition hover:bg-[#2d2b27]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Ripeti Linea
              </button>

              <button
                type="button"
                disabled={!expectedNode || expectedNode.color !== userColorCode}
                onClick={() => setShowHintArrow(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#32302a] bg-[#242320] px-3 py-2 text-xs font-medium text-amber-300 transition hover:border-amber-400/50 hover:bg-[#2d2b27] disabled:opacity-35"
              >
                <Lightbulb className="h-3.5 w-3.5" />
                Suggerimento
              </button>
            </div>

            {feedback.type === 'complete' && !sessionDone && (
              <button
                type="button"
                onClick={goToNextLine}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-stone-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
              >
                Prossima Linea
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Colonna Destra: Configurazione Allenamento, Metriche, Feedback & Commenti */}
      <div className="flex flex-col gap-4 lg:col-span-5">
        {/* Selettore Modalità (Mirato vs Shuffle) */}
        <div className="rounded-2xl border border-[#32302a] bg-[#1e1d1a] p-4">
          <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-[#161512] p-1">
            <button
              type="button"
              onClick={() => setSubMode('targeted')}
              className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                subMode === 'targeted'
                  ? 'bg-[#2a2824] text-emerald-300 ring-1 ring-emerald-500/40'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Target className="h-3.5 w-3.5" />
              Allenamento Mirato
            </button>
            <button
              type="button"
              onClick={() => setSubMode('shuffle')}
              className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                subMode === 'shuffle'
                  ? 'bg-[#2a2824] text-sky-300 ring-1 ring-sky-400/40'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Shuffle className="h-3.5 w-3.5" />
              Shuffle Globale
            </button>
          </div>

          {subMode === 'targeted' ? (
            <div className="mt-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-wider text-stone-400">
                  Cartelle &amp; Varianti ({selectedOpening?.name})
                </span>
                {selectedOpeningLines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => selectAllLinesInOpening(selectedOpening.id)}
                    className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300"
                  >
                    {selectedLineIds.length === 0 ? 'Tutte selezionate' : 'Seleziona tutte'}
                  </button>
                )}
              </div>

              <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
                {trainableOpenings.map((op) => {
                  const opLines = extractLines(op);
                  const isExpanded = expandedOpeningId === op.id;
                  const isActiveOpening = selectedOpening?.id === op.id;
                  const allSelectedInOp = isActiveOpening && selectedLineIds.length === 0;

                  return (
                    <div
                      key={op.id}
                      className={`rounded-xl border transition ${
                        isActiveOpening
                          ? 'border-emerald-500/45 bg-[#232520]'
                          : 'border-[#32302a] bg-[#161512]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedOpeningId((prev) => (prev === op.id ? '' : op.id))
                          }
                          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                          )}
                          <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${
                              op.color === 'white'
                                ? 'bg-stone-100'
                                : 'bg-stone-900 ring-1 ring-stone-500'
                            }`}
                          />
                          <span className="truncate text-xs font-semibold text-stone-100">
                            {op.name}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setExpandedOpeningId(op.id);
                            selectAllLinesInOpening(op.id);
                          }}
                          className={`shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-semibold transition ${
                            allSelectedInOp
                              ? 'bg-emerald-500 text-stone-950'
                              : 'bg-[#242320] text-stone-300 hover:bg-[#2d2b27]'
                          }`}
                        >
                          Tutte ({opLines.length})
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="space-y-1 border-t border-[#32302a]/80 px-2.5 py-2">
                          {opLines.map((l, idx) => {
                            const isChecked =
                              isActiveOpening &&
                              (selectedLineIds.length === 0 || selectedLineIds.includes(l.id));
                            const isSingleActive =
                              isActiveOpening &&
                              selectedLineIds.length === 1 &&
                              selectedLineIds[0] === l.id;

                            return (
                              <div
                                key={l.id}
                                className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-xs transition ${
                                  isSingleActive
                                    ? 'bg-emerald-500/15 text-emerald-200'
                                    : 'hover:bg-[#242320] text-stone-300'
                                }`}
                              >
                                <div className="flex min-w-0 flex-1 items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleLineSelection(op.id, l.id)}
                                    className="rounded border-stone-600 bg-[#161512] text-emerald-500 focus:ring-0"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => selectSingleLine(op.id, l.id)}
                                    title="Allena solo questa variante"
                                    className="truncate text-left font-medium hover:text-emerald-300"
                                  >
                                    #{idx + 1} {l.lineName}
                                  </button>
                                </div>
                                <span className="shrink-0 font-mono text-[10px] text-stone-500">
                                  {l.moves.length}m
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-stone-400">
                <label className="flex cursor-pointer items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={shuffleTargeted}
                    onChange={(e) => setShuffleTargeted(e.target.checked)}
                    className="rounded border-stone-600 bg-[#161512] text-sky-400 focus:ring-0"
                  />
                  Ordine casuale
                </label>
                <label className="flex cursor-pointer items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={loopTargeted}
                    onChange={(e) => setLoopTargeted(e.target.checked)}
                    className="rounded border-stone-600 bg-[#161512] text-emerald-500 focus:ring-0"
                  />
                  Loop
                </label>
                <label className="flex cursor-pointer items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={autoAdvance}
                    onChange={(e) => setAutoAdvance(e.target.checked)}
                    className="rounded border-stone-600 bg-[#161512] text-emerald-500 focus:ring-0"
                  />
                  Auto-avanza
                </label>
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="grid flex-1 grid-cols-3 gap-1.5 rounded-xl bg-[#161512] p-1">
                  {(
                    [
                      { key: 'both', label: 'Entrambi' },
                      { key: 'white', label: 'Bianco' },
                      { key: 'black', label: 'Nero' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setShuffleFilter(opt.key)}
                      className={`rounded-lg py-1.5 text-xs font-medium transition ${
                        shuffleFilter === opt.key
                          ? 'bg-[#2d2b27] text-stone-100'
                          : 'text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    startSession('shuffle', selectedOpeningId, selectedLineIds, shuffleTargeted, shuffleFilter)
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#32302a] bg-[#242320] px-3 py-2 text-xs font-medium text-sky-300 transition hover:border-sky-400/50"
                >
                  <Shuffle className="h-3.5 w-3.5" />
                  Rimescola
                </button>
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-xs text-stone-400">
                <input
                  type="checkbox"
                  checked={autoAdvance}
                  onChange={(e) => setAutoAdvance(e.target.checked)}
                  className="rounded border-stone-600 bg-[#161512] text-emerald-500 focus:ring-0"
                />
                Avanza automaticamente alla linea successiva
              </label>
            </div>
          )}
        </div>

        {/* Statistiche Sessione */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-2xl border border-[#32302a] bg-[#1e1d1a] p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-stone-400">
              <Award className="h-3.5 w-3.5 text-emerald-400" />
              Accuratezza
            </div>
            <div className="mt-1 font-mono text-xl font-bold text-stone-100">
              {accuracy}%
            </div>
          </div>

          <div className="rounded-2xl border border-[#32302a] bg-[#1e1d1a] p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-stone-400">
              <Flame className="h-3.5 w-3.5 text-amber-400" />
              Serie
            </div>
            <div className="mt-1 font-mono text-xl font-bold text-stone-100">{streak}</div>
          </div>

          <div className="rounded-2xl border border-[#32302a] bg-[#1e1d1a] p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-stone-400">
              <Trophy className="h-3.5 w-3.5 text-sky-400" />
              Completate
            </div>
            <div className="mt-1 font-mono text-xl font-bold text-stone-100">
              {completedLinesCount}
            </div>
          </div>
        </div>

        {/* Pannello Feedback Quiz */}
        <div className="rounded-2xl border border-[#32302a] bg-[#1e1d1a] p-4">
          {sessionDone ? (
            <div className="text-center py-3">
              <Trophy className="mx-auto mb-2 h-8 w-8 text-emerald-400" />
              <h3 className="text-base font-bold text-stone-100">Sessione Completata!</h3>
              <p className="mt-1 text-xs text-stone-400">
                Hai completato tutte le {queue.length} linee con un’accuratezza del {accuracy}%.
              </p>
              <button
                type="button"
                onClick={() =>
                  startSession(subMode, selectedOpeningId, selectedLineIds, shuffleTargeted, shuffleFilter)
                }
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-stone-950 hover:bg-emerald-400"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Nuova Sessione
              </button>
            </div>
          ) : feedback.type === 'wrong' ? (
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
              <div>
                <p className="text-sm font-semibold text-rose-300">
                  Mossa errata ({feedback.attemptedSan})
                </p>
                <p className="mt-1 text-xs text-stone-300">
                  La mossa prevista dal repertorio è{' '}
                  <span className="rounded bg-[#2d2b27] px-1.5 py-0.5 font-mono font-bold text-emerald-400">
                    {feedback.expectedSan}
                  </span>
                  . Segui la freccia verde sulla scacchiera e riprova.
                </p>
              </div>
            </div>
          ) : feedback.type === 'complete' ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                <div>
                  <p className="text-sm font-semibold text-emerald-300">
                    Linea memorizzata con successo!
                  </p>
                  <p className="mt-0.5 text-xs text-stone-400">
                    Ottimo lavoro su {activeLine?.lineName}.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={goToNextLine}
                className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-bold text-stone-950 hover:bg-emerald-400"
              >
                Avanti
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : expectedNode && expectedNode.color !== userColorCode ? (
            <p className="text-xs text-stone-400">
              L’avversario sta rispondendo...
            </p>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-xs text-stone-300">
                Tocca a te ({activeLine?.color === 'white' ? 'Bianco' : 'Nero'}): gioca la
                mossa corretta del repertorio.
              </p>
              {feedback.type === 'correct' && (
                <span className="rounded-lg bg-emerald-500/15 px-2 py-0.5 font-mono text-xs font-semibold text-emerald-300">
                  ✓ {feedback.san}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Pannello Commento Strategico (visibile quando la mossa eseguita ha un commento) */}
        <div className="flex-1 rounded-2xl border border-[#32302a] bg-[#1e1d1a] p-4">
          <div className="mb-2 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-amber-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-300">
              Spiegazione & Piano Strategico
            </h3>
          </div>

          {activeComment ? (
            <div className="rounded-xl border border-amber-500/25 bg-[#161512] p-3.5">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="rounded bg-amber-500/15 px-2 py-0.5 font-mono text-xs font-bold text-amber-300">
                  {activeComment.moveLabel}
                </span>
                <span className="text-[11px] text-stone-400">
                  {activeComment.author === 'user' ? 'Tua mossa' : 'Risposta avversario'}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-200">
                {activeComment.text}
              </p>
            </div>
          ) : (
            <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-[#32302a] px-4 text-center text-xs text-stone-500">
              Quando esegui (o ricevi) una mossa annotata nel repertorio, la spiegazione
              strategica apparirà qui per rinforzare la memorizzazione.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
