export interface EQBand {
  id: number;
  type: "highpass" | "lowpass" | "bell" | "notch" | "highshelf" | "lowshelf";
  freq: number;
  q: number;
  gain: number;
}

export interface EQSettings {
  enabled: boolean;
  bands: EQBand[];
}

export interface CompressorBand {
  enabled: boolean;
  lowFreq: number;
  highFreq: number;
  thresh: number; // dB
  ratio: number;
  attack: number; // ms
  release: number; // ms
  gain: number; // dB makeup
}

export interface CompressorSettings {
  enabled: boolean;
  bands: CompressorBand[];
}

export interface LimiterSettings {
  enabled: boolean;
  threshold: number; // dB
  ceiling: number; // dB
  release: number; // ms
  lookahead: number; // seconds
}

export interface ImagerSettings {
  enabled: boolean;
  width: number; // 0.0 to 2.0 (1.0 = normal, >1.0 = wide, 0 = mono)
  pan: number; // -1.0 to 1.0
  midSideMode: boolean;
}

export interface SaturationSettings {
  enabled: boolean;
  type: "tube" | "tape" | "console";
  drive: number; // 0 to 100
  mix: number; // 0 to 100
  bias: number; // 0 to 10
}

export interface NoiseReductionSettings {
  enabled: boolean;
  threshold: number; // -100 to 0 dB
  reduction: number; // 0 to 30 dB
  type: "spectral" | "gate";
}

export interface HumanizeSettings {
  enabled: boolean;
  pitchVariation: number; // 0–100 (subtle vibrato depth)
  timingDrift: number;    // 0–100 (random micro-timing feel)
  breathNoise: number;    // 0–100 (air / breath layer)
  warmth: number;         // 0–100 (low-end body eq boost)
}

export interface MasteringChain {
  eq: EQSettings;
  compressor: CompressorSettings;
  limiter: LimiterSettings;
  imager: ImagerSettings;
  saturation: SaturationSettings;
  noiseReduction: NoiseReductionSettings;
  humanize: HumanizeSettings;
  targetLUFS: number;
}

export interface AudioAnalysis {
  estimatedGenre?: string;
  estimatedTempo?: number | string;
  dynamicRangeInfo?: string;
  frequencyProfile?: string;
  masteringNeeds?: string[];
  suggestedTargetLUFS?: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Project {
  id: string;
  user_id: string | null;
  name: string;
  original_file_name: string;
  original_file_size: number;
  original_file_type: string;
  state: "draft" | "mastering" | "completed" | "failed";
  master_settings: string | null; // JSON string of MasteringChain
  created_at: string;
}

export interface Preset {
  id: string;
  user_id: string | null;
  name: string;
  is_system: number; // 0 or 1
  category: "genre" | "target_platform" | "user";
  settings_json: string; // JSON string of MasteringChain
  created_at: string;
}

export interface UserSettings {
  theme: "dark" | "light";
  language: "id" | "en";
  target_lufs: number;
  default_export_format: "wav" | "mp3" | "flac" | "aac";
  shortcut_json: string | null;
  accentColor: string;
  fontScale: number;
}
