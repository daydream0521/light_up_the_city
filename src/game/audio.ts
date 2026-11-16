export class CityAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private enabled = false;

  async setEnabled(enabled: boolean): Promise<void> {
    this.enabled = enabled;
    if (enabled) {
      this.ensureGraph();
      await this.context!.resume();
    }
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(enabled ? 0.32 : 0, this.context.currentTime, 0.08);
    }
  }

  rotate(): void {
    this.tone(330, 0.055, 'sine', 0.07);
    this.tone(510, 0.08, 'sine', 0.04, 0.035);
  }

  success(final = false): void {
    const notes = final ? [261.6, 329.6, 392, 523.3, 659.3] : [392, 493.9, 587.3, 784];
    notes.forEach((note, index) => this.tone(note, 0.55, 'sine', 0.12, index * 0.11));
  }

  private ensureGraph(): void {
    if (this.context) return;
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.context.destination);

    const length = this.context.sampleRate * 3;
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const channel = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = last * 0.94 + white * 0.06;
      channel[i] = last * 1.8;
    }
    const rain = this.context.createBufferSource();
    rain.buffer = buffer;
    rain.loop = true;
    const filter = this.context.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 900;
    const rainGain = this.context.createGain();
    rainGain.gain.value = 0.14;
    rain.connect(filter).connect(rainGain).connect(this.master);
    rain.start();
  }

  private tone(frequency: number, duration: number, type: OscillatorType, volume: number, delay = 0): void {
    if (!this.enabled || !this.context || !this.master) return;
    const start = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }
}
