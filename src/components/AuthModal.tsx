import React, { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, KeyRound, LogIn, Mail, UserPlus, X } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onAuthenticated: () => void;
}

type AuthTab = 'login' | 'register';

export const AuthModal: React.FC<AuthModalProps> = ({ open, onClose, onAuthenticated }) => {
  const [tab, setTab] = useState<AuthTab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setError('');
      setInfo('');
      setEmail('');
      setPassword('');
      setTab('login');
      setTimeout(() => emailRef.current?.focus(), 80);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    try {
      if (tab === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        onAuthenticated();
        onClose();
      } else {
        const { error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
        setInfo(
          'Registrazione riuscita! Controlla la tua email per confermare l\'account, poi accedi.'
        );
        setTab('login');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Errore sconosciuto';
      setError(translateAuthError(msg));
    } finally {
      setLoading(false);
    }
  };

  const translateAuthError = (msg: string): string => {
    if (msg.includes('Invalid login credentials')) return 'Email o password non corretti.';
    if (msg.includes('Email not confirmed')) return 'Conferma prima la tua email.';
    if (msg.includes('User already registered')) return 'Email già registrata. Accedi direttamente.';
    if (msg.includes('Password should be at least')) return 'La password deve essere di almeno 6 caratteri.';
    if (msg.includes('Unable to validate email')) return 'Indirizzo email non valido.';
    return msg;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-[#32302a] bg-[#1e1d1a] p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-100">ChessRep Studio</h2>
              <p className="text-xs text-stone-400">Accedi per sincronizzare il repertorio</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 transition hover:bg-[#2d2b27] hover:text-stone-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-[#161512] p-1">
          <button
            type="button"
            onClick={() => { setTab('login'); setError(''); setInfo(''); }}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
              tab === 'login'
                ? 'bg-[#2a2824] text-emerald-300 ring-1 ring-emerald-500/40'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <LogIn className="h-3.5 w-3.5" />
            Accedi
          </button>
          <button
            type="button"
            onClick={() => { setTab('register'); setError(''); setInfo(''); }}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
              tab === 'register'
                ? 'bg-[#2a2824] text-sky-300 ring-1 ring-sky-400/40'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <UserPlus className="h-3.5 w-3.5" />
            Registrati
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-stone-400">
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
              <input
                ref={emailRef}
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tua@email.com"
                className="w-full rounded-xl border border-[#32302a] bg-[#161512] py-2.5 pl-9 pr-3 text-sm text-stone-100 placeholder-stone-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-stone-400">
              Password {tab === 'register' && <span className="text-stone-500">(min. 6 caratteri)</span>}
            </label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
              <input
                type={showPw ? 'text' : 'password'}
                required
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-[#32302a] bg-[#161512] py-2.5 pl-9 pr-10 text-sm text-stone-100 placeholder-stone-500 focus:border-emerald-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300"
                tabIndex={-1}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Messaggi errore / info */}
          {error && (
            <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-400">
              {error}
            </p>
          )}
          {info && (
            <p className="rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-400">
              {info}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full rounded-xl py-2.5 text-sm font-bold transition ${
              tab === 'login'
                ? 'bg-emerald-500 text-stone-950 hover:bg-emerald-400'
                : 'bg-sky-500 text-stone-950 hover:bg-sky-400'
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {loading
              ? tab === 'login' ? 'Accesso in corso...' : 'Registrazione...'
              : tab === 'login' ? 'Accedi' : 'Crea Account'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-stone-500">
          I tuoi dati sono salvati solo nel tuo profilo Supabase.
        </p>
      </div>
    </div>
  );
};
