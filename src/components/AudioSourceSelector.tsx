import React, { useRef, useState } from 'react';
import { Mic, Square, Upload, Music, AlertCircle, RefreshCw } from 'lucide-react';

interface AudioSourceSelectorProps {
  isRecording: boolean;
  recordingDuration: number;
  onStartRecording: () => void;
  onStartSimulatedRecording: () => void;
  onStopRecording: () => void;
  onAudioFileLoaded: (buffer: AudioBuffer, fileName: string) => void;
  onLoadSyntheticSample: () => void;
  errorMessage: string | null;
  onClearError: () => void;
  hasAudio: boolean;
}

export const AudioSourceSelector: React.FC<AudioSourceSelectorProps> = ({
  isRecording,
  recordingDuration,
  onStartRecording,
  onStartSimulatedRecording,
  onStopRecording,
  onAudioFileLoaded,
  onLoadSyntheticSample,
  errorMessage,
  onClearError,
  hasAudio,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isFileLoading, setIsFileLoading] = useState(false);

  const handleFileChange = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    setIsFileLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      onAudioFileLoaded(decodedBuffer, file.name);
    } catch {
      alert("Impossible de lire ce fichier audio. Assure-toi qu'il s'agit d'un format valide (MP3, WAV, AAC, M4A, OGG).");
    } finally {
      setIsFileLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFileChange(e.dataTransfer.files);
    }
  };

  return (
    <div className="space-y-3">
      {/* Error Banner if mic or file had an issue */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-950/90 to-red-950/80 border border-rose-500/60 text-rose-100 text-xs shadow-xl animate-in fade-in duration-200 space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="font-bold text-sm text-white">Autorisation du microphone requise</p>
              <p className="leading-relaxed text-rose-200/90">{errorMessage}</p>
            </div>
            <button
              type="button"
              onClick={onClearError}
              className="text-rose-400 hover:text-white p-1 rounded-lg hover:bg-rose-900/50 transition-colors"
              title="Fermer"
            >
              ✕
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-rose-500/20">
            <button
              type="button"
              onClick={onStartRecording}
              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Réessayer le micro</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClearError();
                onStartSimulatedRecording();
              }}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Tester l'enregistrement démo</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClearError();
                onLoadSyntheticSample();
              }}
              className="px-3 py-2 rounded-xl bg-purple-900/60 hover:bg-purple-800/80 text-fuchsia-200 border border-purple-500/30 font-medium text-xs flex items-center gap-1.5 transition-all active:scale-95"
            >
              <Music className="w-3.5 h-3.5 text-pink-400" />
              <span>Charger l'extrait démo</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-medium text-xs flex items-center gap-1.5 transition-all"
            >
              <Upload className="w-3.5 h-3.5 text-slate-400" />
              <span>Importer un fichier</span>
            </button>
          </div>
        </div>
      )}

      {/* Recording & Input Card */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative overflow-hidden rounded-3xl p-5 border transition-all duration-300 ${
          isRecording
            ? 'bg-gradient-to-b from-[#240e28] to-[#140b22] border-rose-500 shadow-xl shadow-rose-950/40 ring-1 ring-rose-400/50'
            : isDragging
            ? 'bg-purple-950/50 border-pink-400 ring-2 ring-pink-500/50'
            : 'bg-gradient-to-b from-[#181136]/90 to-[#100a20]/90 border-purple-500/20 shadow-xl'
        }`}
      >
        <div className="flex flex-col items-center text-center space-y-4">
          {/* Main Record / Stop Action Button */}
          {isRecording ? (
            <div className="flex flex-col items-center space-y-3">
              <div className="relative">
                <div className="absolute -inset-3 rounded-full bg-rose-500/20 animate-ping pointer-events-none" />
                <button
                  type="button"
                  onClick={onStopRecording}
                  className="relative h-20 w-20 rounded-full bg-gradient-to-tr from-rose-600 to-pink-500 hover:from-rose-500 hover:to-pink-400 text-white shadow-lg shadow-rose-600/50 flex items-center justify-center transition-transform active:scale-95"
                >
                  <Square className="w-8 h-8 fill-current" />
                </button>
              </div>

              <div className="space-y-0.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-rose-400">
                  Enregistrement en cours...
                </span>
                <p className="font-mono text-2xl font-bold text-white tabular-nums">
                  {formatDuration(recordingDuration)}
                </p>
                <p className="text-xs text-slate-400">
                  Appuie sur le carré pour terminer
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-3">
              <button
                type="button"
                onClick={onStartRecording}
                className="group relative h-20 w-20 rounded-full bg-gradient-to-tr from-purple-600 via-fuchsia-600 to-pink-500 hover:from-purple-500 hover:via-fuchsia-500 hover:to-pink-400 text-white shadow-xl shadow-fuchsia-600/30 flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 ring-4 ring-purple-500/20"
              >
                <Mic className="w-9 h-9 transition-transform group-hover:scale-110" />
              </button>

              <div className="space-y-0.5">
                <h3 className="text-base font-bold text-white tracking-tight">
                  {hasAudio ? 'Enregistrer une nouvelle voix' : 'Enregistrer ma voix'}
                </h3>
                <p className="text-xs text-purple-200/70">
                  Parle dans ton micro pendant quelques secondes
                </p>
              </div>
            </div>
          )}

          {/* Secondary Actions: File Import & Quick Demo Sample */}
          {!isRecording && (
            <div className="w-full pt-3 border-t border-purple-500/10 flex flex-col sm:flex-row items-center justify-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={(e) => handleFileChange(e.target.files)}
                className="hidden"
              />

              <button
                type="button"
                disabled={isFileLoading}
                onClick={() => fileInputRef.current?.click()}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-purple-900/30 hover:bg-purple-900/50 text-purple-200 hover:text-white border border-purple-500/20 text-xs font-semibold flex items-center justify-center gap-2 transition-colors active:scale-98"
              >
                {isFileLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5 text-pink-400" />
                )}
                <span>Importer un fichier audio</span>
              </button>

              <button
                type="button"
                onClick={onLoadSyntheticSample}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-pink-950/30 hover:bg-pink-950/50 text-pink-200 hover:text-white border border-pink-500/20 text-xs font-semibold flex items-center justify-center gap-2 transition-colors active:scale-98"
              >
                <Music className="w-3.5 h-3.5 text-fuchsia-400" />
                <span>Tester un exemple vocal</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function formatDuration(sec: number): string {
  if (isNaN(sec) || sec < 0) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
