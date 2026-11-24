// Sintetizzatore audio leggero tramite Web Audio API (nessuna dipendenza esterna)

class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  private getContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  private playTone(
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    delay = 0
  ) {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 20), now + duration);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  public playMove() {
    this.playTone(190, 95, 0.065, 'triangle', 0.16);
  }

  public playCapture() {
    this.playTone(310, 110, 0.085, 'sawtooth', 0.14);
    this.playTone(150, 70, 0.07, 'triangle', 0.14, 0.01);
  }

  public playCheck() {
    this.playTone(540, 440, 0.12, 'sine', 0.14);
  }

  public playCorrect() {
    this.playTone(523.25, 659.25, 0.11, 'sine', 0.12);
  }

  public playSuccess() {
    this.playTone(523.25, 523.25, 0.12, 'sine', 0.12, 0);
    this.playTone(659.25, 659.25, 0.12, 'sine', 0.12, 0.08);
    this.playTone(783.99, 783.99, 0.22, 'sine', 0.14, 0.16);
  }

  public playError() {
    this.playTone(185, 115, 0.16, 'sawtooth', 0.12);
    this.playTone(145, 95, 0.16, 'triangle', 0.1, 0.04);
  }
}

export const soundEngine = new SoundEngine();
