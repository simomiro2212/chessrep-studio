import type { MoveNode, OpeningRepertoire, RepertoireColor } from '../types/repertoire';
import { addOrSelectMove, createEmptyOpening, INITIAL_FEN, updateNodeComment } from './tree';

function escapePgnComment(text: string): string {
  return text.replace(/[{}]/g, (ch) => (ch === '{' ? '(' : ')')).trim();
}

export function exportOpeningToPgn(opening: OpeningRepertoire): string {
  const lines: string[] = [
    `[Event "${opening.name.replace(/"/g, "'")}"]`,
    `[Site "ChessRep Studio"]`,
    `[White "${opening.color === 'white' ? 'Repertorio Utente' : 'Avversario'}"]`,
    `[Black "${opening.color === 'black' ? 'Repertorio Utente' : 'Avversario'}"]`,
    `[Result "*"]`,
  ];

  if (opening.eco) {
    lines.push(`[ECO "${opening.eco}"]`);
  }

  const root = opening.nodes[opening.rootId];
  if (root && root.fen !== INITIAL_FEN) {
    lines.push(`[SetUp "1"]`);
    lines.push(`[FEN "${root.fen}"]`);
  }

  lines.push('');

  function serializeSequence(nodeId: string, forceMoveNumber: boolean): string {
    const node = opening.nodes[nodeId];
    if (!node) return '';

    const parts: string[] = [];

    if (node.parentId !== null && node.san) {
      const moveNum = Math.ceil(node.ply / 2);
      if (node.ply % 2 === 1) {
        parts.push(`${moveNum}. ${node.san}`);
      } else if (forceMoveNumber) {
        parts.push(`${moveNum}... ${node.san}`);
      } else {
        parts.push(node.san);
      }

      if (node.comment.trim()) {
        parts.push(`{${escapePgnComment(node.comment)}}`);
      }
    }

    if (node.childrenIds.length === 0) {
      return parts.join(' ');
    }

    const [mainChildId, ...varChildIds] = node.childrenIds;
    const mainNode = opening.nodes[mainChildId];
    if (mainNode && mainNode.san) {
      const moveNum = Math.ceil(mainNode.ply / 2);
      const showBlackNum =
        mainNode.ply % 2 === 0 && (node.parentId === null || node.comment.trim().length > 0);

      if (mainNode.ply % 2 === 1) {
        parts.push(`${moveNum}. ${mainNode.san}`);
      } else if (showBlackNum) {
        parts.push(`${moveNum}... ${mainNode.san}`);
      } else {
        parts.push(mainNode.san);
      }

      if (mainNode.comment.trim()) {
        parts.push(`{${escapePgnComment(mainNode.comment)}}`);
      }

      // Sottovarianti alternative a mainNode (figli secondari di `node`)
      for (const varId of varChildIds) {
        const varText = serializeFromNode(varId, true);
        if (varText) {
          parts.push(`(${varText})`);
        }
      }

      // Continua lungo la linea principale dopo mainNode
      const rest = serializeContinuations(mainNode, varChildIds.length > 0);
      if (rest) {
        parts.push(rest);
      }
    }

    return parts.join(' ');
  }

  function serializeFromNode(nodeId: string, forceMoveNumber: boolean): string {
    const node = opening.nodes[nodeId];
    if (!node || !node.san) return '';
    const parts: string[] = [];
    const moveNum = Math.ceil(node.ply / 2);
    if (node.ply % 2 === 1) {
      parts.push(`${moveNum}. ${node.san}`);
    } else if (forceMoveNumber) {
      parts.push(`${moveNum}... ${node.san}`);
    } else {
      parts.push(node.san);
    }

    if (node.comment.trim()) {
      parts.push(`{${escapePgnComment(node.comment)}}`);
    }

    const rest = serializeContinuations(node, false);
    if (rest) {
      parts.push(rest);
    }
    return parts.join(' ');
  }

  function serializeContinuations(node: MoveNode, forceBlackNum = false): string {
    if (node.childrenIds.length === 0) return '';
    const [mainChildId, ...varChildIds] = node.childrenIds;
    const parts: string[] = [];
    const mainNode = opening.nodes[mainChildId];
    if (!mainNode || !mainNode.san) return '';

    // Prima emetti la mossa principale, poi le sue sorelle tra parentesi, poi la continuazione
    const moveNum = Math.ceil(mainNode.ply / 2);
    if (mainNode.ply % 2 === 1) {
      parts.push(`${moveNum}. ${mainNode.san}`);
    } else if (forceBlackNum || node.comment.trim().length > 0) {
      parts.push(`${moveNum}... ${mainNode.san}`);
    } else {
      parts.push(mainNode.san);
    }

    if (mainNode.comment.trim()) {
      parts.push(`{${escapePgnComment(mainNode.comment)}}`);
    }

    for (const varId of varChildIds) {
      const varText = serializeFromNode(varId, true);
      if (varText) {
        parts.push(`(${varText})`);
      }
    }

    const tail = serializeContinuations(mainNode, varChildIds.length > 0);
    if (tail) {
      parts.push(tail);
    }

    return parts.join(' ');
  }

  const body = root ? serializeSequence(root.id, true).trim() : '';
  lines.push(`${body ? body + ' ' : ''}*`);
  return lines.join('\n');
}

type Token =
  | { type: 'comment'; value: string }
  | { type: 'lparen' }
  | { type: 'rparen' }
  | { type: 'word'; value: string };

function tokenizePgnBody(body: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < body.length) {
    const ch = body[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (ch === '{') {
      const end = body.indexOf('}', i + 1);
      const comment = end === -1 ? body.slice(i + 1) : body.slice(i + 1, end);
      tokens.push({ type: 'comment', value: comment.trim() });
      i = end === -1 ? body.length : end + 1;
      continue;
    }

    if (ch === ';') {
      const end = body.indexOf('\n', i + 1);
      const comment = end === -1 ? body.slice(i + 1) : body.slice(i + 1, end);
      tokens.push({ type: 'comment', value: comment.trim() });
      i = end === -1 ? body.length : end + 1;
      continue;
    }

    if (ch === '(') {
      tokens.push({ type: 'lparen' });
      i++;
      continue;
    }

    if (ch === ')') {
      tokens.push({ type: 'rparen' });
      i++;
      continue;
    }

    let j = i;
    while (j < body.length && !/[\s{}();]/.test(body[j])) {
      j++;
    }
    const word = body.slice(i, j);
    if (word) {
      tokens.push({ type: 'word', value: word });
    }
    i = j;
  }

  return tokens;
}

/**
 * Importa un testo PGN (anche con commenti { ... } e varianti ricorsive ( ... )) in un OpeningRepertoire.
 */
export function importPgnIntoOpening(
  pgnText: string,
  options: { name?: string; color: RepertoireColor; folder?: string }
): OpeningRepertoire {
  const headers: Record<string, string> = {};
  const headerRegex = /^\s*\[([A-Za-z0-9_]+)\s+"([^"]*)"\]\s*$/gm;
  let match: RegExpExecArray | null;
  let lastHeaderEnd = 0;

  while ((match = headerRegex.exec(pgnText)) !== null) {
    headers[match[1]] = match[2];
    lastHeaderEnd = headerRegex.lastIndex;
  }

  const body = pgnText.slice(lastHeaderEnd).trim();
  const inferredName =
    options.name?.trim() || headers.Opening || headers.Event || 'Apertura Importata';

  let opening = createEmptyOpening({
    name: inferredName,
    color: options.color,
    folder: options.folder || 'Importate',
    eco: headers.ECO || '',
    startFen: headers.FEN || undefined,
  });

  const tokens = tokenizePgnBody(body);

  interface StackFrame {
    parentOfLastMoveId: string;
    currentId: string;
  }

  let currentId = opening.rootId;
  let parentOfLastMoveId = opening.rootId;
  const stack: StackFrame[] = [];

  for (const token of tokens) {
    if (token.type === 'lparen') {
      // Una variante tra parentesi diverge dallo stato PRIMA dell'ultima mossa giocata
      stack.push({ parentOfLastMoveId, currentId });
      currentId = parentOfLastMoveId;
      continue;
    }

    if (token.type === 'rparen') {
      const prev = stack.pop();
      if (prev) {
        currentId = prev.currentId;
        parentOfLastMoveId = prev.parentOfLastMoveId;
      }
      continue;
    }

    if (token.type === 'comment') {
      const existing = opening.nodes[currentId]?.comment ?? '';
      const merged = existing ? `${existing}\n${token.value}` : token.value;
      opening = updateNodeComment(opening, currentId, merged);
      continue;
    }

    const w = token.value;
    // Ignora numeri di mossa (es. "1.", "12...", "...") e risultati
    if (
      /^\d+\.+$/.test(w) ||
      w === '...' ||
      w === '*' ||
      w === '1-0' ||
      w === '0-1' ||
      w === '1/2-1/2' ||
      /^\$\d+$/.test(w)
    ) {
      continue;
    }

    // Rimuovi eventuale prefisso numero mossa attaccato (es. "1.e4" o "3...Nc6")
    const cleanedSan = w.replace(/^\d+\.+/, '').replace(/[!?]+$/, '');
    if (!cleanedSan) continue;

    const result = addOrSelectMove(opening, currentId, cleanedSan);
    if (result) {
      opening = result.opening;
      parentOfLastMoveId = currentId;
      currentId = result.targetNodeId;
    }
  }

  return opening;
}
