// ChronoBee: Asset & Sound Generation Script for Physical KaiOS Deployments
import fs from 'fs';
import path from 'path';

const __dirname = path.resolve();

// Create required build directories
const audioDir = path.join(__dirname, 'audio');
const iconsDir = path.join(__dirname, 'icons');

if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir);
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir);

// 1. GENERATE ICONS FROM PRE-GENERATED CHRONOBEE IMAGE
const sourceImagePath = path.join(__dirname, 'src', 'assets', 'images', 'chronobee_icon_1780155409068.png');
if (fs.existsSync(sourceImagePath)) {
  console.log('Copying generated high-quality icon to KaiOS icon specs...');
  fs.copyFileSync(sourceImagePath, path.join(iconsDir, 'icon-56.png'));
  fs.copyFileSync(sourceImagePath, path.join(iconsDir, 'icon-112.png'));
  fs.copyFileSync(sourceImagePath, path.join(iconsDir, 'icon-128.png'));
  fs.copyFileSync(sourceImagePath, path.join(iconsDir, 'icon-512.png'));
  console.log('Icons cached successfully in /icons/ directory.');
} else {
  console.warn('Source logo image was not found at standard path:', sourceImagePath);
}

// 2. GENERATE CD-QUALITY retro .wav AUDIO FILES (PCM 8-bit, 22050Hz, Mono)
function writeWavFile(filename, duration, sampleGenerator) {
  const sampleRate = 22050;
  const sampleCount = Math.floor(duration * sampleRate);
  
  // 44-byte WAV header + sampleCount bytes
  const buffer = Buffer.alloc(44 + sampleCount);
  
  // Header Write
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + sampleCount, 4); // Chunk size
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Chunk header size
  buffer.writeUInt16LE(1, 20); // Mono format PCM
  buffer.writeUInt16LE(1, 22); // Mono (1 channel)
  buffer.writeUInt32LE(sampleRate, 24); // Sample rate
  buffer.writeUInt32LE(sampleRate, 28); // Byte rate (22050)
  buffer.writeUInt16LE(1, 32); // Block alignment
  buffer.writeUInt16LE(8, 34); // Bit-rate (8-bit)
  buffer.write('data', 36);
  buffer.writeUInt32LE(sampleCount, 40); // Sound samples length
  
  // Write the PCM data points
  for (let i = 0; i < sampleCount; i++) {
    const t = i / sampleRate;
    const val = sampleGenerator(t, duration); // Returns normalized -1.0 to 1.0 sample
    const intVal = Math.floor((val + 1.0) * 127.5); // 0-255 scaling for 8-bit
    buffer[44 + i] = Math.max(0, Math.min(255, intVal));
  }
  
  fs.writeFileSync(path.join(audioDir, filename), buffer);
  console.log(`Generated audio: ${filename} (${(buffer.length/1024).toFixed(1)} KB)`);
}

// Define the sound curves matching the in-game action sounds of ChronoBee
console.log('Synthesizing procedural WAV sounds to improve physical device CPU usage...');

// JUMP sound: sweep frequency from 140Hz up to 580Hz over 0.12s
writeWavFile('jump.wav', 0.12, (t, dur) => {
  const startF = 140;
  const endF = 580;
  const progress = t / dur;
  // Exponential pitch sweep mapping Web Audio API exponentialRampToValueAtTime
  const freq = startF * Math.pow(endF / startF, progress);
  const phase = 2 * Math.PI * freq * t;
  const amp = Math.sin(phase) * (1.0 - progress); // Fade out envelope
  return amp * 0.45;
});

// PHASE transition sound: frequency sweep from 600Hz down to 200Hz over 0.15s
writeWavFile('phase.wav', 0.15, (t, dur) => {
  const startF = 600;
  const endF = 200;
  const progress = t / dur;
  const freq = startF + (endF - startF) * progress;
  const phase = 2 * Math.PI * freq * t;
  const amp = Math.sin(phase) * Math.cos(progress * Math.PI / 2); // Sine smooth decay
  return amp * 0.4;
});

// BOOST: double high-frequency chirp sequence
writeWavFile('boost.wav', 0.20, (t, dur) => {
  const f = t < 0.05 ? 450 : 900;
  const progress = t / dur;
  const phase = 2 * Math.PI * f * t;
  // Sawtooth approximation for crisp retro feeling
  const sawWave = ( (phase / Math.PI) % 2 ) - 1.0;
  const amp = sawWave * (1.0 - progress);
  return amp * 0.25;
});

// DAMAGE / SCRAPE: low-frequency crunchy oscillator sweep
writeWavFile('damage.wav', 0.12, (t, dur) => {
  const progress = t / dur;
  const freq = 120 + (40 - 120) * progress;
  const phase = 2 * Math.PI * freq * t;
  // Square waveform for noise-like impact crush vibe
  const sqWave = Math.sin(phase) >= 0 ? 1.0 : -1.0;
  const amp = sqWave * (1.0 - progress);
  return amp * 0.35;
});

// PICKUP cell collision sound: clean arpeggio sound sequence (Chord: C5 -> E5 -> G5 -> C6)
writeWavFile('pickup.wav', 0.35, (t, dur) => {
  let freq = 523.25; // C5
  if (t > 0.18) freq = 1046.50; // C6
  else if (t > 0.12) freq = 783.99; // G5
  else if (t > 0.06) freq = 659.25; // E5
  
  const phase = 2 * Math.PI * freq * t;
  const progress = t / dur;
  const amp = Math.sin(phase) * (1.0 - progress);
  return amp * 0.45;
});

// GAMEOVER terminal system shutdown drop sweep over 0.65s
writeWavFile('gameover.wav', 0.65, (t, dur) => {
  const progress = t / dur;
  const freq = 320 + (80 - 320) * progress;
  const phase = 2 * Math.PI * freq * t;
  const amp = Math.sin(phase) * Math.pow(1.0 - progress, 1.5);
  return amp * 0.5;
});

console.log('All synthetic retro sound wavs generated successfully.');
