// Krótkie sygnały z Web Audio API (bez plików dźwiękowych).

let _ctx: AudioContext | null = null;
let _enabled = true;

function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!_ctx) {
    try {
      const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      _ctx = new AC();
    } catch {
      return null;
    }
  }
  if (_ctx && _ctx.state === "suspended") {
    void _ctx.resume();
  }
  return _ctx;
}

export function setSoundsEnabled(on: boolean) {
  _enabled = on;
  if (typeof window !== "undefined") {
    try { localStorage.setItem("mn.sounds", on ? "1" : "0"); } catch { /* noop */ }
  }
}

export function soundsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = localStorage.getItem("mn.sounds");
    if (v === "0") { _enabled = false; return false; }
  } catch { /* noop */ }
  return _enabled;
}

type ToneOpts = {
  freq: number;
  duration?: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
};

function tone({ freq, duration = 0.18, type = "sine", gain = 0.08, delay = 0 }: ToneOpts) {
  const ac = ctx();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export const sfx = {
  tap() {
    if (!soundsEnabled()) return;
    tone({ freq: 1320, duration: 0.08, type: "sine", gain: 0.05 });
  },
  hover() {
    if (!soundsEnabled()) return;
    tone({ freq: 880, duration: 0.06, type: "sine", gain: 0.025 });
  },
  success() {
    if (!soundsEnabled()) return;
    tone({ freq: 880, duration: 0.16, gain: 0.07 });
    tone({ freq: 1318.5, duration: 0.32, gain: 0.06, delay: 0.09 });
  },
  chime() {
    if (!soundsEnabled()) return;
    tone({ freq: 523.25, duration: 0.45, type: "sine", gain: 0.06 });
    tone({ freq: 783.99, duration: 0.5, type: "sine", gain: 0.05, delay: 0.05 });
    tone({ freq: 1046.5, duration: 0.55, type: "sine", gain: 0.04, delay: 0.12 });
  },
  swipe() {
    if (!soundsEnabled()) return;
    tone({ freq: 660, duration: 0.12, type: "triangle", gain: 0.04 });
    tone({ freq: 990, duration: 0.14, type: "triangle", gain: 0.03, delay: 0.04 });
  },
};
