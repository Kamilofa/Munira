/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { WaveformVisualizer } from './components/WaveformVisualizer';
import { EffectSelector } from './components/EffectSelector';
import { AudioPlayerControls } from './components/AudioPlayerControls';
import { AudioSourceSelector } from './components/AudioSourceSelector';
import { EffectType, VOICE_EFFECTS } from './audio/types';
import { applyVoiceEffect } from './audio/audioProcessor';
import { createSyntheticVoiceSample } from './audio/sampleAudio';
import { Mic2, Sparkles, Wand2, ShieldCheck, Zap } from 'lucide-react';

export default function App() {
  // Audio state
  const [originalBuffer, setOriginalBuffer] = useState<AudioBuffer | null>(null);
  const [processedBuffer, setProcessedBuffer] = useState<AudioBuffer | null>(null);
  const [wavBlob, setWavBlob] = useState<Blob | null>(null);
  const [activeEffect, setActiveEffect] = useState<EffectType>('deep');
  const [intensity, setIntensity] = useState<number>(65);

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isProcessingEffect, setIsProcessingEffect] = useState<boolean>(false);

  // Recording state
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [micErrorMessage, setMicErrorMessage] = useState<string | null>(null);

  // Audio nodes and references
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const playerAnalyserRef = useRef<AnalyserNode | null>(null);
  const playerGainRef = useRef<GainNode | null>(null);
  const activeSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const playbackStartTimeRef = useRef<number>(0);
  const playbackOffsetRef = useRef<number>(0);
  const animProgressRef = useRef<number | null>(null);
  const recordTimerRef = useRef<number | null>(null);

  // Initialize AudioContext lazily on user interaction
  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new AudioCtxClass();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  // Process audio whenever originalBuffer, activeEffect, or intensity changes
  const renderEffect = useCallback(
    async (buffer: AudioBuffer, effect: EffectType, effIntensity: number) => {
      setIsProcessingEffect(true);
      try {
        const { buffer: newProcBuffer, wavBlob: newBlob } = await applyVoiceEffect(
          buffer,
          effect,
          effIntensity
        );
        setProcessedBuffer(newProcBuffer);
        setWavBlob(newBlob);
        setDuration(newProcBuffer.duration);
      } catch (err) {
        console.error('Error applying voice effect:', err);
      } finally {
        setIsProcessingEffect(false);
      }
    },
    []
  );

  // Debounced effect processing when slider moves or effect switches
  useEffect(() => {
    if (!originalBuffer) return;

    const timer = setTimeout(() => {
      renderEffect(originalBuffer, activeEffect, intensity);
    }, 60);

    return () => clearTimeout(timer);
  }, [originalBuffer, activeEffect, intensity, renderEffect]);

  // Handle effect selection
  const handleSelectEffect = (effect: EffectType) => {
    setActiveEffect(effect);
    const conf = VOICE_EFFECTS.find((e) => e.id === effect);
    if (conf) {
      setIntensity(conf.defaultIntensity);
    }
    // If audio is playing, pause to allow clean switch
    if (isPlaying) {
      stopPlayback();
    }
  };

  const simulatedOscRef = useRef<OscillatorNode | null>(null);
  const isSimulatedRecordingRef = useRef<boolean>(false);

  // Start simulated recording when microphone is unavailable or blocked
  const startSimulatedRecording = () => {
    setMicErrorMessage(null);
    stopPlayback();
    isSimulatedRecordingRef.current = true;

    const audioCtx = getAudioContext();
    const osc = audioCtx.createOscillator();
    const lfo = audioCtx.createOscillator();
    const lfoGain = audioCtx.createGain();
    const gain = audioCtx.createGain();
    const analyser = audioCtx.createAnalyser();

    analyser.fftSize = 512;
    micAnalyserRef.current = analyser;

    osc.type = 'sine';
    osc.frequency.value = 220;
    lfo.frequency.value = 4;
    lfoGain.gain.value = 50;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    gain.gain.value = 0.4;
    osc.connect(gain);
    gain.connect(analyser);

    osc.start();
    lfo.start();
    simulatedOscRef.current = osc;

    setIsRecording(true);
    setRecordingDuration(0);

    const startTime = Date.now();
    recordTimerRef.current = window.setInterval(() => {
      setRecordingDuration((Date.now() - startTime) / 1000);
    }, 100);
  };

  // Start microphone recording
  const startRecording = async () => {
    setMicErrorMessage(null);
    stopPlayback();

    const audioCtx = getAudioContext();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMicErrorMessage(
        "L'enregistrement micro direct n'est pas disponible dans ce navigateur. Utilisez le mode démo ou importez un fichier audio."
      );
      return;
    }

    try {
      // Appelle getUserMedia uniquement après un clic sur le bouton
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      micStreamRef.current = stream;

      // Connect mic to live analyzer for waveform visualizer
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      micAnalyserRef.current = analyser;

      // MediaRecorder: ne force pas de mimeType, teste le support avec repli sur audio/mp4
      let recorder: MediaRecorder;
      let selectedMimeType = '';

      if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
        const mimeTypesToTest = [
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/mp4',
          'audio/ogg;codecs=opus',
        ];

        for (const mime of mimeTypesToTest) {
          if (MediaRecorder.isTypeSupported(mime)) {
            selectedMimeType = mime;
            break;
          }
        }
      }

      if (selectedMimeType) {
        recorder = new MediaRecorder(stream, { mimeType: selectedMimeType });
      } else {
        recorder = new MediaRecorder(stream);
      }

      mediaRecorderRef.current = recorder;

      const audioChunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const fullBlob = new Blob(audioChunks, { type: recorder.mimeType || 'audio/webm' });
        try {
          const arrayBuffer = await fullBlob.arrayBuffer();
          const decoded = await audioCtx.decodeAudioData(arrayBuffer);
          setOriginalBuffer(decoded);
          setCurrentTime(0);
          playbackOffsetRef.current = 0;
          renderEffect(decoded, activeEffect, intensity);
        } catch (decErr) {
          console.warn('Decode recording note, falling back to clean sample:', decErr);
          handleLoadSyntheticSample();
        }
      };

      recorder.start(100);
      setIsRecording(true);
      setRecordingDuration(0);

      const startTime = Date.now();
      recordTimerRef.current = window.setInterval(() => {
        setRecordingDuration((Date.now() - startTime) / 1000);
      }, 100);
    } catch (err: unknown) {
      console.warn('Microphone access notification:', err);
      const error = err as { name?: string; message?: string };

      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setMicErrorMessage(
          "Permission refusée (NotAllowedError) : L'accès au microphone a été refusé. Veuillez autoriser le microphone dans les paramètres de votre navigateur (icône cadenas à gauche de l'URL)."
        );
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        setMicErrorMessage(
          "Aucun micro trouvé (NotFoundError) : Aucun microphone n'a été détecté sur cet appareil. Veuillez brancher un microphone ou importer un fichier audio."
        );
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        setMicErrorMessage(
          "Micro déjà utilisé (NotReadableError) : Le microphone est déjà sollicité par une autre application ou inaccessible. Veuillez fermer les autres onglets ou logiciels."
        );
      } else {
        setMicErrorMessage(
          error.message || "Erreur lors de l'accès au microphone. Tu peux importer un fichier audio ou tester le mode démo."
        );
      }
      setIsRecording(false);
    }
  };

  // Stop microphone recording
  const stopRecording = () => {
    if (isSimulatedRecordingRef.current) {
      if (simulatedOscRef.current) {
        try {
          simulatedOscRef.current.stop();
          simulatedOscRef.current.disconnect();
        } catch {
          // Ignored
        }
        simulatedOscRef.current = null;
      }
      isSimulatedRecordingRef.current = false;
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
      setIsRecording(false);
      handleLoadSyntheticSample();
      return;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    setIsRecording(false);
  };

  // Audio file loaded from disk
  const handleAudioFileLoaded = (buffer: AudioBuffer, fileName: string) => {
    stopPlayback();
    setOriginalBuffer(buffer);
    setCurrentTime(0);
    playbackOffsetRef.current = 0;
    renderEffect(buffer, activeEffect, intensity);
    console.log(`Loaded audio file: ${fileName}, duration: ${buffer.duration.toFixed(2)}s`);
  };

  // Load demo vocal sample
  const handleLoadSyntheticSample = () => {
    stopPlayback();
    const audioCtx = getAudioContext();
    const sampleBuffer = createSyntheticVoiceSample(audioCtx);
    setOriginalBuffer(sampleBuffer);
    setCurrentTime(0);
    playbackOffsetRef.current = 0;
    renderEffect(sampleBuffer, activeEffect, intensity);
  };

  // Playback control with smooth fade-out to prevent clicks
  const stopPlayback = (immediate = false) => {
    const currentSource = activeSourceNodeRef.current;
    const currentGain = playerGainRef.current;
    const audioCtx = audioCtxRef.current;

    if (animProgressRef.current) {
      cancelAnimationFrame(animProgressRef.current);
      animProgressRef.current = null;
    }
    setIsPlaying(false);

    if (!currentSource) return;

    if (immediate || !currentGain || !audioCtx || audioCtx.state !== 'running') {
      try {
        currentSource.stop();
        currentSource.disconnect();
      } catch {
        // Ignored
      }
      activeSourceNodeRef.current = null;
      playerGainRef.current = null;
    } else {
      // Gentle micro-fade out over 25ms to suppress audible clicks
      try {
        const now = audioCtx.currentTime;
        currentGain.gain.cancelScheduledValues(now);
        currentGain.gain.setValueAtTime(currentGain.gain.value, now);
        currentGain.gain.linearRampToValueAtTime(0, now + 0.025);
        setTimeout(() => {
          try {
            currentSource.stop();
            currentSource.disconnect();
          } catch {
            // Ignored
          }
        }, 30);
      } catch {
        try {
          currentSource.stop();
          currentSource.disconnect();
        } catch {
          // Ignored
        }
      }
      activeSourceNodeRef.current = null;
      playerGainRef.current = null;
    }
  };

  const startPlaybackAt = (offsetSec: number) => {
    const audioCtx = getAudioContext();
    const targetBuffer = processedBuffer || originalBuffer;
    if (!targetBuffer) return;

    stopPlayback(true);

    const boundedOffset = Math.max(0, Math.min(offsetSec, targetBuffer.duration));
    if (boundedOffset >= targetBuffer.duration) {
      setCurrentTime(0);
      playbackOffsetRef.current = 0;
      return;
    }

    const source = audioCtx.createBufferSource();
    source.buffer = targetBuffer;

    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    playerAnalyserRef.current = analyser;

    // Gain node for fade-in / fade-out envelope
    const playerGain = audioCtx.createGain();
    playerGainRef.current = playerGain;

    source.connect(analyser);
    analyser.connect(playerGain);
    playerGain.connect(audioCtx.destination);

    // Smooth fade-in (30ms) to avoid clicks at start or when seeking
    const now = audioCtx.currentTime;
    const fadeInDur = 0.03;
    playerGain.gain.setValueAtTime(0, now);
    playerGain.gain.linearRampToValueAtTime(1, now + fadeInDur);

    // Pre-schedule smooth fade-out (35ms) before the audio finishes
    const remainingDuration = targetBuffer.duration - boundedOffset;
    const fadeOutDur = 0.035;
    if (remainingDuration > fadeInDur + fadeOutDur) {
      const fadeOutStart = now + remainingDuration - fadeOutDur;
      playerGain.gain.setValueAtTime(1, fadeOutStart);
      playerGain.gain.linearRampToValueAtTime(0, now + remainingDuration);
    }

    source.onended = () => {
      // Check if this source is still the active one
      if (activeSourceNodeRef.current === source) {
        setIsPlaying(false);
        setCurrentTime(0);
        playbackOffsetRef.current = 0;
        activeSourceNodeRef.current = null;
        playerGainRef.current = null;
        if (animProgressRef.current) {
          cancelAnimationFrame(animProgressRef.current);
          animProgressRef.current = null;
        }
      }
    };

    source.start(0, boundedOffset);
    activeSourceNodeRef.current = source;
    playbackStartTimeRef.current = audioCtx.currentTime;
    playbackOffsetRef.current = boundedOffset;
    setIsPlaying(true);

    // High refresh progress update
    const updateProgress = () => {
      if (!audioCtxRef.current) return;
      const elapsed = audioCtxRef.current.currentTime - playbackStartTimeRef.current;
      const now = playbackOffsetRef.current + elapsed;

      if (now >= targetBuffer.duration) {
        setCurrentTime(targetBuffer.duration);
        setIsPlaying(false);
        return;
      }

      setCurrentTime(now);
      animProgressRef.current = requestAnimationFrame(updateProgress);
    };

    animProgressRef.current = requestAnimationFrame(updateProgress);
  };

  const togglePlay = () => {
    if (isPlaying) {
      // Pause
      playbackOffsetRef.current = currentTime;
      stopPlayback();
    } else {
      // Play
      startPlaybackAt(currentTime >= duration ? 0 : currentTime);
    }
  };

  const handleSeek = (newTime: number) => {
    const targetBuffer = processedBuffer || originalBuffer;
    if (!targetBuffer) return;
    const bounded = Math.max(0, Math.min(newTime, targetBuffer.duration));
    setCurrentTime(bounded);
    playbackOffsetRef.current = bounded;

    if (isPlaying) {
      startPlaybackAt(bounded);
    }
  };

  // Download modified WAV file
  const handleDownload = () => {
    if (!wavBlob) return;
    const effectName = activeEffect;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `mounira-${effectName}-${timestamp}.wav`;

    const url = URL.createObjectURL(wavBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Reset audio
  const handleReset = () => {
    stopPlayback();
    if (isRecording) {
      stopRecording();
    }
    setOriginalBuffer(null);
    setProcessedBuffer(null);
    setWavBlob(null);
    setCurrentTime(0);
    setDuration(0);
  };

  return (
    <div className="min-h-screen bg-[#0b0817] text-slate-100 flex flex-col justify-between selection:bg-fuchsia-500 selection:text-white">
      {/* Background Neon Ambient Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[650px] h-[350px] bg-gradient-to-br from-purple-600/20 via-fuchsia-600/15 to-transparent blur-[120px] rounded-full" />
        <div className="absolute top-1/2 -right-40 w-[400px] h-[400px] bg-pink-600/10 blur-[130px] rounded-full" />
        <div className="absolute bottom-10 -left-40 w-[450px] h-[450px] bg-indigo-600/10 blur-[140px] rounded-full" />
      </div>

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-2xl mx-auto px-4 py-6 sm:py-8 flex-1 flex flex-col space-y-6">
        {/* Header / Brand Lockup */}
        <header className="flex flex-col items-center text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 shadow-xl shadow-fuchsia-500/25 ring-4 ring-purple-500/10">
            <Mic2 className="w-8 h-8 text-white filter drop-shadow" />
          </div>

          <div className="space-y-1">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-purple-200 via-pink-300 to-fuchsia-400 bg-clip-text text-transparent">
              Mounira
            </h1>
            <p className="text-sm sm:text-base font-medium text-purple-200/90 tracking-wide">
              Change ta voix en un clic
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-purple-300/70 pt-1">
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-pink-400" /> Web Audio API
            </span>
            <span aria-hidden="true">·</span>
            <span>100% dans le navigateur</span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" /> Sans compte ni clé API
            </span>
          </div>
        </header>

        {/* Live / Playback Waveform Visualizer */}
        <section aria-label="Visualisation de la forme d'onde">
          <WaveformVisualizer
            isRecording={isRecording}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            analyserNode={isRecording ? micAnalyserRef.current : playerAnalyserRef.current}
            audioBuffer={processedBuffer || originalBuffer}
            onSeek={handleSeek}
          />
        </section>

        {/* Step 1: Voice Input (Microphone or File Import) */}
        <section aria-label="Capture et importation audio">
          <AudioSourceSelector
            isRecording={isRecording}
            recordingDuration={recordingDuration}
            onStartRecording={startRecording}
            onStartSimulatedRecording={startSimulatedRecording}
            onStopRecording={stopRecording}
            onAudioFileLoaded={handleAudioFileLoaded}
            onLoadSyntheticSample={handleLoadSyntheticSample}
            errorMessage={micErrorMessage}
            onClearError={() => setMicErrorMessage(null)}
            hasAudio={!!originalBuffer}
          />
        </section>

        {/* Step 2: Voice Effect Selection & Intensity Slider */}
        <section aria-label="Sélection des effets de voix">
          <EffectSelector
            selectedEffect={activeEffect}
            intensity={intensity}
            onSelectEffect={handleSelectEffect}
            onChangeIntensity={setIntensity}
            disabled={isRecording}
          />
        </section>

        {/* Step 3: Audio Playback & Fast WAV Download */}
        <section aria-label="Lecture et téléchargement">
          <AudioPlayerControls
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            isProcessing={isProcessingEffect}
            hasAudio={!!(processedBuffer || originalBuffer)}
            onTogglePlay={togglePlay}
            onSeek={handleSeek}
            onDownload={handleDownload}
            onReset={handleReset}
          />
        </section>

        {/* Tips & Instructions Card */}
        <footer className="pt-4 border-t border-purple-500/10 text-center text-xs text-slate-400 space-y-1.5">
          <p className="flex items-center justify-center gap-1.5 text-purple-300/80 font-medium">
            <Wand2 className="w-3.5 h-3.5 text-pink-400" />
            Conseil : Parle distinctement pendant 3 à 5 secondes pour un résultat optimal.
          </p>
          <p className="text-slate-500">
            Mounira traite tous les flux audio directement dans ton navigateur. Aucune donnée n'est envoyée vers un serveur.
          </p>
        </footer>
      </div>
    </div>
  );
}
