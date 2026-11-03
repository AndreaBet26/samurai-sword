/**
 * SUONI DEL GIOCO
 *
 * Tutti i suoni sono generati in tempo reale con la Web Audio API (nessun file necessario),
 * con un piccolo riverbero "da sala in legno" condiviso, così suonano come un unico ambiente.
 *
 * Vuoi usare suoni tuoi? Metti i file in client/public/assets/sounds/ e scrivi in
 * client/public/assets/sounds/sounds.json quale file usare per ogni effetto, es.:
 *   { "parry": "parry.mp3", "swordHit": "colpo.ogg" }
 * Gli effetti con un file usano il file, gli altri restano sintetizzati.
 */

export type SoundName =
  | 'cardHover' // passaggio sopra una carta
  | 'cardDraw' // pescata / carta che vola in mano
  | 'cardPlace' // carta appoggiata sul tavolo
  | 'shuffle' // mazzo rimescolato
  | 'uiClick' // pulsanti
  | 'swordDraw' // estrarre la spada (si gioca un'arma)
  | 'swordHit' // colpo andato a segno
  | 'parry' // parata: lame che si scontrano
  | 'damage' // ferita (tamburo)
  | 'defeat' // abbattuto: tamburo profondo + gong
  | 'gong' // gong
  | 'honorGain' // gettone Onore guadagnato
  | 'honorLoss' // gettone Onore perso
  | 'heal' // cura
  | 'tokenDrop' // gettone appoggiato
  | 'yourTurn' // è il tuo turno (hyoshigi: legni battuti)
  | 'battleCry' // Grido di Battaglia
  | 'victory'; // fine partita

const STORAGE_KEY = 'samurai-sword-audio';

class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private reverbSend: GainNode | null = null;
  private files: Partial<Record<SoundName, AudioBuffer>> = {};
  private filesRequested = false;
  private lastPlayed: Partial<Record<SoundName, number>> = {};
  public isMuted = false;
  public volume = 0.8;

  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if (typeof saved.volume === 'number') this.volume = Math.min(1, Math.max(0, saved.volume));
      if (typeof saved.muted === 'boolean') this.isMuted = saved.muted;
    } catch {
      /* impostazioni non disponibili: valori predefiniti */
    }
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ volume: this.volume, muted: this.isMuted }));
    } catch {
      /* ignora */
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    this.save();
    return this.isMuted;
  }

  public setVolume(v: number) {
    this.volume = Math.min(1, Math.max(0, v));
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.volume * 0.9, this.ctx.currentTime, 0.02);
    this.save();
  }

  // ---------------------------------------------------------------------------------------
  // Motore audio
  // ---------------------------------------------------------------------------------------

  private init(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      const ctx = new Ctx();
      this.ctx = ctx;

      // Catena: suoni -> master -> compressore -> uscita, con una mandata di riverbero
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.ratio.value = 4;
      comp.attack.value = 0.004;
      comp.release.value = 0.2;
      comp.connect(ctx.destination);

      this.master = ctx.createGain();
      this.master.gain.value = this.volume * 0.9;
      this.master.connect(comp);

      const reverb = ctx.createConvolver();
      reverb.buffer = this.makeImpulse(ctx, 1.6, 3.2);
      const wet = ctx.createGain();
      wet.gain.value = 0.22;
      reverb.connect(wet);
      wet.connect(this.master);
      this.reverbSend = ctx.createGain();
      this.reverbSend.connect(reverb);

      this.loadFiles();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => undefined);
    return this.ctx;
  }

  /** Risposta all'impulso sintetica: coda di rumore che decade (stanza in legno) */
  private makeImpulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  private async loadFiles() {
    if (this.filesRequested || !this.ctx) return;
    this.filesRequested = true;
    try {
      const res = await fetch('/assets/sounds/sounds.json', { cache: 'no-cache' });
      if (!res.ok) return;
      const map = (await res.json()) as Record<string, string>;
      await Promise.all(
        Object.entries(map).map(async ([name, file]) => {
          try {
            const r = await fetch(`/assets/sounds/${file}`);
            if (!r.ok) return;
            const data = await r.arrayBuffer();
            this.files[name as SoundName] = await this.ctx!.decodeAudioData(data);
          } catch {
            /* file non valido: resta il suono sintetizzato */
          }
        })
      );
    } catch {
      /* nessun file personalizzato */
    }
  }

  /** Uscita di un suono: volume + quanta parte va nel riverbero */
  private out(gain = 1, reverb = 0.3): GainNode {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.value = gain;
    g.connect(this.master!);
    if (reverb > 0 && this.reverbSend) {
      const s = ctx.createGain();
      s.gain.value = reverb;
      g.connect(s);
      s.connect(this.reverbSend);
    }
    return g;
  }

  private noiseBuffer(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** Rumore filtrato con inviluppo: fruscii, colpi, fendenti */
  private noise(opts: {
    t: number;
    dur: number;
    type?: BiquadFilterType;
    f0: number;
    f1?: number;
    q?: number;
    gain: number;
    attack?: number;
    dest: AudioNode;
  }) {
    const ctx = this.ctx!;
    const { t, dur, type = 'bandpass', f0, f1 = f0, q = 1, gain, attack = 0.005, dest } = opts;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(dur + 0.05);
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  /** Oscillatore con inviluppo e glissando */
  private tone(opts: { t: number; dur: number; f0: number; f1?: number; type?: OscillatorType; gain: number; attack?: number; dest: AudioNode }) {
    const ctx = this.ctx!;
    const { t, dur, f0, f1 = f0, type = 'sine', gain, attack = 0.004, dest } = opts;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /** Suono metallico (lama, gong): parziali inarmoniche che decadono */
  private metal(t: number, base: number, dur: number, gain: number, dest: AudioNode, ratios = [1, 2.76, 5.4, 8.93, 13.34]) {
    ratios.forEach((r, i) => {
      this.tone({
        t,
        dur: dur / (1 + i * 0.45),
        f0: base * r * (1 + (Math.random() - 0.5) * 0.004),
        gain: gain / (1 + i * 0.8),
        attack: 0.002,
        dest
      });
    });
  }

  /** Corda pizzicata (koto) con l'algoritmo di Karplus-Strong */
  private pluck(t: number, freq: number, gain: number, dest: AudioNode, dur = 1.6) {
    const ctx = this.ctx!;
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * dur);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    const period = Math.max(2, Math.round(sr / freq));
    const ring = new Float32Array(period);
    for (let i = 0; i < period; i++) ring[i] = Math.random() * 2 - 1;
    let idx = 0;
    for (let i = 0; i < len; i++) {
      const next = (idx + 1) % period;
      const v = ring[idx];
      ring[idx] = 0.497 * (v + ring[next]); // la corda perde energia a poco a poco
      d[i] = v;
      idx = next;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const tonef = ctx.createBiquadFilter();
    tonef.type = 'lowpass';
    tonef.frequency.value = Math.min(9000, freq * 7);
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(tonef);
    tonef.connect(g);
    g.connect(dest);
    src.start(t);
  }

  /** Scala giapponese "in" (miyako-bushi) a partire da Re */
  private static IN_SCALE = [293.66, 311.13, 392.0, 440.0, 466.16, 587.33, 622.25, 783.99, 880.0];

  // ---------------------------------------------------------------------------------------
  // Effetti
  // ---------------------------------------------------------------------------------------

  /** Riproduce un effetto. Lo stesso suono ripetuto troppo ravvicinato viene accorpato. */
  public play(name: SoundName, opts: { volume?: number } = {}) {
    if (this.isMuted) return;
    const ctx = this.init();
    if (!ctx || !this.master) return;

    const now = performance.now();
    const minGap: Partial<Record<SoundName, number>> = { cardHover: 60, cardDraw: 45, tokenDrop: 40, uiClick: 40 };
    if ((minGap[name] ?? 25) > now - (this.lastPlayed[name] ?? 0)) return;
    this.lastPlayed[name] = now;

    const vol = opts.volume ?? 1;
    const file = this.files[name];
    if (file) {
      const src = ctx.createBufferSource();
      src.buffer = file;
      src.connect(this.out(vol, 0.15));
      src.start();
      return;
    }

    const t = ctx.currentTime + 0.005;
    const r = (a: number, b: number) => a + Math.random() * (b - a);
    const S = SoundManager.IN_SCALE;

    try {
      switch (name) {
        case 'cardHover':
          this.noise({ t, dur: 0.05, type: 'highpass', f0: 4000, gain: 0.05 * vol, dest: this.out(1, 0.05) });
          break;

        case 'cardDraw': {
          // Fruscio di carta che scivola
          const o = this.out(vol, 0.12);
          this.noise({ t, dur: r(0.16, 0.2), f0: r(1500, 1900), f1: r(4200, 5200), q: 0.8, gain: 0.32, attack: 0.02, dest: o });
          break;
        }
        case 'cardPlace': {
          // Carta appoggiata sul panno
          const o = this.out(vol, 0.18);
          this.noise({ t, dur: 0.09, f0: 2600, f1: 1400, q: 0.9, gain: 0.28, attack: 0.008, dest: o });
          this.tone({ t, dur: 0.09, f0: 180, f1: 90, gain: 0.35, dest: o });
          break;
        }
        case 'shuffle': {
          // Riffle: tanti scatti di carta, poi il mazzo che si compatta
          const o = this.out(vol, 0.12);
          for (let i = 0; i < 22; i++) {
            this.noise({ t: t + i * r(0.018, 0.03), dur: 0.035, f0: r(2500, 4500), q: 1.5, gain: r(0.12, 0.22), dest: o });
          }
          this.noise({ t: t + 0.62, dur: 0.12, type: 'lowpass', f0: 1200, f1: 400, gain: 0.35, dest: o });
          this.tone({ t: t + 0.62, dur: 0.1, f0: 140, f1: 70, gain: 0.3, dest: o });
          break;
        }
        case 'uiClick': {
          const o = this.out(0.7 * vol, 0.1);
          this.noise({ t, dur: 0.05, f0: 1800, q: 6, gain: 0.35, attack: 0.001, dest: o });
          break;
        }
        case 'tokenDrop': {
          // Gettone di legno laccato appoggiato
          const o = this.out(vol, 0.15);
          this.noise({ t, dur: 0.06, f0: r(1100, 1500), q: 8, gain: 0.4, attack: 0.001, dest: o });
          this.tone({ t, dur: 0.07, f0: r(600, 760), f1: 420, gain: 0.12, dest: o });
          break;
        }
        case 'swordDraw': {
          // Lama estratta dal fodero
          const o = this.out(0.8 * vol, 0.3);
          this.noise({ t, dur: 0.38, f0: 2200, f1: 7500, q: 6, gain: 0.25, attack: 0.05, dest: o });
          this.metal(t + 0.33, 1850, 0.9, 0.06, o, [1, 2.4, 3.9]);
          break;
        }
        case 'swordHit': {
          // Fendente: soffio veloce + impatto
          const o = this.out(vol, 0.35);
          this.noise({ t, dur: 0.16, f0: 600, f1: 3800, q: 1.2, gain: 0.45, attack: 0.03, dest: o });
          this.noise({ t: t + 0.14, dur: 0.12, type: 'lowpass', f0: 1800, f1: 300, gain: 0.5, attack: 0.002, dest: o });
          this.tone({ t: t + 0.14, dur: 0.22, f0: 120, f1: 55, gain: 0.55, dest: o });
          this.metal(t + 0.14, 1300, 0.5, 0.05, o, [1, 2.1, 3.6]);
          break;
        }
        case 'parry': {
          // Lame che si scontrano: transiente brillante + risonanza metallica
          const o = this.out(vol, 0.45);
          this.noise({ t, dur: 0.05, type: 'highpass', f0: 3500, gain: 0.45, attack: 0.001, dest: o });
          this.metal(t, r(880, 960), 1.3, 0.22, o);
          this.metal(t + 0.012, r(1240, 1320), 0.9, 0.12, o);
          break;
        }
        case 'damage': {
          // Taiko
          const o = this.out(vol, 0.35);
          this.tone({ t, dur: 0.45, f0: 110, f1: 52, gain: 0.85, attack: 0.003, dest: o });
          this.tone({ t, dur: 0.18, f0: 220, f1: 110, gain: 0.2, dest: o });
          this.noise({ t, dur: 0.07, type: 'lowpass', f0: 900, f1: 200, gain: 0.45, attack: 0.001, dest: o });
          break;
        }
        case 'defeat': {
          // Tamburo profondo + gong
          const o = this.out(vol, 0.55);
          this.tone({ t, dur: 0.9, f0: 75, f1: 38, gain: 1, attack: 0.003, dest: o });
          this.noise({ t, dur: 0.12, type: 'lowpass', f0: 700, f1: 150, gain: 0.6, attack: 0.001, dest: o });
          this.metal(t + 0.12, 98, 3.4, 0.22, o, [1, 1.47, 2.09, 2.56, 3.2, 4.08]);
          break;
        }
        case 'gong': {
          const o = this.out(vol, 0.6);
          this.noise({ t, dur: 0.08, type: 'lowpass', f0: 600, gain: 0.3, attack: 0.002, dest: o });
          this.metal(t, 82, 4.5, 0.3, o, [1, 1.47, 2.09, 2.56, 3.2, 4.08, 5.1]);
          break;
        }
        case 'honorGain': {
          // Koto ascendente
          const o = this.out(vol, 0.4);
          [S[2], S[3], S[5], S[7]].forEach((f, i) => this.pluck(t + i * 0.09, f, 0.5, o));
          break;
        }
        case 'honorLoss': {
          // Koto discendente, più cupo
          const o = this.out(vol, 0.4);
          [S[4], S[2], S[1], S[0]].forEach((f, i) => this.pluck(t + i * 0.12, f * 0.75, 0.42, o));
          break;
        }
        case 'heal': {
          // Respiro + accordo morbido
          const o = this.out(vol, 0.5);
          this.noise({ t, dur: 0.7, f0: 500, f1: 1400, q: 0.7, gain: 0.12, attack: 0.25, dest: o });
          [S[0], S[2], S[3]].forEach((f, i) => this.pluck(t + 0.15 + i * 0.05, f, 0.32, o, 2));
          break;
        }
        case 'yourTurn': {
          // Hyoshigi: due legni battuti, poi una nota di koto
          const o = this.out(vol, 0.35);
          [0, 0.16].forEach(dt => {
            this.noise({ t: t + dt, dur: 0.07, f0: 2100, q: 10, gain: 0.55, attack: 0.001, dest: o });
            this.tone({ t: t + dt, dur: 0.08, f0: 1050, gain: 0.12, dest: o });
          });
          this.pluck(t + 0.34, S[5], 0.4, o);
          break;
        }
        case 'battleCry': {
          // Tamburi in crescendo
          const o = this.out(vol, 0.4);
          [0, 0.14, 0.28].forEach((dt, i) => {
            this.tone({ t: t + dt, dur: 0.35, f0: 100 - i * 8, f1: 50, gain: 0.5 + i * 0.2, dest: o });
            this.noise({ t: t + dt, dur: 0.06, type: 'lowpass', f0: 800, f1: 200, gain: 0.3 + i * 0.1, attack: 0.001, dest: o });
          });
          break;
        }
        case 'victory': {
          const o = this.out(vol, 0.5);
          this.metal(t, 82, 4, 0.22, o, [1, 1.47, 2.09, 2.56, 3.2, 4.08]);
          [S[0], S[2], S[3], S[5], S[7], S[8]].forEach((f, i) => this.pluck(t + 0.3 + i * 0.12, f, 0.45, o, 2.2));
          break;
        }
      }
    } catch {
      /* l'audio non deve mai bloccare il gioco */
    }
  }

  // --- Nomi storici, mantenuti per compatibilità ---
  public playTaiko() { this.play('damage'); }
  public playGong() { this.play('gong'); }
  public playSwordSlash() { this.play('swordHit'); }
  public playParryClash() { this.play('parry'); }
  public playCardSlide() { this.play('cardDraw'); }
  public playRiffleShuffle() { this.play('shuffle'); }
  public playCardSlam() { this.play('cardPlace'); }
  public playHonorChime() { this.play('honorGain'); }
}

export const soundManager = new SoundManager();
