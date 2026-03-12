// Procedural audio using Web Audio API
let audioCtx = null;

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

export function resumeAudio() {
  const ctx = getCtx();
  if (ctx.state === 'suspended') ctx.resume();
}

function playTone(freq, duration, type = 'square', volume = 0.1) {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

function playNoise(duration, volume = 0.05) {
  const ctx = getCtx();
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start();
}

export const SFX = {
  chomp() { playTone(200, 0.1, 'sawtooth', 0.08); playTone(150, 0.05, 'square', 0.06); },
  splat() { playNoise(0.15, 0.06); playTone(100, 0.1, 'sine', 0.04); },
  freeze() { playTone(800, 0.2, 'sine', 0.05); playTone(1200, 0.15, 'sine', 0.03); },
  hex() { playTone(400, 0.15, 'triangle', 0.06); playTone(600, 0.1, 'triangle', 0.04); },
  coin() { playTone(1200, 0.08, 'sine', 0.06); playTone(1600, 0.1, 'sine', 0.05); },
  pop() { playNoise(0.08, 0.07); playTone(300, 0.06, 'sine', 0.05); },
  click() { playTone(600, 0.05, 'square', 0.04); },
  cardDraw() { playNoise(0.1, 0.03); playTone(500, 0.08, 'sine', 0.03); },
  cardPlay() { playNoise(0.06, 0.05); playTone(400, 0.06, 'square', 0.04); },
  build() { playTone(300, 0.1, 'square', 0.06); playTone(400, 0.08, 'square', 0.05); },
  sell() { playTone(400, 0.1, 'sawtooth', 0.05); playTone(200, 0.15, 'sawtooth', 0.04); },
  baseDamage() { playTone(80, 0.3, 'sine', 0.1); playNoise(0.2, 0.08); },
  victory() {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => playTone(f, 0.3, 'sine', 0.08), i * 150);
    });
  },
  defeat() {
    [400, 350, 300, 200].forEach((f, i) => {
      setTimeout(() => playTone(f, 0.4, 'sawtooth', 0.06), i * 200);
    });
  },
  roundStart() { playTone(500, 0.1, 'sine', 0.06); playTone(700, 0.15, 'sine', 0.06); },
  fight() {
    playTone(600, 0.15, 'square', 0.08);
    setTimeout(() => playTone(800, 0.2, 'square', 0.08), 100);
  },
};

// Simple ambient background
let ambientInterval = null;
export function startAmbient() {
  if (ambientInterval) return;
  ambientInterval = setInterval(() => {
    const freq = 100 + Math.random() * 50;
    playTone(freq, 2, 'sine', 0.015);
  }, 3000);
}

export function stopAmbient() {
  if (ambientInterval) {
    clearInterval(ambientInterval);
    ambientInterval = null;
  }
}
