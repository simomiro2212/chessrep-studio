import React, { useEffect, useMemo, useState } from 'react';
import { FileText, FolderPlus, GitBranch, Upload, X } from 'lucide-react';
import type { RepertoireColor } from '../types/repertoire';
import { parsePgnPreview } from '../utils/pgn';

interface NewOpeningModalProps {
  open: boolean;
  defaultColor: RepertoireColor;
  existingFolders: string[];
  onClose: () => void;
  onCreate: (data: {
    name: string;
    color: RepertoireColor;
    folder: string;
    eco: string;
    description: string;
  }) => void;
}

export const NewOpeningModal: React.FC<NewOpeningModalProps> = ({
  open,
  defaultColor,
  existingFolders,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState<RepertoireColor>(defaultColor);
  const [folder, setFolder] = useState(
    defaultColor === 'white' ? '1. e4 — Repertorio Bianco' : 'Contro 1. e4 — Repertorio Nero'
  );
  const [eco, setEco] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (open) {
      setColor(defaultColor);
      setFolder(
        defaultColor === 'white'
          ? '1. e4 — Repertorio Bianco'
          : 'Contro 1. e4 — Repertorio Nero'
      );
    }
  }, [open, defaultColor]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate({
      name: name.trim(),
      color,
      folder: folder.trim() || 'Generale',
      eco: eco.trim().toUpperCase(),
      description: description.trim(),
    });
    setName('');
    setEco('');
    setDescription('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-[#32302a] bg-[#1e1d1a] p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
              <FolderPlus className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-semibold text-stone-100">Nuova Apertura</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 transition hover:bg-[#2d2b27] hover:text-stone-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-stone-400">
              Colore Repertorio
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setColor('white')}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                  color === 'white'
                    ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                    : 'border-[#32302a] bg-[#242320] text-stone-300 hover:border-stone-500'
                }`}
              >
                <span className="h-3.5 w-3.5 rounded-full border border-stone-400 bg-stone-100" />
                Bianco
              </button>
              <button
                type="button"
                onClick={() => setColor('black')}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                  color === 'black'
                    ? 'border-sky-400 bg-sky-500/15 text-sky-300'
                    : 'border-[#32302a] bg-[#242320] text-stone-300 hover:border-stone-500'
                }`}
              >
                <span className="h-3.5 w-3.5 rounded-full border border-stone-500 bg-stone-900" />
                Nero
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-stone-400">
              Nome Apertura *
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="es. Difesa Siciliana - Variante Najdorf"
              className="w-full rounded-xl border border-[#32302a] bg-[#161512] px-3.5 py-2.5 text-sm text-stone-100 placeholder-stone-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-stone-400">
                Cartella
              </label>
              <input
                type="text"
                list="existing-folders"
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                placeholder="es. 1. e4"
                className="w-full rounded-xl border border-[#32302a] bg-[#161512] px-3.5 py-2.5 text-sm text-stone-100 placeholder-stone-500 focus:border-emerald-500 focus:outline-none"
              />
              <datalist id="existing-folders">
                {existingFolders.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-stone-400">
                ECO
              </label>
              <input
                type="text"
                maxLength={5}
                value={eco}
                onChange={(e) => setEco(e.target.value)}
                placeholder="B90"
                className="w-full rounded-xl border border-[#32302a] bg-[#161512] px-3 py-2.5 text-sm uppercase text-stone-100 placeholder-stone-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-stone-400">
              Note / Obiettivo
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve descrizione dei piani principali..."
              className="w-full resize-none rounded-xl border border-[#32302a] bg-[#161512] px-3.5 py-2 text-sm text-stone-100 placeholder-stone-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#32302a] px-4 py-2 text-sm font-medium text-stone-300 transition hover:bg-[#2d2b27]"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-emerald-400"
            >
              Crea Apertura
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface ImportPgnModalProps {
  open: boolean;
  defaultColor: RepertoireColor;
  onClose: () => void;
  onImport: (data: { pgn: string; name: string; color: RepertoireColor; folder: string }) => void;
}

export const ImportPgnModal: React.FC<ImportPgnModalProps> = ({
  open,
  defaultColor,
  onClose,
  onImport,
}) => {
  const [pgn, setPgn] = useState('');
  const [name, setName] = useState('');
  const [color, setColor] = useState<RepertoireColor>(defaultColor);
  const [folder, setFolder] = useState('Importate PGN');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setColor(defaultColor);
      setError('');
    }
  }, [open, defaultColor]);

  if (!open) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPgn(reader.result);
        if (!name) {
          setName(file.name.replace(/\.pgn$/i, ''));
        }
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pgn.trim()) {
      setError('Incolla un testo PGN oppure carica un file .pgn.');
      return;
    }
    setError('');
    onImport({ pgn, name: name.trim(), color, folder: folder.trim() || 'Importate PGN' });
    setPgn('');
    setName('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-[#32302a] bg-[#1e1d1a] p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
              <FileText className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-semibold text-stone-100">Importa PGN con Varianti</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 transition hover:bg-[#2d2b27] hover:text-stone-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-stone-400">
                Nome Apertura (opzionale)
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Da header PGN se vuoto"
                className="w-full rounded-xl border border-[#32302a] bg-[#161512] px-3 py-2 text-sm text-stone-100 placeholder-stone-500 focus:border-sky-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-stone-400">
                Colore
              </label>
              <select
                value={color}
                onChange={(e) => setColor(e.target.value as RepertoireColor)}
                className="w-full rounded-xl border border-[#32302a] bg-[#161512] px-3 py-2 text-sm text-stone-100 focus:border-sky-400 focus:outline-none"
              >
                <option value="white">Bianco</option>
                <option value="black">Nero</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-stone-400">
              Cartella
            </label>
            <input
              type="text"
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              className="w-full rounded-xl border border-[#32302a] bg-[#161512] px-3 py-2 text-sm text-stone-100 focus:border-sky-400 focus:outline-none"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium uppercase tracking-wider text-stone-400">
                Testo PGN (supporta varianti e commenti)
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#32302a] bg-[#242320] px-2.5 py-1 text-xs font-medium text-stone-300 transition hover:border-sky-400/50 hover:text-sky-300">
                <Upload className="h-3.5 w-3.5" />
                Carica .pgn
                <input type="file" accept=".pgn,.txt" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
            <textarea
              rows={6}
              value={pgn}
              onChange={(e) => setPgn(e.target.value)}
              placeholder="1. e4 c5 2. Nf3 d6 (2... Nc6 3. Bb5 {Variante Rossolimo}) 3. d4 cxd4 4. Nxd4 Nf6 *"
              className="w-full rounded-xl border border-[#32302a] bg-[#161512] p-3 font-mono text-xs text-stone-200 placeholder-stone-500 focus:border-sky-400 focus:outline-none"
            />
          </div>

          {error && <p className="text-xs text-rose-400">{error}</p>}

          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#32302a] px-4 py-2 text-sm font-medium text-stone-300 transition hover:bg-[#2d2b27]"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-sky-400"
            >
              Importa Apertura
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface ImportPgnIntoFolderModalProps {
  open: boolean;
  openingName: string;
  onClose: () => void;
  onImport: (data: { pgn: string; variantName: string }) => void;
}

export const ImportPgnIntoFolderModal: React.FC<ImportPgnIntoFolderModalProps> = ({
  open,
  openingName,
  onClose,
  onImport,
}) => {
  const [pgn, setPgn] = useState('');
  const [variantName, setVariantName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setError('');
    }
  }, [open]);

  const preview = useMemo(() => {
    if (!pgn.trim()) return { gameCount: 0, detectedNames: [] };
    return parsePgnPreview(pgn);
  }, [pgn]);

  if (!open) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPgn(reader.result);
        if (!variantName) {
          setVariantName(file.name.replace(/\.(pgn|txt)$/i, ''));
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pgn.trim()) {
      setError('Incolla un testo PGN oppure carica un file .pgn.');
      return;
    }
    setError('');
    onImport({ pgn, variantName: variantName.trim() });
    setPgn('');
    setVariantName('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-[#32302a] bg-[#1e1d1a] p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
              <GitBranch className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-stone-100">
                Importa PGN nella Cartella
              </h2>
              <p className="text-xs text-emerald-400">{openingName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 transition hover:bg-[#2d2b27] hover:text-stone-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-stone-400">
              Nome Variante (opzionale)
            </label>
            <input
              type="text"
              value={variantName}
              onChange={(e) => setVariantName(e.target.value)}
              placeholder="es. Variante Najdorf (se vuoto usa [Variant] / [Event] del PGN)"
              className="w-full rounded-xl border border-[#32302a] bg-[#161512] px-3 py-2 text-sm text-stone-100 placeholder-stone-500 focus:border-sky-400 focus:outline-none"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium uppercase tracking-wider text-stone-400">
                Testo PGN (multi-linea, sottovarianti e commenti {'{ ... }'})
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#32302a] bg-[#242320] px-2.5 py-1 text-xs font-medium text-stone-300 transition hover:border-sky-400/50 hover:text-sky-300">
                <Upload className="h-3.5 w-3.5" />
                Carica .pgn
                <input type="file" accept=".pgn,.txt" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
            <textarea
              rows={7}
              value={pgn}
              onChange={(e) => setPgn(e.target.value)}
              placeholder={'[Variant "Variante Alapin"]\n1. e4 c5 2. c3 {Prepara d4} Nf6 (2... d5 3. exd5 Qxd5) 3. e5 Nd5 *'}
              className="w-full rounded-xl border border-[#32302a] bg-[#161512] p-3 font-mono text-xs text-stone-200 placeholder-stone-500 focus:border-sky-400 focus:outline-none"
            />
          </div>

          {preview.gameCount > 0 && (
            <div className="rounded-xl border border-sky-500/25 bg-sky-500/10 px-3 py-2 text-xs text-sky-200">
              <span className="font-semibold">
                {preview.gameCount} {preview.gameCount === 1 ? 'linea rilevata' : 'linee rilevate'}:
              </span>{' '}
              <span className="text-sky-300/90">
                {preview.detectedNames.join(' · ')}
                {preview.gameCount > preview.detectedNames.length ? ' ...' : ''}
              </span>
            </div>
          )}

          {error && <p className="text-xs text-rose-400">{error}</p>}

          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#32302a] px-4 py-2 text-sm font-medium text-stone-300 transition hover:bg-[#2d2b27]"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-sky-400"
            >
              Importa nella Cartella
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
