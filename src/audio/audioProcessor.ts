import { EffectType } from './types';
import { audioBufferToWav } from './wavEncoder';

/**
 * High-quality Granular Pitch Shifter for Float32Array PCM audio.
 * Pitch shifts by semitones while preserving audio duration.
 */
function granularPitchShift(
  inputData: Float32Array,
  semitones: number,
  sampleRate: number
): Float32Array {
  if (Math.abs(semitones) < 0.1) {
    return new Float32Array(inputData);
  }

  const pitchRatio = Math.pow(2, semitones / 12);
  const grainSize = Math.floor(sampleRate * 0.05); // 50ms grain
  const hopSize = Math.floor(grainSize / 4); // 75% overlap
  const outputLength = inputData.length;
  const output = new Float32Array(outputLength);
  const normWeight = new Float32Array(outputLength);

  // Pre-calculate Hanning window
  const window = new Float32Array(grainSize);
  for (let i = 0; i < grainSize; i++) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (grainSize - 1)));
  }

  let outPos = 0;
  let inPos = 0;

  while (outPos + grainSize < outputLength && inPos + grainSize < inputData.length) {
    for (let i = 0; i < grainSize; i++) {
      const readIdx = Math.floor(inPos + i * pitchRatio);
      if (readIdx < inputData.length) {
        const val = inputData[readIdx] * window[i];
        output[outPos + i] += val;
        normWeight[outPos + i] += window[i];
      }
    }
    outPos += hopSize;
    inPos += hopSize;
  }

  // Normalize by accumulated window weights to prevent volume ripple
  for (let i = 0; i < outputLength; i++) {
    if (normWeight[i] > 0.001) {
      output[i] /= normWeight[i];
    }
  }

  return output;
}

/**
 * Resamples an AudioBuffer by a speed/pitch ratio (like changing tape/vinyl speed).
 * Changes both pitch and tempo simultaneously (classic chipmunk or slow-motion giant).
 */
function resampleAudioBuffer(
  buffer: AudioBuffer,
  ratio: number,
  audioCtx: BaseAudioContext
): AudioBuffer {
  const newLength = Math.max(1, Math.round(buffer.length / ratio));
  const newBuffer = audioCtx.createBuffer(
    buffer.numberOfChannels,
    newLength,
    buffer.sampleRate
  );

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const src = buffer.getChannelData(ch);
    const dst = newBuffer.getChannelData(ch);
    for (let i = 0; i < newLength; i++) {
      const srcIdx = i * ratio;
      const idx0 = Math.floor(srcIdx);
      const idx1 = Math.min(src.length - 1, idx0 + 1);
      const frac = srcIdx - idx0;
      dst[i] = src[idx0] * (1 - frac) + src[idx1] * frac;
    }
  }

  return newBuffer;
}

/**
 * Creates an overdrive curve for monster/distortion effects
 */
function makeDistortionCurve(amount: number = 20): Float32Array {
  const k = typeof amount === 'number' ? amount : 20;
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

/**
 * Applies a gentle cosine fade-in and fade-out directly to an AudioBuffer
 * to eliminate DC offset clicks, pops, and sudden edge transitions.
 */
export function applyBufferFade(
  buffer: AudioBuffer,
  fadeInDurationSec = 0.02,
  fadeOutDurationSec = 0.035
): AudioBuffer {
  const sampleRate = buffer.sampleRate;
  const fadeInSamples = Math.min(
    Math.floor(fadeInDurationSec * sampleRate),
    Math.floor(buffer.length / 2)
  );
  const fadeOutSamples = Math.min(
    Math.floor(fadeOutDurationSec * sampleRate),
    Math.floor(buffer.length / 2)
  );

  if (fadeInSamples <= 0 && fadeOutSamples <= 0) return buffer;

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);

    // Smooth half-cosine S-curve fade-in
    for (let i = 0; i < fadeInSamples; i++) {
      const factor = 0.5 * (1 - Math.cos((Math.PI * i) / fadeInSamples));
      data[i] *= factor;
    }

    // Smooth half-cosine S-curve fade-out
    const startFadeOut = buffer.length - fadeOutSamples;
    for (let i = 0; i < fadeOutSamples; i++) {
      const idx = startFadeOut + i;
      const factor = 0.5 * (1 + Math.cos((Math.PI * i) / fadeOutSamples));
      data[idx] *= factor;
    }
  }

  return buffer;
}

/**
 * Applies voice effects to an input AudioBuffer and returns the processed AudioBuffer + WAV Blob.
 */
export async function applyVoiceEffect(
  inputBuffer: AudioBuffer,
  effect: EffectType,
  intensity: number // 0 to 100
): Promise<{ buffer: AudioBuffer; wavBlob: Blob }> {
  // Normalize intensity to 0..1
  const normIntensity = Math.max(0, Math.min(100, intensity)) / 100;

  // Base sample rate
  const sampleRate = inputBuffer.sampleRate;

  // If no effect or dry passthrough, apply gentle boundary fade
  if (effect === 'none') {
    applyBufferFade(inputBuffer);
    const wavBlob = audioBufferToWav(inputBuffer);
    return { buffer: inputBuffer, wavBlob };
  }

  let sourceBuffer = inputBuffer;

  // 1. Time & Pitch pre-transformations
  if (effect === 'deep') {
    // Semitones shift: -2 to -9 semitones based on intensity
    const semitones = -1.5 - normIntensity * 7.5;
    const numChannels = inputBuffer.numberOfChannels;
    const newBuf = new AudioContext().createBuffer(
      numChannels,
      inputBuffer.length,
      sampleRate
    );
    for (let ch = 0; ch < numChannels; ch++) {
      const shifted = granularPitchShift(
        inputBuffer.getChannelData(ch),
        semitones,
        sampleRate
      );
      newBuf.getChannelData(ch).set(shifted);
    }
    sourceBuffer = newBuf;
  } else if (effect === 'high') {
    // Semitones shift: +2 to +8.5 semitones based on intensity
    const semitones = 2 + normIntensity * 6.5;
    const numChannels = inputBuffer.numberOfChannels;
    const newBuf = new AudioContext().createBuffer(
      numChannels,
      inputBuffer.length,
      sampleRate
    );
    for (let ch = 0; ch < numChannels; ch++) {
      const shifted = granularPitchShift(
        inputBuffer.getChannelData(ch),
        semitones,
        sampleRate
      );
      newBuf.getChannelData(ch).set(shifted);
    }
    sourceBuffer = newBuf;
  } else if (effect === 'squirrel') {
    // True chipmunk style: speed & pitch transposed up (1.28x to 1.85x)
    const ratio = 1.25 + normIntensity * 0.6;
    sourceBuffer = resampleAudioBuffer(inputBuffer, ratio, new AudioContext());
  } else if (effect === 'monster') {
    // Deep heavy pitch shift (-6 to -11 semitones) + slight slow down (0.88x)
    const semitones = -5 - normIntensity * 6;
    const numChannels = inputBuffer.numberOfChannels;
    const tempBuf = new AudioContext().createBuffer(
      numChannels,
      inputBuffer.length,
      sampleRate
    );
    for (let ch = 0; ch < numChannels; ch++) {
      const shifted = granularPitchShift(
        inputBuffer.getChannelData(ch),
        semitones,
        sampleRate
      );
      tempBuf.getChannelData(ch).set(shifted);
    }
    // Slight slowdown for massive heavy creature feel
    sourceBuffer = resampleAudioBuffer(tempBuf, 0.9, new AudioContext());
  }

  // 2. Offline Audio Graph for filters, ring mod, delays, and distortion
  const totalDuration = sourceBuffer.duration + (effect === 'echo' ? 2.5 : 0.4);
  const offlineCtx = new OfflineAudioContext(
    sourceBuffer.numberOfChannels,
    Math.ceil(totalDuration * sampleRate),
    sampleRate
  );

  const bufferSource = offlineCtx.createBufferSource();
  bufferSource.buffer = sourceBuffer;

  let lastNode: AudioNode = bufferSource;

  if (effect === 'deep') {
    // Low-shelf boost + high-shelf cut to thicken chest resonance
    const lowShelf = offlineCtx.createBiquadFilter();
    lowShelf.type = 'lowshelf';
    lowShelf.frequency.value = 240;
    lowShelf.gain.value = 7 + normIntensity * 6; // +7dB to +13dB

    const highCut = offlineCtx.createBiquadFilter();
    highCut.type = 'lowpass';
    highCut.frequency.value = 3400 - normIntensity * 1000;

    lastNode.connect(lowShelf);
    lowShelf.connect(highCut);
    lastNode = highCut;
  } else if (effect === 'high') {
    // High-pass to remove low rumbles + peaking presence at 3kHz
    const highPass = offlineCtx.createBiquadFilter();
    highPass.type = 'highpass';
    highPass.frequency.value = 220;

    const presence = offlineCtx.createBiquadFilter();
    presence.type = 'peaking';
    presence.frequency.value = 2800;
    presence.gain.value = 5 + normIntensity * 4;

    lastNode.connect(highPass);
    highPass.connect(presence);
    lastNode = presence;
  } else if (effect === 'robot') {
    // Ring Modulator: multiplies audio by a sine oscillator
    // Carrier frequency: 40Hz to 150Hz
    const carrierFreq = 35 + normIntensity * 115;
    const oscillator = offlineCtx.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = carrierFreq;

    const ringModGain = offlineCtx.createGain();
    ringModGain.gain.value = 0; // modulated by oscillator

    // Connect oscillator to gain parameter
    oscillator.connect(ringModGain.gain);
    oscillator.start(0);

    // Bandpass filter for metallic walkie-talkie / robotic tone
    const bandpass = offlineCtx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 1000;
    bandpass.Q.value = 2.5;

    // Highpass to eliminate ultra-low sub harmonics
    const hp = offlineCtx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 160;

    // Mix dry & wet
    const dryGain = offlineCtx.createGain();
    dryGain.gain.value = 0.2;

    const wetGain = offlineCtx.createGain();
    wetGain.gain.value = 0.85;

    lastNode.connect(dryGain);
    lastNode.connect(ringModGain);
    ringModGain.connect(bandpass);
    bandpass.connect(wetGain);

    const merger = offlineCtx.createGain();
    dryGain.connect(merger);
    wetGain.connect(merger);
    merger.connect(hp);
    lastNode = hp;
  } else if (effect === 'echo') {
    // Stereo / Ping-pong style feedback delay with frequency dampening
    const delayTime = 0.12 + normIntensity * 0.38; // 120ms to 500ms
    const feedbackAmount = 0.35 + normIntensity * 0.3; // 35% to 65%

    const delayNode = offlineCtx.createDelay(1.0);
    delayNode.delayTime.value = delayTime;

    const feedbackGain = offlineCtx.createGain();
    feedbackGain.gain.value = feedbackAmount;

    // Lowpass filter in feedback loop so each echo gets darker & warmer
    const echoFilter = offlineCtx.createBiquadFilter();
    echoFilter.type = 'lowpass';
    echoFilter.frequency.value = 2200;

    const dryGain = offlineCtx.createGain();
    dryGain.gain.value = 0.85;

    const wetGain = offlineCtx.createGain();
    wetGain.gain.value = 0.65;

    const outputSummer = offlineCtx.createGain();

    // Dry path
    lastNode.connect(dryGain);
    dryGain.connect(outputSummer);

    // Wet loop
    lastNode.connect(delayNode);
    delayNode.connect(echoFilter);
    echoFilter.connect(feedbackGain);
    feedbackGain.connect(delayNode); // loopback

    echoFilter.connect(wetGain);
    wetGain.connect(outputSummer);

    lastNode = outputSummer;
  } else if (effect === 'monster') {
    // Monster: Ring modulator (25Hz) + Overdrive WaveShaper + Sub-bass shelf + Resonant filter
    const dist = offlineCtx.createWaveShaper();
    dist.curve = makeDistortionCurve(15 + normIntensity * 30) as Float32Array<ArrayBuffer>;
    dist.oversample = '2x';

    // Sub-harmonic ring modulation for demonic growl
    const subOsc = offlineCtx.createOscillator();
    subOsc.type = 'sawtooth';
    subOsc.frequency.value = 28;

    const growlGain = offlineCtx.createGain();
    growlGain.gain.value = 0.35 * normIntensity;
    subOsc.connect(growlGain.gain);
    subOsc.start(0);

    const lowBoost = offlineCtx.createBiquadFilter();
    lowBoost.type = 'lowshelf';
    lowBoost.frequency.value = 160;
    lowBoost.gain.value = 8;

    const darkFilter = offlineCtx.createBiquadFilter();
    darkFilter.type = 'lowpass';
    darkFilter.frequency.value = 2600 - normIntensity * 700;
    darkFilter.Q.value = 3;

    lastNode.connect(dist);
    dist.connect(darkFilter);
    darkFilter.connect(lowBoost);

    // Mix growl
    const outGain = offlineCtx.createGain();
    outGain.gain.value = 1.1;
    lowBoost.connect(outGain);

    lastNode = outGain;
  } else if (effect === 'squirrel') {
    // Peaking highs, high-pass cutoff low rumble
    const hp = offlineCtx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 300;

    const peak = offlineCtx.createBiquadFilter();
    peak.type = 'peaking';
    peak.frequency.value = 3200;
    peak.gain.value = 6;
    peak.Q.value = 2;

    lastNode.connect(hp);
    hp.connect(peak);
    lastNode = peak;
  }

  // Master limiter / gain to avoid digital clipping
  const masterGain = offlineCtx.createGain();
  masterGain.gain.value = 0.95;
  lastNode.connect(masterGain);
  masterGain.connect(offlineCtx.destination);

  bufferSource.start(0);

  const renderedBuffer = await offlineCtx.startRendering();

  // Apply subtle anti-click fade-in and fade-out to prevent pop artifacts at edges
  applyBufferFade(renderedBuffer, 0.02, 0.035);

  const wavBlob = audioBufferToWav(renderedBuffer);

  return {
    buffer: renderedBuffer,
    wavBlob,
  };
}
