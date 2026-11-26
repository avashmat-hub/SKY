import * as THREE from 'three';

/**
 * Procedural Web Audio nocturnal soundscape attached to Three.js AudioListener.
 * Begins muted, smoothly fades in/out on toggle, and engages a warm low-pass
 * filter during hover transitions (matching the original engine behavior).
 */
export class AmbientAudioStore {
  private listener: THREE.AudioListener | null = null;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private lowpassFilter: BiquadFilterNode | null = null;
  private oscillators: OscillatorNode[] = [];
  private lfos: OscillatorNode[] = [];
  private noiseSource: AudioBufferSourceNode | null = null;
  private chimeTimer: number | null = null;

  public isInitialized = false;
  public isMuted = true;
  private isMuffled = false;

  public initAudio(listener?: THREE.AudioListener): void {
    if (this.isInitialized) return;
    this.listener = listener ?? new THREE.AudioListener();
    this.ctx = this.listener.context;
    this.isInitialized = true;
  }

  private ensureGraphBuilt(): void {
    if (!this.ctx || this.masterGain) return;
    const ctx = this.ctx;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = this.isMuffled ? 340 : 3200;
    lowpass.Q.value = 0.85;

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.0001;

    lowpass.connect(masterGain);
    masterGain.connect(this.listener ? this.listener.getInput() : ctx.destination);

    this.lowpassFilter = lowpass;
    this.masterGain = masterGain;

    // Nocturnal D-Lydian harmonic pad voices (D2, A2, F#3, A3, E4, C#4)
    const voices = [
      { freq: 73.42, gain: 0.14, type: 'sine' as OscillatorType, detune: -3 },
      { freq: 110.0, gain: 0.11, type: 'triangle' as OscillatorType, detune: 4 },
      { freq: 185.0, gain: 0.06, type: 'sine' as OscillatorType, detune: -5 },
      { freq: 220.0, gain: 0.055, type: 'sine' as OscillatorType, detune: 6 },
      { freq: 329.63, gain: 0.035, type: 'sine' as OscillatorType, detune: -4 },
      { freq: 277.18, gain: 0.025, type: 'sine' as OscillatorType, detune: 3 },
    ];

    voices.forEach((v, idx) => {
      const osc = ctx.createOscillator();
      osc.type = v.type;
      osc.frequency.value = v.freq;
      osc.detune.value = v.detune;

      const voiceGain = ctx.createGain();
      voiceGain.gain.value = v.gain;

      // Gentle slow breathing LFO on each harmonic voice
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.07 + idx * 0.023;

      const lfoDepth = ctx.createGain();
      lfoDepth.gain.value = v.gain * 0.35;

      lfo.connect(lfoDepth);
      lfoDepth.connect(voiceGain.gain);

      osc.connect(voiceGain);
      voiceGain.connect(lowpass);

      osc.start();
      lfo.start();
      this.oscillators.push(osc);
      this.lfos.push(lfo);
    });

    // Soft filtered nocturnal breeze (pink-ish noise bed)
    const bufferLength = ctx.sampleRate * 4;
    const noiseBuffer = ctx.createBuffer(1, bufferLength, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < bufferLength; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.95 * b2 + white * 0.048;
      data[i] = (b0 + b1 + b2) * 0.45;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 420;
    windFilter.Q.value = 1.1;

    const windLfo = ctx.createOscillator();
    windLfo.frequency.value = 0.09;
    const windLfoGain = ctx.createGain();
    windLfoGain.gain.value = 180;
    windLfo.connect(windLfoGain);
    windLfoGain.connect(windFilter.frequency);
    windLfo.start();
    this.lfos.push(windLfo);

    const windGain = ctx.createGain();
    windGain.gain.value = 0.07;

    noise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(lowpass);
    noise.start();
    this.noiseSource = noise;

    // Occasional shimmering nocturnal dew-chime overtones
    const chimeNotes = [587.33, 659.25, 739.99, 880.0, 1108.73, 1318.51];
    const scheduleChime = () => {
      if (!this.ctx || !this.lowpassFilter) return;
      if (!this.isMuted && this.ctx.state === 'running') {
        const now = this.ctx.currentTime;
        const note = chimeNotes[Math.floor(Math.random() * chimeNotes.length)];
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(note, now);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.026, now + 0.14);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 3.4);
        osc.connect(g);
        g.connect(this.lowpassFilter);
        osc.start(now);
        osc.stop(now + 3.6);
      }
      this.chimeTimer = window.setTimeout(scheduleChime, 2600 + Math.random() * 3800);
    };
    this.chimeTimer = window.setTimeout(scheduleChime, 1600);
  }

  public toggleMute(): boolean {
    if (!this.isInitialized || !this.ctx) return true;
    this.ensureGraphBuilt();

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    this.isMuted = !this.isMuted;

    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(Math.max(0.0001, this.masterGain.gain.value), now);
      if (this.isMuted) {
        this.masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);
      } else {
        this.masterGain.gain.exponentialRampToValueAtTime(0.36, now + 1.0);
      }
    }

    return this.isMuted;
  }

  public setMuffled(muffled: boolean): void {
    this.isMuffled = muffled;
    if (!this.lowpassFilter || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.lowpassFilter.frequency.cancelScheduledValues(now);
    this.lowpassFilter.frequency.setValueAtTime(Math.max(120, this.lowpassFilter.frequency.value), now);
    this.lowpassFilter.frequency.exponentialRampToValueAtTime(
      muffled ? 320 : 3200,
      now + 0.85
    );
  }

  public dispose(): void {
    if (this.chimeTimer !== null) {
      window.clearTimeout(this.chimeTimer);
      this.chimeTimer = null;
    }
    this.oscillators.forEach((o) => {
      try {
        o.stop();
      } catch {
        // Ignore already stopped oscillators
      }
    });
    this.lfos.forEach((l) => {
      try {
        l.stop();
      } catch {
        // Ignore already stopped LFOs
      }
    });
    if (this.noiseSource) {
      try {
        this.noiseSource.stop();
      } catch {
        // Ignore already stopped noise
      }
    }
    this.oscillators = [];
    this.lfos = [];
    this.noiseSource = null;
    this.masterGain = null;
    this.lowpassFilter = null;
    this.isInitialized = false;
  }
}
