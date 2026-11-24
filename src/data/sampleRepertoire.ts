import type { OpeningRepertoire, RepertoireColor } from '../types/repertoire';
import { addOrSelectMove, createEmptyOpening, renameNodeLine, updateNodeComment } from '../utils/tree';

function buildLine(
  opening: OpeningRepertoire,
  moves: Array<{ san: string; comment?: string; lineName?: string }>
): OpeningRepertoire {
  let op = opening;
  let currentId = op.rootId;

  for (const step of moves) {
    const res = addOrSelectMove(op, currentId, step.san);
    if (!res) break;
    op = res.opening;
    currentId = res.targetNodeId;
    if (step.comment) {
      op = updateNodeComment(op, currentId, step.comment);
    }
    if (step.lineName) {
      op = renameNodeLine(op, currentId, step.lineName);
    }
  }

  return op;
}

function createSampleOpening(
  name: string,
  color: RepertoireColor,
  folder: string,
  eco: string,
  description: string,
  lines: Array<Array<{ san: string; comment?: string; lineName?: string }>>
): OpeningRepertoire {
  let op = createEmptyOpening({ name, color, folder, eco, description });
  for (const line of lines) {
    op = buildLine(op, line);
  }
  return op;
}

export function createDefaultSampleRepertoire(): OpeningRepertoire[] {
  const italiana = createSampleOpening(
    'Apertura Italiana — Giuoco Piano',
    'white',
    '1. e4 — Repertorio Bianco',
    'C50',
    'Repertorio solido e aggressivo con il Bianco basato sul controllo del centro con c3 e d4.',
    [
      [
        { san: 'e4', comment: 'Controlliamo subito il centro e apriamo le diagonali per Alfiere e Donna.' },
        { san: 'e5' },
        { san: 'Nf3', comment: 'Sviluppiamo il Cavallo attaccando il pedone e5.' },
        { san: 'Nc6' },
        { san: 'Bc4', comment: 'L’Alfiere punta al punto debole f7.' },
        { san: 'Bc5' },
        {
          san: 'c3',
          lineName: 'Giuoco Piano (c3 + d4)',
          comment: 'Prepariamo la spinta centrale d4 con guadagno di tempo sull’Alfiere in c5.',
        },
        { san: 'Nf6' },
        {
          san: 'd4',
          comment: 'Apriamo il centro prima che il Nero completi l’arrocco.',
        },
        { san: 'exd4' },
        { san: 'cxd4' },
        { san: 'Bb4+' },
        {
          san: 'Bd2',
          comment: 'Preferiamo Bd2 a Nc3 per evitare inchiodature fastidiose dopo Nxe4.',
        },
      ],
      [
        { san: 'e4' },
        { san: 'e5' },
        { san: 'Nf3' },
        { san: 'Nc6' },
        { san: 'Bc4' },
        { san: 'Nf6', comment: 'Difesa dei Due Cavalli: il Nero contrattacca subito e4.' },
        {
          san: 'd3',
          lineName: 'Contro Due Cavalli (3...Nf6 4.d3)',
          comment: 'Linea posizionale moderna: difendiamo e4 con calma e manteniamo la struttura intatta.',
        },
        { san: 'Be7' },
        { san: 'O-O' },
        { san: 'O-O' },
        {
          san: 'Re1',
          comment: 'Sovrapproteggiamo e4 preparando c3 e d4 al momento opportuno.',
        },
      ],
    ]
  );

  const gambettoDonna = createSampleOpening(
    'Gambetto di Donna Rifiutato',
    'white',
    '1. d4 — Repertorio Bianco',
    'D35',
    'Piano posizionale con la Variante di Cambio e attacco di minoranza sull’ala di Donna.',
    [
      [
        { san: 'd4' },
        { san: 'd5' },
        { san: 'c4', comment: 'Attacchiamo il centro nero da lato per deviare il pedone d5.' },
        { san: 'e6' },
        { san: 'Nc3' },
        { san: 'Nf6' },
        {
          san: 'cxd5',
          lineName: 'Variante di Cambio',
          comment: 'Fissiamo la struttura centrale: dopo exd5 il nostro piano sarà l’attacco di minoranza (b4-b5).',
        },
        { san: 'exd5' },
        {
          san: 'Bg5',
          comment: 'Inchiodiamo il Cavallo in f6 creando pressione su d5.',
        },
      ],
    ]
  );

  const sicilianaNajdorf = createSampleOpening(
    'Difesa Siciliana — Variante Najdorf',
    'black',
    'Contro 1. e4 — Repertorio Nero',
    'B90',
    'La difesa più dinamica contro 1.e4: gioco asimmetrico sulla colonna c e controgioco sull’ala di Donna.',
    [
      [
        { san: 'e4' },
        { san: 'c5', comment: 'Lottiamo per la casa d4 in modo asimmetrico fin dalla prima mossa.' },
        { san: 'Nf3' },
        { san: 'd6', comment: 'Controlliamo e5 e prepariamo lo sviluppo naturale.' },
        { san: 'd4' },
        { san: 'cxd4' },
        { san: 'Nxd4' },
        { san: 'Nf6' },
        { san: 'Nc3' },
        {
          san: 'a6',
          comment: 'Mossa simbolo della Najdorf: impedisce Bb5+, Nb5 e prepara la spinta b5.',
        },
        { san: 'Bg5' },
        {
          san: 'e6',
          lineName: 'Variante con 6.Bg5',
          comment: 'Blinda la casa d5 e attiva la diagonale dell’Alfiere f8.',
        },
        { san: 'f4' },
        {
          san: 'Be7',
          comment: 'Sviluppo solido per rompere l’inchiodatura su f6 prima di arroccare o spingere b5.',
        },
      ],
      [
        { san: 'e4' },
        { san: 'c5' },
        { san: 'Nf3' },
        { san: 'd6' },
        { san: 'd4' },
        { san: 'cxd4' },
        { san: 'Nxd4' },
        { san: 'Nf6' },
        { san: 'Nc3' },
        { san: 'a6' },
        { san: 'Be3', comment: 'Attacco Inglese: il Bianco prepara f3, Qd2 e O-O-O.' },
        {
          san: 'e5',
          lineName: 'Attacco Inglese (6.Be3 e5)',
          comment: 'Prendiamo spazio al centro cacciando il Cavallo da d4 prima che il Bianco si consolidi.',
        },
        { san: 'Nb3' },
        {
          san: 'Be6',
          comment: 'Sviluppiamo l’Alfiere controllando la casa d5 ed evitando f3+g4 senza contrasto.',
        },
      ],
    ]
  );

  return [italiana, gambettoDonna, sicilianaNajdorf];
}
