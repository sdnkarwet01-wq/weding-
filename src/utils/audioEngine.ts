// Hybrid audio engine supporting both real external/uploaded audio files (<audio>)
// and built-in polyphonic ambient piano/harp synthesis (Web Audio API) so curated
// wedding melodies always play smoothly without external CDN failures.

const CHORD_PROGRESSIONS: Record<string, number[][]> = {
  'builtin:clair-de-lune': [
    [261.63, 329.63, 392.0, 493.88], // Cmaj7
    [220.0, 261.63, 329.63, 392.0],  // Am7
    [174.61, 220.0, 261.63, 349.23], // Fmaj7
    [196.0, 246.94, 293.66, 392.0],  // G6
  ],
  'builtin:tuscany': [
    [293.66, 369.99, 440.0, 554.37], // Dmaj7
    [246.94, 293.66, 369.99, 440.0], // Bm7
    [196.0, 246.94, 293.66, 392.0],  // Gmaj7
    [220.0, 277.18, 329.63, 440.0],  // A
  ],
  'builtin:vows': [
    [233.08, 293.66, 349.23, 440.0], // Bbmaj7
    [196.0, 233.08, 293.66, 349.23], // Gm7
    [155.56, 196.0, 233.08, 311.13], // Ebmaj7
    [174.61, 220.0, 261.63, 349.23], // F
  ],
  'builtin:golden': [
    [261.63, 311.13, 392.0, 466.16], // Cm7
    [207.65, 261.63, 311.13, 392.0], // Abmaj7
    [155.56, 196.0, 233.08, 293.66], // Ebmaj7
    [233.08, 293.66, 349.23, 466.16], // Bb6
  ],
};

export class WeddingAudioController {
  private audioEl: HTMLAudioElement | null = null;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private intervalId: number | null = null;
  private step = 0;
  private currentUrl = '';
  private volume = 0.65;
  private playing = false;
  private onStateChange?: (playing: boolean, error: string | null) => void;

  constructor(onStateChange?: (playing: boolean, error: string | null) => void) {
    this.onStateChange = onStateChange;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.audioEl) {
      this.audioEl.volume = this.volume;
    }
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume * 0.25, this.ctx.currentTime, 0.08);
    }
  }

  public async play(url: string, vol?: number): Promise<boolean> {
    if (typeof vol === 'number') {
      this.volume = Math.max(0, Math.min(1, vol));
    }

    if (this.currentUrl !== url) {
      this.stop();
      this.currentUrl = url;
    }

    if (!url) {
      this.onStateChange?.(false, 'No audio track selected.');
      return false;
    }

    if (url.startsWith('builtin:')) {
      return this.startBuiltinSynth(url);
    }

    try {
      if (!this.audioEl) {
        this.audioEl = new Audio(url);
        this.audioEl.loop = true;
        this.audioEl.crossOrigin = 'anonymous';
        this.audioEl.addEventListener('error', () => {
          this.playing = false;
          this.onStateChange?.(false, 'Unable to stream audio URL. Switching controls remain safe.');
        });
      } else if (this.audioEl.src !== url) {
        this.audioEl.src = url;
      }
      this.audioEl.volume = this.volume;
      await this.audioEl.play();
      this.playing = true;
      this.onStateChange?.(true, null);
      return true;
    } catch (err) {
      this.playing = false;
      const msg = err instanceof Error ? err.message : 'Audio playback blocked or unavailable.';
      this.onStateChange?.(false, msg);
      return false;
    }
  }

  private startBuiltinSynth(trackKey: string): boolean {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) {
        this.onStateChange?.(false, 'Web Audio not supported in this browser.');
        return false;
      }

      if (!this.ctx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.volume * 0.25;
        this.masterGain.connect(this.ctx.destination);
      }

      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }

      if (this.intervalId !== null) {
        window.clearInterval(this.intervalId);
      }

      const progression = CHORD_PROGRESSIONS[trackKey] || CHORD_PROGRESSIONS['builtin:clair-de-lune'];

      const triggerArpeggio = () => {
        if (!this.ctx || !this.masterGain || !this.playing) return;
        const chord = progression[this.step % progression.length];
        this.step += 1;

        chord.forEach((freq, idx) => {
          if (!this.ctx || !this.masterGain) return;
          const now = this.ctx.currentTime + idx * 0.28;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          const filter = this.ctx.createBiquadFilter();

          osc.type = idx === 0 ? 'triangle' : 'sine';
          osc.frequency.setValueAtTime(freq, now);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(1400, now);

          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.exponentialRampToValueAtTime(0.28 / (idx + 1), now + 0.08);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.1);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(this.masterGain);

          osc.start(now);
          osc.stop(now + 3.2);
        });
      };

      this.playing = true;
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.setTargetAtTime(this.volume * 0.25, this.ctx.currentTime, 0.1);
      }
      triggerArpeggio();
      this.intervalId = window.setInterval(triggerArpeggio, 3200);
      this.onStateChange?.(true, null);
      return true;
    } catch {
      this.playing = false;
      this.onStateChange?.(false, 'Audio playback could not start.');
      return false;
    }
  }

  public pause() {
    this.playing = false;
    if (this.audioEl) {
      this.audioEl.pause();
    }
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.onStateChange?.(false, null);
  }

  public stop() {
    this.pause();
    if (this.audioEl) {
      this.audioEl.src = '';
      this.audioEl = null;
    }
    this.currentUrl = '';
  }

  public destroy() {
    this.stop();
    if (this.ctx) {
      void this.ctx.close().catch(() => {});
      this.ctx = null;
      this.masterGain = null;
    }
  }
}
