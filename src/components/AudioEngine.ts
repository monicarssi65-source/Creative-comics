/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class AudioEngine {
  private ctx: AudioContext | null = null;
  private musicInterval: any = null;
  private isMusicPlaying = false;
  private audioEl: HTMLAudioElement | null = null;
  private currentMusicPreset: "ambient" | "cyberpunk" | "drone" | "custom" = "ambient";
  private activeOscillators: { osc: OscillatorNode; gain: GainNode }[] = [];
  private masterMusicVolume = 0.5; // default 50%

  private initCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  private initCustomAudio() {
    if (!this.audioEl && typeof window !== "undefined") {
      this.audioEl = new Audio();
      this.audioEl.loop = true;
      this.audioEl.volume = this.masterMusicVolume;
    }
  }

  // Set the general background music volume
  public setMusicVolume(volume: number) {
    this.masterMusicVolume = Math.max(0, Math.min(1, volume));
    if (this.audioEl) {
      this.audioEl.volume = this.masterMusicVolume;
    }
  }

  public getMusicVolume(): number {
    return this.masterMusicVolume;
  }

  public getIsMusicPlaying(): boolean {
    return this.isMusicPlaying;
  }

  public getCurrentPreset(): "ambient" | "cyberpunk" | "drone" | "custom" {
    return this.currentMusicPreset;
  }

  // Plays a specific synthesizer synthesized sound effect
  public playSoundEffect(preset: string) {
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;

      switch (preset) {
        case "laser": {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.connect(gain);
          gain.connect(this.ctx.destination);

          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(1200, now);
          osc.frequency.exponentialRampToValueAtTime(80, now + 0.35);

          gain.gain.setValueAtTime(0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

          osc.start(now);
          osc.stop(now + 0.35);
          break;
        }

        case "explosion": {
          // Play a beautiful synthesised brown/white noise explosion
          const bufferSize = this.ctx.sampleRate * 0.8;
          const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
          }

          const noise = this.ctx.createBufferSource();
          noise.buffer = buffer;

          const filter = this.ctx.createBiquadFilter();
          filter.type = "lowpass";
          filter.frequency.setValueAtTime(800, now);
          filter.frequency.exponentialRampToValueAtTime(50, now + 0.7);

          const gain = this.ctx.createGain();
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.7);

          noise.connect(filter);
          filter.connect(gain);
          gain.connect(this.ctx.destination);

          noise.start(now);
          noise.stop(now + 0.8);
          break;
        }

        case "magic-chime": {
          const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
          notes.forEach((freq, idx) => {
            if (!this.ctx) return;
            const timeOffset = idx * 0.08;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, now + timeOffset);
            gain.gain.setValueAtTime(0, now + timeOffset);
            gain.gain.linearRampToValueAtTime(0.1, now + timeOffset + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + timeOffset + 0.4);

            osc.start(now + timeOffset);
            osc.stop(now + timeOffset + 0.45);
          });
          break;
        }

        case "dramatic-hit": {
          const osc1 = this.ctx.createOscillator();
          const osc2 = this.ctx.createOscillator();
          const gain = this.ctx.createGain();

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(this.ctx.destination);

          osc1.type = "sawtooth";
          osc1.frequency.setValueAtTime(110, now);
          osc1.frequency.linearRampToValueAtTime(90, now + 0.5);

          osc2.type = "triangle";
          osc2.frequency.setValueAtTime(111.5, now);
          osc2.frequency.linearRampToValueAtTime(91, now + 0.5);

          gain.gain.setValueAtTime(0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + 0.6);
          osc2.stop(now + 0.6);
          break;
        }

        case "retro-jump": {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.connect(gain);
          gain.connect(this.ctx.destination);

          osc.type = "triangle";
          osc.frequency.setValueAtTime(180, now);
          osc.frequency.exponentialRampToValueAtTime(600, now + 0.15);
          osc.frequency.linearRampToValueAtTime(500, now + 0.25);

          gain.gain.setValueAtTime(0.15, now);
          gain.gain.linearRampToValueAtTime(0.1, now + 0.1);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

          osc.start(now);
          osc.stop(now + 0.25);
          break;
        }

        default:
          break;
      }
    } catch (e) {
      console.warn("Could not play synthesized sound effect", e);
    }
  }

  // Plays custom uploaded or input music via file/url
  public playCustomMusic(source: string | File) {
    try {
      this.stopAmbientMusic();
      this.initCustomAudio();
      this.currentMusicPreset = "custom";
      if (this.audioEl) {
        if (source instanceof File) {
          const objectUrl = URL.createObjectURL(source);
          this.audioEl.src = objectUrl;
        } else {
          this.audioEl.src = source;
        }
        this.audioEl.volume = this.masterMusicVolume;
        this.audioEl.play()
          .then(() => {
            this.isMusicPlaying = true;
          })
          .catch((e) => {
            console.warn("Could not autoplay custom audio source", e);
          });
      }
    } catch (err) {
      console.warn("Failed to play custom music", err);
    }
  }

  // Spawns a procedural retro synthesizer loop matching the chosen genre/preset
  public startAmbientMusic(preset: "ambient" | "cyberpunk" | "drone" = "ambient") {
    this.stopAmbientMusic();
    try {
      this.initCtx();
      if (!this.ctx) return;

      this.isMusicPlaying = true;
      this.currentMusicPreset = preset;

      const playStep = () => {
        if (!this.isMusicPlaying || !this.ctx || this.currentMusicPreset === "custom") return;
        const now = this.ctx.currentTime;

        if (preset === "ambient") {
          // Soft ambient pleasant chord progression
          const chords = [
            [261.63, 329.63, 392.00, 493.88], // Cmaj7: C4, E4, G4, B4
            [293.66, 349.23, 440.00, 523.25], // Dmin7: D4, F4, A4, C5
            [349.23, 440.00, 523.25, 587.33], // Fmaj7: F4, A4, C5, D5
            [196.00, 246.94, 293.66, 392.00], // G7: G3, B3, D4, G4
          ];
          const randomChord = chords[Math.floor(Math.random() * chords.length)];
          randomChord.forEach((freq) => {
            if (!this.ctx) return;
            const osc = this.ctx.createOscillator();
            const oscGain = this.ctx.createGain();
            osc.connect(oscGain);
            oscGain.connect(this.ctx.destination);

            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, now);

            oscGain.gain.setValueAtTime(0, now);
            oscGain.gain.linearRampToValueAtTime(0.04 * this.masterMusicVolume, now + 1.0);
            oscGain.gain.exponentialRampToValueAtTime(0.001, now + 3.8);

            osc.start(now);
            osc.stop(now + 4.0);
          });
        } else if (preset === "cyberpunk") {
          // Retro 8-bit rhythmic synth line
          const scales = [130.81, 146.83, 164.81, 196.00, 220.00]; // Pentatonic C
          const notesLen = 8;
          for (let i = 0; i < notesLen; i++) {
            const timeOffset = i * 0.25;
            const freq = scales[Math.floor(Math.random() * scales.length)] * 2; // Arp octave
            const osc = this.ctx.createOscillator();
            const oscGain = this.ctx.createGain();
            
            osc.connect(oscGain);
            oscGain.connect(this.ctx.destination);

            osc.type = Math.random() > 0.5 ? "sawtooth" : "triangle";
            osc.frequency.setValueAtTime(freq, now + timeOffset);

            oscGain.gain.setValueAtTime(0, now + timeOffset);
            oscGain.gain.linearRampToValueAtTime(0.05 * this.masterMusicVolume, now + timeOffset + 0.05);
            oscGain.gain.exponentialRampToValueAtTime(0.001, now + timeOffset + 0.22);

            osc.start(now + timeOffset);
            osc.stop(now + timeOffset + 0.25);
          }
        } else if (preset === "drone") {
          // Deep sweeping cosmic spatial synth drone
          const baseFreq = 82.41; // E2 (low bass)
          [baseFreq, baseFreq * 1.5, baseFreq * 2].forEach((freq, idx) => {
            if (!this.ctx) return;
            const osc = this.ctx.createOscillator();
            const oscGain = this.ctx.createGain();
            
            osc.connect(oscGain);
            oscGain.connect(this.ctx.destination);

            osc.type = "triangle";
            osc.frequency.setValueAtTime(freq, now);
            // Sweep frequency gently matching deep sci-fi cosmic feel
            osc.frequency.linearRampToValueAtTime(freq * (1.0 + Math.sin(idx) * 0.03), now + 4.0);

            oscGain.gain.setValueAtTime(0, now);
            oscGain.gain.linearRampToValueAtTime(0.06 * this.masterMusicVolume, now + 1.5);
            oscGain.gain.exponentialRampToValueAtTime(0.001, now + 3.9);

            osc.start(now);
            osc.stop(now + 4.0);
          });
        }
      };

      playStep();
      this.musicInterval = setInterval(playStep, 4000);
    } catch (e) {
      console.warn("Could not start music preset:", preset, e);
    }
  }

  public stopAmbientMusic() {
    this.isMusicPlaying = false;
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
    if (this.audioEl) {
      try {
        this.audioEl.pause();
      } catch (e) {}
    }
  }

  public toggleMusic(): boolean {
    if (this.isMusicPlaying) {
      this.stopAmbientMusic();
      return false;
    } else {
      this.startAmbientMusic(this.currentMusicPreset !== "custom" ? this.currentMusicPreset : "ambient");
      return true;
    }
  }

  // Speak narration text using window.speechSynthesis in Italian
  public speakText(
    text: string,
    optionsOrOnEnd?: { pitch?: number; rate?: number; role?: string; systemVoiceName?: string } | (() => void),
    onEndCallback?: () => void
  ) {
    let options: { pitch?: number; rate?: number; role?: string; systemVoiceName?: string } | undefined;
    let onEnd = onEndCallback;

    if (typeof optionsOrOnEnd === "function") {
      onEnd = optionsOrOnEnd;
    } else {
      options = optionsOrOnEnd;
    }

    if (!text) {
      if (onEnd) onEnd();
      return;
    }

    try {
      if ("speechSynthesis" in window) {
        // Cancel first
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "it-IT"; // Set to Italian matching translation
        
        let rate = 1.05; // Slightly faster for comic narration feeling
        let pitch = 1.0;

        // Apply customized voice profile tuning based on role
        if (options) {
          if (options.rate !== undefined) rate = options.rate;
          if (options.pitch !== undefined) pitch = options.pitch;

          if (options.role) {
            switch (options.role) {
              case "Hero":
                pitch = 1.05;
                rate = 1.02;
                break;
              case "Villain":
                pitch = 0.72; // Deep and slow
                rate = 0.88;
                break;
              case "Sidekick":
                pitch = 1.35; // Bright, high and fast
                rate = 1.15;
                break;
              case "Support":
                pitch = 1.1;
                rate = 1.0;
                break;
              case "narrator":
                pitch = 0.95;
                rate = 1.05;
                break;
              default:
                break;
            }
          }
        }

        utterance.rate = rate;
        utterance.pitch = pitch;

        // Try to select an elegant Italian voice if available
        const voices = window.speechSynthesis.getVoices();
        
        let selectedVoice: SpeechSynthesisVoice | undefined;
        if (options?.systemVoiceName) {
          selectedVoice = voices.find(v => v.name === options.systemVoiceName);
        }

        if (selectedVoice) {
          utterance.voice = selectedVoice;
        } else {
          const itVoices = voices.filter(v => v.lang.startsWith("it"));
          if (itVoices.length > 0) {
            if (options?.role === "Villain" && itVoices.length > 1) {
              const maleVoice = itVoices.find(v => v.name.toLowerCase().includes("luca") || v.name.toLowerCase().includes("cosimo") || v.name.toLowerCase().includes("elena") === false);
              utterance.voice = maleVoice || itVoices[0];
            } else if (options?.role === "Sidekick" && itVoices.length > 1) {
              const femaleVoice = itVoices.find(v => v.name.toLowerCase().includes("alice") || v.name.toLowerCase().includes("elsa") || v.name.toLowerCase().includes("elena"));
              utterance.voice = femaleVoice || itVoices[itVoices.length - 1];
            } else {
              utterance.voice = itVoices[0];
            }
          }
        }

        if (onEnd) {
          utterance.onend = () => onEnd?.();
          utterance.onerror = () => onEnd?.();
        }

        window.speechSynthesis.speak(utterance);
      } else {
        console.warn("Speech synthesis not supported in this browser.");
        if (onEnd) onEnd();
      }
    } catch (e) {
      console.warn("SPEECH ERROR:", e);
      if (onEnd) onEnd();
    }
  }

  // Play incoming Base64 synthesised Gemini speech audio wave data
  public playSpeechAudioBase64(base64Audio: string, onEnd?: () => void) {
    try {
      this.initCtx();
      if (!this.ctx) {
        if (onEnd) onEnd();
        return;
      }

      const binaryString = window.atob(base64Audio.split(",")[1] || base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      this.ctx.decodeAudioData(bytes.buffer, (buffer) => {
        if (!this.ctx) {
          if (onEnd) onEnd();
          return;
        }
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.ctx.destination);
        source.start(0);
        if (onEnd) {
          source.onended = () => onEnd();
        }
      }, (e) => {
        console.error("Error decoding Audio Base64", e);
        if (onEnd) onEnd();
      });
    } catch (err) {
      console.error("Audio Web Synth playback failed", err);
      if (onEnd) onEnd();
    }
  }
}

export const audioEngine = new AudioEngine();
