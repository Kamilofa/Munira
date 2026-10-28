export type EffectType =
  | 'none'
  | 'deep'
  | 'high'
  | 'robot'
  | 'echo'
  | 'monster'
  | 'squirrel';

export interface EffectConfig {
  id: EffectType;
  label: string;
  emoji: string;
  shortDesc: string;
  badge: string;
  defaultIntensity: number; // 0 to 100
  sliderLabel: string;
  formatIntensity: (val: number) => string;
}

export const VOICE_EFFECTS: EffectConfig[] = [
  {
    id: 'deep',
    label: 'Voix grave',
    emoji: '🐻',
    shortDesc: 'Tons chauds, profonds et caverneux',
    badge: 'Pitch bas',
    defaultIntensity: 65,
    sliderLabel: 'Profondeur de la voix',
    formatIntensity: (val: number) => {
      // Maps 0-100 to -1 to -9 semitones
      const semi = Math.round(-1 - (val / 100) * 8);
      return `${semi} demi-tons`;
    },
  },
  {
    id: 'high',
    label: 'Voix aiguë',
    emoji: '🕊️',
    shortDesc: 'Voix lumineuse, cristalline et aérienne',
    badge: 'Pitch haut',
    defaultIntensity: 60,
    sliderLabel: 'Hauteur de la voix',
    formatIntensity: (val: number) => {
      // Maps 0-100 to +1 to +8 semitones
      const semi = Math.round(1 + (val / 100) * 7);
      return `+${semi} demi-tons`;
    },
  },
  {
    id: 'robot',
    label: 'Robot',
    emoji: '🤖',
    shortDesc: 'Modulation en anneau métallique et résonance',
    badge: 'Cyborg',
    defaultIntensity: 50,
    sliderLabel: 'Fréquence de modulation',
    formatIntensity: (val: number) => {
      // 30Hz to 160Hz
      const freq = Math.round(30 + (val / 100) * 130);
      return `${freq} Hz`;
    },
  },
  {
    id: 'echo',
    label: 'Écho',
    emoji: '🌌',
    shortDesc: 'Réverbération spatiale cathédrale avec délai',
    badge: 'Spatial',
    defaultIntensity: 55,
    sliderLabel: 'Temps & retour d\'écho',
    formatIntensity: (val: number) => {
      const ms = Math.round(120 + (val / 100) * 380);
      return `${ms} ms`;
    },
  },
  {
    id: 'monster',
    label: 'Voix de monstre',
    emoji: '👹',
    shortDesc: 'Grave terrifiant, distorsion et grognement',
    badge: 'Démoniaque',
    defaultIntensity: 70,
    sliderLabel: 'Agressivité & résonance',
    formatIntensity: (val: number) => {
      return `${val}%`;
    },
  },
  {
    id: 'squirrel',
    label: 'Écureuil',
    emoji: '🐿️',
    shortDesc: 'Ultra-aigu, accéléré style cartoon chipmunk',
    badge: 'Chipmunk',
    defaultIntensity: 75,
    sliderLabel: 'Vitesse & tonalité',
    formatIntensity: (val: number) => {
      const rate = (1.2 + (val / 100) * 0.7).toFixed(2);
      return `${rate}x`;
    },
  },
];

export interface ProcessedAudioState {
  originalBuffer: AudioBuffer | null;
  processedBuffer: AudioBuffer | null;
  wavBlob: Blob | null;
  wavUrl: string | null;
  duration: number;
  fileName: string;
  isProcessing: boolean;
}
