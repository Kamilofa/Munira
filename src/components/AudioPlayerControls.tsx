import React from 'react';
import { Play, Pause, Download, RotateCcw, Volume2, Sparkles } from 'lucide-react';

interface AudioPlayerControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isProcessing: boolean;
  hasAudio: boolean;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onDownload: () => void;
  onReset: () => void;
}

export const AudioPlayerControls: React.FC<AudioPlayerControlsProps> = ({
  isPlaying,
  currentTime,
  duration,
  isProcessing,
  hasAudio,
  onTogglePlay,
  onSeek,
  onDownload,
  onReset,
}) => {
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    onSeek((val / 100) * duration);
  };

  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#191136]/90 to-[#120d26]/90 border border-purple-500/25 p-4 shadow-xl backdrop-blur-md space-y-4">
      {/* Intuitive Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-mono text-purple-200/80 tabular-nums">
          <span className="flex items-center gap-1.5 font-medium text-slate-200">
            <Volume2 className="w-3.5 h-3.5 text-pink-400" />
            {formatDuration(currentTime)}
          </span>
          <span className="text-slate-400">{formatDuration(duration)}</span>
        </div>

        <div className="relative flex items-center group">
          <input
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={isNaN(progressPercent) ? 0 : progressPercent}
            disabled={!hasAudio || isProcessing}
            onChange={handleSliderChange}
            className="w-full h-2 rounded-full cursor-pointer"
          />
        </div>
      </div>

      {/* Main Buttons Row: Play/Pause, Download, Reset */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Play/Listen Button */}
        <button
          type="button"
          disabled={!hasAudio || isProcessing}
          onClick={onTogglePlay}
          className={`flex-1 min-h-[48px] px-5 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2.5 transition-all shadow-lg active:scale-[0.98] ${
            !hasAudio || isProcessing
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
              : isPlaying
              ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/30 ring-2 ring-rose-400'
              : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-purple-600/30'
          }`}
        >
          {isProcessing ? (
            <>
              <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Traitement de l'effet...</span>
            </>
          ) : isPlaying ? (
            <>
              <Pause className="w-5 h-5 fill-current" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="w-5 h-5 fill-current ml-0.5" />
              <span>Écouter le résultat</span>
            </>
          )}
        </button>

        {/* Quick Download WAV Button */}
        <button
          type="button"
          disabled={!hasAudio || isProcessing}
          onClick={onDownload}
          title="Télécharger le fichier audio modifié au format WAV"
          className={`min-h-[48px] px-5 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
            !hasAudio || isProcessing
              ? 'bg-slate-800/60 text-slate-500 cursor-not-allowed border border-slate-800'
              : 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 hover:border-emerald-500/50 shadow-md shadow-emerald-950/40'
          }`}
        >
          <Download className="w-4 h-4" />
          <span>Télécharger .wav</span>
        </button>

        {/* Recommencer / Reset */}
        <button
          type="button"
          disabled={!hasAudio}
          onClick={onReset}
          title="Nouvel enregistrement"
          className="min-h-[48px] px-3.5 py-3 rounded-xl font-medium text-xs text-slate-400 hover:text-slate-200 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="sm:inline">Recommencer</span>
        </button>
      </div>

      {hasAudio && (
        <div className="flex items-center justify-center gap-2 text-xs text-fuchsia-300/80 pt-1">
          <Sparkles className="w-3 h-3 text-pink-400" />
          <span>Fichier prêt au format PCM WAV haute fidélité (sans perte)</span>
        </div>
      )}
    </div>
  );
};

function formatDuration(sec: number): string {
  if (isNaN(sec) || sec < 0) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
