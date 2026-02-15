import CONFIG from '../config/gameConfig.js';

/**
 * SoundManager: procedural sound effects using Web Audio API oscillators.
 *
 * No audio files needed. Each sound is a short sequence of oscillator tones
 * with frequency/type/envelope control. Master gain node controls volume.
 * M key toggles mute. AudioContext.resume() handles autoplay policy.
 */
export class SoundManager {
  constructor(scene) {
    console.log('[SoundManager] initialized');
    /** @type {Phaser.Scene} */
    this.scene = scene;

    /** @type {AudioContext|null} */
    this.ctx = null;

    /** @type {GainNode|null} */
    this.masterGain = null;

    /** @type {boolean} */
    this.muted = false;

    /** @type {boolean} */
    this.initialized = false;

    /** @type {number|null} Background music loop interval ID */
    this._bgmInterval = null;

    /** @type {GainNode|null} Separate gain node for BGM (so we can control volume independently) */
    this._bgmGain = null;

    /** @type {boolean} Whether background music is playing */
    this._bgmPlaying = false;
  }

  /** Initialize Web Audio context (call after user interaction) */
  init() {
    if (!CONFIG.SOUND.ENABLED) return;

    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = CONFIG.SOUND.MASTER_VOLUME;
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
      console.log('[SoundManager] Web Audio context created');
    } catch (e) {
      console.warn('[SoundManager] Web Audio not available:', e.message);
    }
  }

  /** Resume audio context (required after first user gesture for autoplay policy).
   *  Returns a Promise that resolves when the context is running. */
  resume() {
    // Create context inside user gesture if it doesn't exist yet (iOS compatibility)
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.muted ? 0 : CONFIG.SOUND.MASTER_VOLUME;
        this.masterGain.connect(this.ctx.destination);
        this.initialized = true;
        console.log('[SoundManager] Web Audio context created inside user gesture');
      } catch (e) {
        console.warn('[SoundManager] Web Audio not available:', e.message);
        return Promise.resolve();
      }
    }
    if (this.ctx.state === 'suspended') {
      // iOS Safari requires playing an actual buffer within a user gesture to unlock audio.
      // Just calling ctx.resume() is not enough on iOS.
      try {
        const silentBuffer = this.ctx.createBuffer(1, 1, 22050);
        const source = this.ctx.createBufferSource();
        source.buffer = silentBuffer;
        source.connect(this.ctx.destination);
        source.start(0);
      } catch (e) {
        // Ignore — best-effort unlock
      }
      return this.ctx.resume();
    }
    return Promise.resolve();
  }

  /** Toggle mute on/off */
  toggleMute() {
    this.muted = !this.muted;
    if (this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : CONFIG.SOUND.MASTER_VOLUME;
    }
    if (this._bgmGain) {
      this._bgmGain.gain.value = this.muted ? 0 : CONFIG.SOUND.BGM_VOLUME;
    }
    console.debug(`[SoundManager] ${this.muted ? 'muted' : 'unmuted'}`);
  }

  /**
   * Play a tone.
   * @param {number} freq - Frequency in Hz
   * @param {string} type - Oscillator type: 'sine', 'square', 'triangle', 'sawtooth'
   * @param {number} duration - Duration in seconds
   * @param {number} [volume=1] - Relative volume (0-1)
   * @param {number} [delay=0] - Start delay in seconds
   */
  playTone(freq, type, duration, volume = 1, delay = 0) {
    if (!this.initialized || !this.ctx) return;
    this.resume();

    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(volume * 0.5, now);
    // Quick attack, natural decay
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration);
  }

  /**
   * Frequency sweep (glide from one frequency to another).
   * @param {number} startFreq
   * @param {number} endFreq
   * @param {string} type
   * @param {number} duration
   * @param {number} [volume=1]
   * @param {number} [delay=0]
   */
  playSweep(startFreq, endFreq, type, duration, volume = 1, delay = 0) {
    if (!this.initialized || !this.ctx) return;
    this.resume();

    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);

    gain.gain.setValueAtTime(volume * 0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration);
  }

  // === Sound Effects ===

  /** Ascending 2-note sine: task pickup */
  playPickup() {
    this.playTone(523, 'sine', 0.1, 0.6);       // C5
    this.playTone(659, 'sine', 0.15, 0.6, 0.08); // E5
  }

  /** Frequency sweep + chime: task delivery */
  playDelivery() {
    this.playSweep(400, 800, 'triangle', 0.15, 0.5);
    this.playTone(784, 'triangle', 0.2, 0.7, 0.12); // G5 chime
  }

  /** 3-note ascending triangle: level up */
  playLevelUp() {
    this.playTone(523, 'triangle', 0.15, 0.6);         // C5
    this.playTone(659, 'triangle', 0.15, 0.6, 0.12);   // E5
    this.playTone(784, 'triangle', 0.25, 0.7, 0.24);   // G5
  }

  /** 4-note ascending: promotion fanfare */
  playPromotion() {
    this.playTone(523, 'triangle', 0.15, 0.6);          // C5
    this.playTone(659, 'triangle', 0.15, 0.6, 0.12);    // E5
    this.playTone(784, 'triangle', 0.15, 0.6, 0.24);    // G5
    this.playTone(1047, 'triangle', 0.4, 0.8, 0.36);    // C6
  }

  /** Low 80Hz hum: stress warning (crosses threshold) */
  playStressWarning() {
    this.playTone(80, 'sine', 0.5, 0.4);
  }

  /** Short thud: agent disruption (freeze/slow) */
  playThud() {
    this.playTone(60, 'square', 0.1, 0.5);
  }

  /** Sawtooth buzz: freeze effect */
  playFreeze() {
    this.playTone(200, 'sawtooth', 0.15, 0.3);
  }

  /** Descending square buzz: decoy pickup */
  playDecoyPickup() {
    this.playSweep(400, 200, 'square', 0.2, 0.4);
  }

  /** Descending wah-wah: game over (loss) */
  playGameOver() {
    this.playSweep(523, 262, 'sawtooth', 0.6, 0.5);  // C5 -> C4
    this.playTone(200, 'sine', 0.4, 0.3, 0.5);
  }

  /** Triumphant 4-note melody: game over (victory) */
  playVictory() {
    this.playTone(523, 'triangle', 0.2, 0.6);          // C5
    this.playTone(659, 'triangle', 0.2, 0.6, 0.15);    // E5
    this.playTone(784, 'triangle', 0.2, 0.6, 0.30);    // G5
    this.playTone(1047, 'triangle', 0.5, 0.8, 0.45);   // C6
  }

  // === Background Music ===

  /**
   * Start looping procedural chiptune background music.
   * Simple 8-bar corporate-office melody using triangle + square waves.
   */
  startBGM() {
    if (!this.initialized || !this.ctx || this._bgmPlaying) return;

    this._bgmGain = this.ctx.createGain();
    this._bgmGain.gain.value = this.muted ? 0 : CONFIG.SOUND.BGM_VOLUME;
    this._bgmGain.connect(this.masterGain);

    // Melody: simple corporate-sounding 8-bar loop in C major
    // Each note is [frequency, durationInBeats] (0 = rest)
    const melody = [
      523, 659, 784, 659,  // C5 E5 G5 E5
      698, 659, 523, 0,    // F5 E5 C5 rest
      587, 659, 784, 880,  // D5 E5 G5 A5
      784, 659, 523, 0,    // G5 E5 C5 rest
    ];

    // Bass: root notes, one per beat
    const bass = [
      131, 131, 175, 175,  // C3 C3 F3 F3
      147, 147, 131, 131,  // D3 D3 C3 C3
      131, 131, 175, 175,  // C3 C3 F3 F3
      196, 196, 131, 131,  // G3 G3 C3 C3
    ];

    const bpm = CONFIG.SOUND.BGM_TEMPO;
    const beatDuration = 60 / bpm; // seconds per beat
    const loopLength = melody.length * beatDuration; // seconds per loop
    let loopStartTime = this.ctx.currentTime;

    const scheduleLoop = () => {
      if (!this._bgmPlaying || !this.ctx) return;

      const now = this.ctx.currentTime;

      // Schedule one full loop ahead
      for (let i = 0; i < melody.length; i++) {
        const noteTime = loopStartTime + i * beatDuration;

        // Skip notes that are already in the past
        if (noteTime < now - 0.1) continue;

        // Melody note (triangle wave, short staccato)
        if (melody[i] > 0) {
          this._scheduleBGMNote(melody[i], 'triangle', beatDuration * 0.6, 0.35, noteTime);
        }

        // Bass note (square wave, longer sustain)
        if (bass[i] > 0) {
          this._scheduleBGMNote(bass[i], 'square', beatDuration * 0.8, 0.2, noteTime);
        }
      }

      loopStartTime += loopLength;
    };

    this._bgmPlaying = true;
    scheduleLoop();

    // Re-schedule the next loop slightly before the current one ends
    const scheduleIntervalMs = (loopLength * 0.9) * 1000;
    this._bgmInterval = setInterval(() => {
      if (!this._bgmPlaying) {
        clearInterval(this._bgmInterval);
        this._bgmInterval = null;
        return;
      }
      scheduleLoop();
    }, scheduleIntervalMs);

    console.log('[SoundManager] BGM started');
  }

  /**
   * Schedule a single BGM note through the BGM gain node.
   * @param {number} freq
   * @param {string} type
   * @param {number} duration - seconds
   * @param {number} volume - 0-1
   * @param {number} startTime - AudioContext time
   */
  _scheduleBGMNote(freq, type, duration, volume, startTime) {
    if (!this.ctx || !this._bgmGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(volume * 0.3, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gain);
    gain.connect(this._bgmGain);

    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  /** Stop background music */
  stopBGM() {
    this._bgmPlaying = false;
    if (this._bgmInterval) {
      clearInterval(this._bgmInterval);
      this._bgmInterval = null;
    }
    if (this._bgmGain) {
      // Fade out quickly to avoid click
      try {
        this._bgmGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
      } catch (e) {
        // Context may be closed
      }
      this._bgmGain = null;
    }
    console.debug('[SoundManager] BGM stopped');
  }

  /** Clean up */
  destroy() {
    this.stopBGM();
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {});
    }
    this.ctx = null;
    this.masterGain = null;
    this._bgmGain = null;
    this.initialized = false;
  }
}
