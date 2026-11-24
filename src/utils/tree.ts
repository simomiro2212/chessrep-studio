import { Chess, type Move, type Square } from 'chess.js';
import type {
  MoveNode,
  OpeningRepertoire,
  RepertoireColor,
  TrainingLine,
} from '../types/repertoire';

export const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `node_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createEmptyOpening(params: {
  name: string;
  color: RepertoireColor;
  folder?: string;
  eco?: string;
  description?: string;
  startFen?: string;
}): OpeningRepertoire {
  const chess = new Chess(params.startFen ?? INITIAL_FEN);
  const rootId = generateId();
  const now = new Date().toISOString();

  const rootNode: MoveNode = {
    id: rootId,
    parentId: null,
    san: null,
    uci: null,
    from: null,
    to: null,
    fen: chess.fen(),
    ply: 0,
    color: null,
    comment: '',
    lineName: 'Linea Principale',
    childrenIds: [],
  };

  return {
    id: generateId(),
    name: params.name.trim() || 'Nuova Apertura',
    folder: params.folder?.trim() || 'Generale',
    eco: params.eco?.trim() || '',
    description: params.description?.trim() || '',
    color: params.color,
    rootId,
    nodes: { [rootId]: rootNode },
    createdAt: now,
    updatedAt: now,
  };
}

export interface MoveAddResult {
  opening: OpeningRepertoire;
  targetNodeId: string;
  isNewMove: boolean;
  isNewBranch: boolean;
  move: Move;
}

/**
 * Esegue una mossa a partire da `currentNodeId`.
 * - Se la mossa esiste già tra i figli del nodo corrente, seleziona quel nodo senza duplicare.
 * - Se la mossa è nuova, crea un nuovo MoveNode (creando automaticamente una variante se il padre aveva già figli).
 */
export function addOrSelectMove(
  opening: OpeningRepertoire,
  currentNodeId: string,
  moveInput: string | { from: string; to: string; promotion?: string }
): MoveAddResult | null {
  const parentNode = opening.nodes[currentNodeId];
  if (!parentNode) return null;

  let move: Move;
  const chess = new Chess(parentNode.fen);
  try {
    move = chess.move(moveInput);
  } catch {
    return null;
  }

  // Controlla se la mossa esiste già come figlio di parentNode
  for (const childId of parentNode.childrenIds) {
    const child = opening.nodes[childId];
    if (child && child.san === move.san) {
      return {
        opening,
        targetNodeId: child.id,
        isNewMove: false,
        isNewBranch: false,
        move,
      };
    }
  }

  const newNodeId = generateId();
  const isNewBranch = parentNode.childrenIds.length > 0;
  const newNode: MoveNode = {
    id: newNodeId,
    parentId: parentNode.id,
    san: move.san,
    uci: `${move.from}${move.to}${move.promotion ?? ''}`,
    from: move.from as Square,
    to: move.to as Square,
    fen: chess.fen(),
    ply: parentNode.ply + 1,
    color: move.color,
    comment: '',
    childrenIds: [],
  };

  const nextNodes: Record<string, MoveNode> = {
    ...opening.nodes,
    [parentNode.id]: {
      ...parentNode,
      childrenIds: [...parentNode.childrenIds, newNodeId],
    },
    [newNodeId]: newNode,
  };

  return {
    opening: {
      ...opening,
      nodes: nextNodes,
      updatedAt: new Date().toISOString(),
    },
    targetNodeId: newNodeId,
    isNewMove: true,
    isNewBranch,
    move,
  };
}

export function updateNodeComment(
  opening: OpeningRepertoire,
  nodeId: string,
  comment: string
): OpeningRepertoire {
  const node = opening.nodes[nodeId];
  if (!node) return opening;

  return {
    ...opening,
    nodes: {
      ...opening.nodes,
      [nodeId]: {
        ...node,
        comment,
      },
    },
    updatedAt: new Date().toISOString(),
  };
}

export function renameNodeLine(
  opening: OpeningRepertoire,
  nodeId: string,
  lineName: string
): OpeningRepertoire {
  const node = opening.nodes[nodeId];
  if (!node) return opening;

  const trimmed = lineName.trim();
  return {
    ...opening,
    nodes: {
      ...opening.nodes,
      [nodeId]: {
        ...node,
        lineName: trimmed.length > 0 ? trimmed : undefined,
      },
    },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Elimina un nodo e tutto il suo sotto-albero.
 * Non elimina mai il nodo radice (se invocato sulla radice, svuota solo le mosse).
 */
export function deleteBranch(
  opening: OpeningRepertoire,
  nodeId: string
): { opening: OpeningRepertoire; fallbackNodeId: string } {
  const target = opening.nodes[nodeId];
  if (!target) {
    return { opening, fallbackNodeId: opening.rootId };
  }

  const toDelete = new Set<string>();
  const stack = [nodeId];

  while (stack.length > 0) {
    const id = stack.pop()!;
    const n = opening.nodes[id];
    if (!n) continue;
    if (id !== opening.rootId) {
      toDelete.add(id);
    }
    for (const cid of n.childrenIds) {
      stack.push(cid);
    }
  }

  const nextNodes: Record<string, MoveNode> = {};
  for (const [id, n] of Object.entries(opening.nodes)) {
    if (!toDelete.has(id)) {
      nextNodes[id] = { ...n };
    }
  }

  let fallbackNodeId = opening.rootId;

  if (nodeId === opening.rootId) {
    nextNodes[opening.rootId] = {
      ...nextNodes[opening.rootId],
      childrenIds: [],
    };
    fallbackNodeId = opening.rootId;
  } else if (target.parentId && nextNodes[target.parentId]) {
    const parent = nextNodes[target.parentId];
    nextNodes[target.parentId] = {
      ...parent,
      childrenIds: parent.childrenIds.filter((cid) => cid !== nodeId),
    };
    fallbackNodeId = parent.id;
  }

  return {
    opening: {
      ...opening,
      nodes: nextNodes,
      updatedAt: new Date().toISOString(),
    },
    fallbackNodeId,
  };
}

/**
 * Promuove una variante a linea principale (sposta nodeId in posizione 0 nei figli del padre).
 */
export function promoteVariation(
  opening: OpeningRepertoire,
  nodeId: string
): OpeningRepertoire {
  const node = opening.nodes[nodeId];
  if (!node || !node.parentId) return opening;
  const parent = opening.nodes[node.parentId];
  if (!parent) return opening;

  const idx = parent.childrenIds.indexOf(nodeId);
  if (idx <= 0) return opening;

  const reordered = [nodeId, ...parent.childrenIds.filter((id) => id !== nodeId)];
  return {
    ...opening,
    nodes: {
      ...opening.nodes,
      [parent.id]: {
        ...parent,
        childrenIds: reordered,
      },
    },
    updatedAt: new Date().toISOString(),
  };
}

export function getPathToNode(opening: OpeningRepertoire, nodeId: string): MoveNode[] {
  const path: MoveNode[] = [];
  let cursor: MoveNode | undefined = opening.nodes[nodeId];
  const visited = new Set<string>();

  while (cursor && !visited.has(cursor.id)) {
    visited.add(cursor.id);
    path.unshift(cursor);
    cursor = cursor.parentId ? opening.nodes[cursor.parentId] : undefined;
  }

  return path;
}

export function getMainlineEndId(opening: OpeningRepertoire, startId: string): string {
  let cursor = opening.nodes[startId];
  const visited = new Set<string>();

  while (cursor && cursor.childrenIds.length > 0 && !visited.has(cursor.id)) {
    visited.add(cursor.id);
    const next = opening.nodes[cursor.childrenIds[0]];
    if (!next) break;
    cursor = next;
  }
  return cursor ? cursor.id : opening.rootId;
}

export function formatMovePrefix(ply: number): string {
  const moveNum = Math.ceil(ply / 2);
  return ply % 2 === 1 ? `${moveNum}.` : `${moveNum}...`;
}

/**
 * Estrae tutte le linee allenabili (dalla prima mossa fino a ogni nodo foglia).
 */
export function extractLines(opening: OpeningRepertoire): TrainingLine[] {
  const root = opening.nodes[opening.rootId];
  if (!root || root.childrenIds.length === 0) return [];

  const lines: TrainingLine[] = [];

  function dfs(nodeId: string, path: MoveNode[], isPureMainline: boolean, branchCounter: { count: number }) {
    const node = opening.nodes[nodeId];
    if (!node) return;

    const nextPath = node.parentId === null ? path : [...path, node];

    if (node.childrenIds.length === 0) {
      if (nextPath.length > 0) {
        // Cerca il nome più specifico lungo il percorso (dall'ultima mossa verso l'inizio)
        let resolvedName: string | undefined;
        for (let i = nextPath.length - 1; i >= 0; i--) {
          if (nextPath[i].lineName) {
            resolvedName = nextPath[i].lineName;
            break;
          }
        }

        if (!resolvedName) {
          if (isPureMainline) {
            resolvedName = root.lineName || 'Linea Principale';
          } else {
            branchCounter.count += 1;
            // Trova il primo nodo dove si è diramato
            let forkLabel = '';
            for (const m of nextPath) {
              const p = m.parentId ? opening.nodes[m.parentId] : undefined;
              if (p && p.childrenIds.length > 1 && p.childrenIds[0] !== m.id && m.san) {
                forkLabel = `${formatMovePrefix(m.ply)} ${m.san}`;
              }
            }
            resolvedName = forkLabel
              ? `Variante ${forkLabel}`
              : `Variante #${branchCounter.count}`;
          }
        }

        const commentCount = nextPath.filter((m) => m.comment.trim().length > 0).length;

        lines.push({
          id: node.id,
          openingId: opening.id,
          openingName: opening.name,
          folder: opening.folder,
          color: opening.color,
          lineName: resolvedName,
          moves: nextPath,
          commentCount,
        });
      }
      return;
    }

    node.childrenIds.forEach((childId, idx) => {
      dfs(childId, nextPath, isPureMainline && idx === 0, branchCounter);
    });
  }

  dfs(opening.rootId, [], true, { count: 0 });
  return lines;
}

export function countOpeningNodes(opening: OpeningRepertoire): {
  movesCount: number;
  commentsCount: number;
  linesCount: number;
} {
  const allNodes = Object.values(opening.nodes).filter((n) => n.parentId !== null);
  const linesCount = allNodes.filter((n) => n.childrenIds.length === 0).length;
  const commentsCount = allNodes.filter((n) => n.comment.trim().length > 0).length;
  return {
    movesCount: allNodes.length,
    commentsCount,
    linesCount,
  };
}
