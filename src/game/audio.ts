import type { CityIndex } from './journey';

type SoundPhase = 'home' | 'puzzle' | 'view' | 'show';
type Mix = { music: number; ambience: number; effects: number };
const MIX_KEY = 'light-up-the-city-audio';
const DEFAULT_MIX: Mix = { music: .7, ambience: .65, effects: .7 };
const MIX_KEYS = ['music', 'ambience', 'effects'] as const;
const ROOT = [50, 57, 53] as const;
const MOTIF = [0, 5, 7, 12, 9, 7] as const;
const STEPS = [0, .72, 1.49, 2.65, 3.81, 4.63] as const;
const note = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

export class CityAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private buses?: Record<keyof Mix, GainNode>;
  private channels: { music: GainNode; ambience: GainNode }[] = [];
  private enabled = false;
  private city: CityIndex = 0;
  private phase: SoundPhase = 'home';
  private nextPhrase = 0;
  private phrase = 0;
  private readonly score = new Set<OscillatorNode>();
  readonly mix = { ...DEFAULT_MIX };

  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(MIX_KEY) ?? 'null') as Partial<Mix> | null;
      for (const key of MIX_KEYS) {
        const value = saved?.[key];
        if (typeof value === 'number' && Number.isFinite(value)) this.mix[key] = Math.max(0, Math.min(1, value));
      }
    } catch { /* Audio settings remain available for this session. */ }
    document.addEventListener('visibilitychange', () => this.updateMix());
  }

  setScene(city: CityIndex, phase: SoundPhase): void {
    if (this.city === city && this.phase === phase) return;
    const changedCity = city !== this.city;
    this.city = city;
    this.phase = phase;
    this.updateMix();
    if (changedCity) this.phrase = 0;
    if ((changedCity || phase === 'show') && this.context) {
      const now = this.context.currentTime;
      for (const oscillator of this.score) oscillator.stop(now + .68);
      this.score.clear();
      this.nextPhrase = now + .53;
    }
  }

  setVolume(channel: keyof Mix, volume: number): void {
    this.mix[channel] = volume;
    this.updateMix();
    try { localStorage.setItem(MIX_KEY, JSON.stringify(this.mix)); } catch { /* Apply in memory. */ }
  }

  async setEnabled(enabled: boolean): Promise<void> {
    this.enabled = enabled;
    if (enabled) {
      this.ensureGraph();
      await this.context!.resume();
    }
    this.updateMix();
  }

  rotate(): void {
    if (!this.enabled || !this.context) return;
    const start = this.context.currentTime;
    this.tone(this.buses!.effects, [330, 294, 392][this.city], start, .09, .085, this.city === 1 ? 'triangle' : 'sine', .008);
    this.tone(this.buses!.effects, [510, 440, 587][this.city], start + .027, .12, .042, 'sine', .014);
  }

  success(final = false): void {
    if (!this.enabled || !this.context) return;
    const start = this.context.currentTime;
    const notes = final ? [0, 5, 7, 12, 17] : [0, 5, 7, 12];
    notes.forEach((semitone, index) => this.tone(
      this.buses!.effects, note(ROOT[this.city] + 12 + semitone), start + index * .13,
      final ? 1.2 : .55, final ? .10 : .077, 'sine', .024,
    ));
  }

  private ensureGraph(): void {
    if (this.context) return;
    const context = this.context = new AudioContext();
    const master = this.master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);
    this.buses = { music: context.createGain(), ambience: context.createGain(), effects: context.createGain() };
    for (const key of MIX_KEYS) this.buses[key].connect(master);

    for (const city of [0, 1, 2] as const) {
      const music = context.createGain();
      const ambience = context.createGain();
      music.gain.value = ambience.gain.value = 0;
      music.connect(this.buses.music);
      ambience.connect(this.buses.ambience);
      const bed = context.createBufferSource();
      bed.buffer = this.ambientBuffer(context, city);
      bed.loop = true;
      bed.connect(ambience);
      bed.start();
      this.channels.push({ music, ambience });
    }
    this.nextPhrase = context.currentTime + .33;
    window.setInterval(() => this.schedulePhrase(), 160);
  }

  private updateMix(): void {
    if (!this.master || !this.context || !this.buses) return;
    const now = this.context.currentTime;
    const audible = this.enabled && !document.hidden;
    this.master.gain.setTargetAtTime(audible ? .76 : 0, now, .055);
    for (const key of MIX_KEYS) this.buses[key].gain.setTargetAtTime(this.mix[key], now, .06);
    const levels = { home: [.73, .66], puzzle: [.36, .72], view: [.57, .84], show: [1, .58] };
    const [musicLevel, ambienceLevel] = levels[this.phase];
    this.channels.forEach(({ music, ambience }, index) => {
      const selected = index === this.city;
      music.gain.setTargetAtTime(selected ? musicLevel : 0, now, .31);
      ambience.gain.setTargetAtTime(selected ? ambienceLevel : 0, now, .31);
    });
  }

  private ambientBuffer(context: AudioContext, city: CityIndex): AudioBuffer {
    const length = Math.round(context.sampleRate * 12);
    const blend = Math.round(context.sampleRate * .18);
    const buffer = context.createBuffer(2, length, context.sampleRate);
    for (const channel of [0, 1]) {
      const samples = new Float32Array(length + blend);
      let fast = 0;
      let slow = 0;
      let air = 0;
      let ember = 0;
      for (let i = 0; i < samples.length; i += 1) {
        const t = i / context.sampleRate;
        const white = Math.random() * 2 - 1;
        fast += (white - fast) * .15;
        slow += (white - slow) * .016;
        air += (white - air) * .0018;
        if (city === 0) {
          const rain = white - fast;
          ember = Math.random() < .001 ? white * .19 : ember * .91;
          samples[i] = (rain * .075 + fast * .104 + ember * .45) * (.83 + .14 * Math.sin(t * Math.PI / 6));
        } else if (city === 1) {
          const tide = .19 + .81 * (.5 + .5 * Math.sin(t * Math.PI / 3 + channel * .21)) ** 1.7;
          ember = Math.random() < .00028 ? white * .20 : ember * .89;
          samples[i] = (fast * .29 + slow * .48 + (white - fast) * .016) * tide + air * .28 + ember * .32;
        } else {
          const ripples = .55 + .26 * Math.sin(t * Math.PI / 3 + channel * .4) + .18 * Math.sin(t * 2 * Math.PI / 3 + 1.2);
          samples[i] = (fast * .135 + slow * .38) * ripples + air * .42;
        }
      }
      const output = buffer.getChannelData(channel);
      output.set(samples.subarray(0, length));
      for (let i = 0; i < blend; i += 1) {
        const weight = .5 - .5 * Math.cos(Math.PI * i / blend);
        output[i] = samples[length + i] * (1 - weight) + samples[i] * weight;
      }
    }
    return buffer;
  }

  private schedulePhrase(): void {
    const now = this.context!.currentTime;
    if (!this.enabled || document.hidden || now + .20 < this.nextPhrase) return;
    const start = Math.max(now + .025, this.nextPhrase);
    const city = this.city;
    const phase = this.phase;
    const music = this.channels[city].music;
    const ambience = this.channels[city].ambience;
    const puzzle = phase === 'puzzle';
    const show = phase === 'show';
    const root = ROOT[city] + (this.phrase % 4 === 2 ? 5 : 0);
    const stretch = puzzle ? 1.34 : show ? .94 : 1.12;
    const timbre = city === 1 ? 'triangle' : 'sine';
    MOTIF.forEach((interval, index) => {
      const t = start + STEPS[index] * stretch;
      const frequency = note(root + 12 + interval);
      const duration = city === 0 ? 1.85 : city === 1 ? 1.14 : 2.3;
      const level = (index === 0 || index === 3 ? .105 : .071);
      this.tone(music, frequency, t, duration, level, timbre, city === 2 ? .16 : .022);
      if (city !== 1) this.tone(music, frequency * 2.002, t, duration * .50, level * .21, city === 0 ? 'triangle' : 'sine', .02);
      if (!puzzle && city === 1 && index % 2 === 1) {
        this.tone(music, frequency / 2, t + .3, 1.57, level * .35, 'sine', .18);
      }
    });
    const chord = city === 0 ? [0, 7, 14] : city === 1 ? [0, 7, 19] : [0, 7, 16];
    chord.forEach((interval, index) => {
      if (puzzle && index === 2) return;
      this.tone(music, note(root + interval), start + .12 + index * .19, show ? 7.4 : 6.2,
        show ? .085 : .043, city === 2 ? 'triangle' : 'sine', show ? .7 : 1.22);
    });
    if (city === 1 && this.phrase % 3 === 0) {
      this.tone(ambience, 1530, start + 4.9, .23, .021, 'sine', .045, 1.18);
      this.tone(ambience, 1740, start + 5.23, .29, .017, 'sine', .05, .84);
    }
    if (city === 2 && this.phrase % 3 === 0) {
      this.tone(ambience, 137, start + 3.2, 2.4, .035, 'triangle', .54, .96);
    }
    this.nextPhrase = start + (show ? 7.2 : puzzle ? 14.4 : 10.2);
    this.phrase += 1;
  }

  private tone(
    destination: GainNode, frequency: number, start: number, duration: number, volume: number,
    type: OscillatorType, attack: number, glide = 1,
  ): void {
    const context = this.context!;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (glide !== 1) oscillator.frequency.exponentialRampToValueAtTime(frequency * glide, start + duration);
    envelope.gain.setValueAtTime(.0001, start);
    envelope.gain.linearRampToValueAtTime(volume, start + attack);
    envelope.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(envelope).connect(destination);
    oscillator.start(start);
    oscillator.stop(start + duration + .01);
    if (destination === this.channels[this.city]?.music) this.score.add(oscillator);
    oscillator.onended = () => {
      this.score.delete(oscillator);
      oscillator.disconnect();
      envelope.disconnect();
    };
  }
}
