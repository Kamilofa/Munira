/**
 * Generates built-in test audio clips so users can try voice effects immediately
 * even if they don't have a microphone handy or want a quick demo.
 */
export function createSyntheticVoiceSample(
  audioCtx: BaseAudioContext,
  sampleType: 'french_phrase' | 'melody' = 'french_phrase'
): AudioBuffer {
  const sampleRate = audioCtx.sampleRate;
  const duration = 3.6;
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = audioCtx.createBuffer(1, numSamples, sampleRate);
  const data = buffer.getChannelData(0);

  // Phonetic frequencies simulating syllables: "Mou - ni - ra - chan - ge - ta - voix"
  // Notes in Hz for pitch curve: F3, G3, A3, F3, C4, Bb3, A3, F3
  const syllables = [
    { start: 0.1, end: 0.5, f0: 165, f1: 300, f2: 870 },  // "Mou" (u)
    { start: 0.55, end: 0.9, f0: 175, f1: 270, f2: 2290 }, // "ni" (i)
    { start: 0.95, end: 1.4, f0: 196, f1: 660, f2: 1720 }, // "ra" (a)
    { start: 1.55, end: 1.95, f0: 175, f1: 530, f2: 1840 }, // "chan" (an)
    { start: 2.0, end: 2.35, f0: 165, f1: 440, f2: 1020 }, // "ge" (e)
    { start: 2.4, end: 2.75, f0: 196, f1: 730, f2: 1090 }, // "ta" (a)
    { start: 2.8, end: 3.4, f0: 220, f1: 300, f2: 870 },   // "voix" (wa)
  ];

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;

    for (const syl of syllables) {
      if (t >= syl.start && t <= syl.end) {
        const sylTime = t - syl.start;
        const sylDur = syl.end - syl.start;

        // Envelope (attack and decay)
        const attack = Math.min(1, sylTime / 0.04);
        const release = Math.min(1, (sylDur - sylTime) / 0.06);
        const env = Math.max(0, attack * release);

        // Natural vocal vibrato
        const vibrato = 1 + 0.02 * Math.sin(2 * Math.PI * 5.5 * t);
        const baseFreq = syl.f0 * vibrato;

        // Glottal pulse approximation: harmonics
        let voiceSignal = 0;
        for (let h = 1; h <= 12; h++) {
          const harmonicFreq = baseFreq * h;
          if (harmonicFreq > 4000) break;

          // Formant resonance weighting
          const d1 = Math.abs(harmonicFreq - syl.f1);
          const d2 = Math.abs(harmonicFreq - syl.f2);
          const formantBoost =
            1.2 / (1 + (d1 / 150) ** 2) + 0.8 / (1 + (d2 / 200) ** 2);

          const harmonicAmp = (1 / h) * (0.3 + formantBoost);
          voiceSignal += harmonicAmp * Math.sin(2 * Math.PI * harmonicFreq * t);
        }

        // Slight breath noise
        const breath = (Math.random() * 2 - 1) * 0.02;

        sample += (voiceSignal + breath) * env * 0.45;
        break;
      }
    }

    data[i] = Math.max(-1, Math.min(1, sample));
  }

  return buffer;
}
