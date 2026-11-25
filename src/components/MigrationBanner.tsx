import React from 'react';
import { CloudUpload, Upload, X } from 'lucide-react';

interface MigrationBannerProps {
  localCount: number;
  migrating: boolean;
  onMigrate: () => void;
  onDismiss: () => void;
}

export const MigrationBanner: React.FC<MigrationBannerProps> = ({
  localCount,
  migrating,
  onMigrate,
  onDismiss,
}) => (
  <div className="relative flex flex-wrap items-center gap-3 rounded-2xl border border-amber-500/35 bg-amber-500/8 px-4 py-3 text-xs">
    <Upload className="h-4 w-4 shrink-0 text-amber-400" />
    <div className="flex-1">
      <span className="font-semibold text-amber-300">
        Trovato un repertorio locale ({localCount}{' '}
        {localCount === 1 ? 'apertura' : 'aperture'})
      </span>
      <span className="ml-2 text-stone-400">
        — Non è ancora sincronizzato con il tuo account cloud.
      </span>
    </div>
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onMigrate}
        disabled={migrating}
        className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-bold text-stone-950 transition hover:bg-amber-400 disabled:opacity-50"
      >
        <CloudUpload className="h-3.5 w-3.5" />
        {migrating ? 'Importazione...' : 'Importa repertorio nel cloud'}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        title="Ignora"
        className="rounded-lg p-1 text-stone-400 hover:bg-[#2d2b27] hover:text-stone-200"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  </div>
);
