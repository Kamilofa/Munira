import React from 'react';
import { EffectType, VOICE_EFFECTS } from '../audio/types';
import { Sparkles, SlidersHorizontal, RotateCcw } from 'lucide-react';

interface EffectSelectorProps {
  selectedEffect: EffectType;
  intensity: number;
  onSelectEffect: (effect: EffectType) => void;
  onChangeIntensity: (val: number) => void;
  disabled?: boolean;
}

export const EffectSelector: React.FC<EffectSelectorProps> = ({
  selectedEffect,
  intensity,
  onSelectEffect,
  onChangeIntensity,
  disabled = false,
}) => {
  const activeEffectConfig = VOICE_EFFECTS.find((e) => e.id === selectedEffect);

  const handleResetIntensity = () => {
    if (activeEffectConfig) {
      onChangeIntensity(activeEffectConfig.defaultIntensity);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-fuchsia-400" />
          Choisis ton effet vocal
        </label>
        <span className="text-xs text-purple-300/70">
          {VOICE_EFFECTS.length} effets disponibles
        </span>
      </div>

      {/* Grid of 6 effects */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {VOICE_EFFECTS.map((effect) => {
          const isSelected = selectedEffect === effect.id;

          return (
            <button
              key={effect.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectEffect(effect.id)}
              className={`group relative text-left p-3.5 rounded-2xl transition-all duration-200 border min-h-[96px] flex flex-col justify-between ${
                disabled
                  ? 'opacity-50 cursor-not-allowed bg-slate-900/40 border-slate-800'
                  : isSelected
                  ? 'bg-gradient-to-br from-purple-900/60 to-pink-900/50 border-fuchsia-500 shadow-lg shadow-fuchsia-500/20 ring-1 ring-fuchsia-400/50 scale-[1.02]'
                  : 'bg-[#150f2a]/70 hover:bg-[#1c1438] border-purple-500/15 hover:border-purple-400/40 active:scale-[0.98]'
              }`}
            >
              <div className="flex items-start justify-between">
                <span className="text-2xl filter drop-shadow-sm transition-transform duration-200 group-hover:scale-110">
                  {effect.emoji}
                </span>
                {isSelected && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-fuchsia-500 text-white shadow-sm">
                    Actif
                  </span>
                )}
              </div>

              <div>
                <h4 className="text-sm font-bold text-white tracking-tight">
                  {effect.label}
                </h4>
                <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                  {effect.shortDesc}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Intensity Slider Section */}
      {activeEffectConfig && (
        <div className="p-4 rounded-2xl bg-gradient-to-br from-[#181133] to-[#120d26] border border-purple-500/20 shadow-md space-y-3">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-slate-300 font-medium">
              <SlidersHorizontal className="w-3.5 h-3.5 text-pink-400" />
              <span>{activeEffectConfig.sliderLabel}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-fuchsia-300 bg-fuchsia-950/60 border border-fuchsia-500/30 px-2 py-0.5 rounded text-xs tabular-nums">
                {activeEffectConfig.formatIntensity(intensity)}
              </span>
              <button
                type="button"
                onClick={handleResetIntensity}
                title="Réinitialiser l'intensité"
                className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <input
              type="range"
              min="0"
              max="100"
              value={intensity}
              disabled={disabled}
              onChange={(e) => onChangeIntensity(Number(e.target.value))}
              className="w-full h-2 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 px-0.5">
              <span>Doux</span>
              <span>Équilibré (Défaut)</span>
              <span>Intense</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
