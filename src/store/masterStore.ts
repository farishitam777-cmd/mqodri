import { create } from "zustand";
import { MasteringChain, Project, Preset, User, UserSettings, AudioAnalysis, EQBand, CompressorBand } from "../types";

// ponytail: session restore — load last chain from localStorage
const SAVED_CHAIN = localStorage.getItem('master_chain');
function loadSavedChain(): MasteringChain {
  try { return SAVED_CHAIN ? { ...DEFAULT_MASTERING_CHAIN, ...JSON.parse(SAVED_CHAIN), humanize: { ...DEFAULT_MASTERING_CHAIN.humanize, ...JSON.parse(SAVED_CHAIN || '{}').humanize } } : DEFAULT_MASTERING_CHAIN; }
  catch { return DEFAULT_MASTERING_CHAIN; }
}
function saveChain(c: MasteringChain) { localStorage.setItem('master_chain', JSON.stringify(c)); }

export const DEFAULT_MASTERING_CHAIN: MasteringChain = {
  eq: {
    enabled: true,
    bands: [
      { id: 1, type: "highpass", freq: 30, q: 0.7, gain: 0 },
      { id: 2, type: "bell", freq: 65, q: 1.0, gain: 0 },
      { id: 3, type: "bell", freq: 125, q: 1.0, gain: 0 },
      { id: 4, type: "bell", freq: 250, q: 1.0, gain: 0 },
      { id: 5, type: "bell", freq: 500, q: 1.0, gain: 0 },
      { id: 6, type: "bell", freq: 1000, q: 1.0, gain: 0 },
      { id: 7, type: "bell", freq: 2000, q: 1.0, gain: 0 },
      { id: 8, type: "bell", freq: 4000, q: 1.0, gain: 0 },
      { id: 9, type: "highshelf", freq: 12000, q: 0.7, gain: 0 },
      { id: 10, type: "lowpass", freq: 20000, q: 0.7, gain: 0 }
    ]
  },
  compressor: {
    enabled: false,
    bands: [
      { enabled: true, lowFreq: 20, highFreq: 120, thresh: -18, ratio: 2.0, attack: 50, release: 150, gain: 0 },
      { enabled: true, lowFreq: 120, highFreq: 500, thresh: -20, ratio: 2.0, attack: 30, release: 100, gain: 0 },
      { enabled: true, lowFreq: 500, highFreq: 2500, thresh: -20, ratio: 2.0, attack: 25, release: 80, gain: 0 },
      { enabled: true, lowFreq: 2500, highFreq: 8000, thresh: -22, ratio: 2.0, attack: 20, release: 70, gain: 0 },
      { enabled: true, lowFreq: 8000, highFreq: 20000, thresh: -20, ratio: 1.8, attack: 15, release: 60, gain: 0 }
    ]
  },
  limiter: {
    enabled: false,
    threshold: -3.0,
    ceiling: -0.3,
    release: 150,
    lookahead: 0.005
  },
  imager: {
    enabled: false,
    width: 1.0,
    pan: 0,
    midSideMode: false
  },
  saturation: {
    enabled: false,
    type: "tape",
    drive: 10,
    mix: 20,
    bias: 5
  },
  noiseReduction: {
    enabled: false,
    threshold: -60,
    reduction: 10,
    type: "spectral"
  },
  humanize: {
    enabled: false,
    pitchVariation: 30,
    timingDrift: 20,
    breathNoise: 10,
    warmth: 40
  },
  targetLUFS: -14.0
};

interface MasterStore {
  // Auth state
  token: string | null;
  user: User | null;
  setAuth: (token: string | null, user: User | null) => void;

  // Workspace state
  projects: Project[];
  activeProject: Project | null;
  presets: Preset[];
  userSettings: UserSettings;
  audioFile: File | null;
  audioUrl: string | null;
  audioBuffer: AudioBuffer | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  zoom: number;
  loop: boolean;
  isLoadingAudio: boolean;
  analysis: AudioAnalysis | null;
  aiCritique: any;
  isCritiquing: boolean;
  activePresetName: string | null;
  userGenre: string;
  userIntent: string;

  // Master Chain State
  chain: MasteringChain;
  undoStack: MasteringChain[];
  redoStack: MasteringChain[];

  // Real-time analysis metrics
  meters: {
    lufsIntegrated: number;
    lufsShort: number;
    lufsMomentary: number;
    truePeakLeft: number;
    truePeakRight: number;
    rmsLeft: number;
    rmsRight: number;
    correlation: number;
    gainReduction: number[];
  };

  // Functions & Actions
  setProjects: (projects: Project[]) => void;
  setActiveProject: (project: Project | null) => void;
  setPresets: (presets: Preset[]) => void;
  setUserSettings: (settings: UserSettings) => void;
  setAudioFile: (file: File | null, url: string | null, buffer: AudioBuffer | null) => void;
  setPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setZoom: (zoom: number) => void;
  setLoop: (loop: boolean) => void;
  setIsLoadingAudio: (loading: boolean) => void;
  setAnalysis: (analysis: AudioAnalysis | null) => void;
  setAiCritique: (critique: any) => void;
  setIsCritiquing: (critiquing: boolean) => void;
  setActivePresetName: (name: string | null) => void;
  setUserGenre: (genre: string) => void;
  setUserIntent: (intent: string) => void;

  // Master Bypass
  masterBypass: boolean;
  setMasterBypass: (bypass: boolean) => void;

  // Chain actions
  updateChain: (updater: (prev: MasteringChain) => Partial<MasteringChain> | MasteringChain) => void;
  updateEQBand: (bandId: number, changes: Partial<EQBand>) => void;
  updateCompressorBand: (index: number, changes: Partial<CompressorBand>) => void;
  loadPreset: (presetChain: MasteringChain, presetName?: string) => void;
  
  // History Undo/Redo
  pushHistoryState: (prevState: MasteringChain) => void;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;

  // Meter updates
  updateMeters: (metrics: Partial<MasterStore["meters"]>) => void;

}

export const useMasterStore = create<MasterStore>((set, get) => ({
  // Auth state
  token: localStorage.getItem("token"),
  user: localStorage.getItem("user") ? JSON.parse(localStorage.getItem("user")!) : null,
  setAuth: (token, user) => {
    if (token) localStorage.setItem("token", token);
    else localStorage.removeItem("token");

    if (user) localStorage.setItem("user", JSON.stringify(user));
    else localStorage.removeItem("user");

    set({ token, user });
  },

  // Workspace state
  projects: [],
  activeProject: null,
  presets: [],
  userSettings: {
    theme: "dark",
    language: "id",
    target_lufs: -14.0,
    default_export_format: "wav",
    shortcut_json: null,
    accentColor: "#3b82f6",
    fontScale: 100
  },
  audioFile: null,
  audioUrl: null,
  audioBuffer: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  zoom: 10,
  loop: false,
  isLoadingAudio: false,
  analysis: null,
  aiCritique: null,
  isCritiquing: false,
  activePresetName: null,
  userGenre: "",
  userIntent: "",

  // Chain state — ponytail: restore from localStorage
  chain: loadSavedChain(),
  undoStack: [],
  redoStack: [],
  masterBypass: false,

  // Metering values
  meters: {
    lufsIntegrated: -70,
    lufsShort: -70,
    lufsMomentary: -70,
    truePeakLeft: -100,
    truePeakRight: -100,
    rmsLeft: -100,
    rmsRight: -100,
    correlation: 1.0,
    gainReduction: [0, 0, 0, 0, 0]
  },

  // Setters
  setProjects: (projects) => set({ projects }),
  setActiveProject: (activeProject) => {
    if (activeProject && activeProject.master_settings) {
      try {
        const parsedChain = JSON.parse(activeProject.master_settings);
        const merged = { ...DEFAULT_MASTERING_CHAIN, ...parsedChain, humanize: { ...DEFAULT_MASTERING_CHAIN.humanize, ...parsedChain.humanize } };
        saveChain(merged);
        set({ activeProject, chain: merged, undoStack: [], redoStack: [] });
      } catch (err) {
        set({ activeProject, chain: { ...DEFAULT_MASTERING_CHAIN }, undoStack: [], redoStack: [] });
      }
    } else {
      set({ activeProject, chain: { ...DEFAULT_MASTERING_CHAIN }, undoStack: [], redoStack: [] });
    }
  },
  setPresets: (presets) => set({ presets }),
  setUserSettings: (userSettings) => set({ userSettings }),
  setAudioFile: (audioFile, audioUrl, audioBuffer) => set({ 
    audioFile, 
    audioUrl, 
    audioBuffer,
    isPlaying: false,
    currentTime: 0,
    duration: audioBuffer ? audioBuffer.duration : 0
  }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
  setZoom: (zoom) => set({ zoom }),
  setLoop: (loop) => set({ loop }),
  setIsLoadingAudio: (isLoadingAudio) => set({ isLoadingAudio }),
  setAnalysis: (analysis) => set({ analysis }),
  setAiCritique: (aiCritique) => set({ aiCritique }),
  setIsCritiquing: (isCritiquing) => set({ isCritiquing }),
  setActivePresetName: (activePresetName) => set({ activePresetName }),
  setUserGenre: (userGenre) => set({ userGenre }),
  setUserIntent: (userIntent) => set({ userIntent }),
  setMasterBypass: (masterBypass) => set({ masterBypass }),

  // Chain modifiers
  updateChain: (updater) => {
    const currentChain = get().chain;
    const updateResult = updater(currentChain);
    
    get().pushHistoryState(currentChain);

    const nextChain = { ...currentChain, ...updateResult };
    if (updateResult.humanize && currentChain.humanize) {
      nextChain.humanize = { ...currentChain.humanize, ...updateResult.humanize };
    }
    saveChain(nextChain);
    set({ chain: nextChain, redoStack: [] });
  },

  updateEQBand: (bandId, changes) => {
    const currentChain = get().chain;
    get().pushHistoryState(currentChain);

    const nextBands = currentChain.eq.bands.map(b => 
      b.id === bandId ? { ...b, ...changes } : b
    );

    const nextChain = { ...currentChain, eq: { ...currentChain.eq, bands: nextBands } };
    saveChain(nextChain);
    set({ chain: nextChain, redoStack: [] });
  },

  updateCompressorBand: (index, changes) => {
    const currentChain = get().chain;
    get().pushHistoryState(currentChain);

    const nextBands = [...currentChain.compressor.bands];
    nextBands[index] = { ...nextBands[index], ...changes };

    const nextChain = { ...currentChain, compressor: { ...currentChain.compressor, bands: nextBands } };
    saveChain(nextChain);
    set({ chain: nextChain, redoStack: [] });
  },

  loadPreset: (presetChain, presetName) => {
    const currentChain = get().chain;
    get().pushHistoryState(currentChain);
    const merged = { ...DEFAULT_MASTERING_CHAIN, ...presetChain, humanize: { ...DEFAULT_MASTERING_CHAIN.humanize, ...presetChain.humanize } };
    saveChain(merged);
    set({ chain: merged, redoStack: [], activePresetName: presetName || null });
  },

  // History system
  pushHistoryState: (prevState) => {
    const stack = [...get().undoStack];
    // Keep stack within reasonable boundary to prevent out of memory
    if (stack.length >= 30) {
      stack.shift();
    }
    set({ undoStack: [...stack, JSON.parse(JSON.stringify(prevState))] });
  },

  undo: () => {
    const undoStack = [...get().undoStack];
    if (undoStack.length === 0) return;

    const previousState = undoStack.pop()!;
    const currentState = get().chain;

    set({
      chain: previousState,
      undoStack,
      redoStack: [...get().redoStack, JSON.parse(JSON.stringify(currentState))]
    });
  },

  redo: () => {
    const redoStack = [...get().redoStack];
    if (redoStack.length === 0) return;

    const nextState = redoStack.pop()!;
    const currentState = get().chain;

    set({
      chain: nextState,
      redoStack,
      undoStack: [...get().undoStack, JSON.parse(JSON.stringify(currentState))]
    });
  },

  clearHistory: () => set({ undoStack: [], redoStack: [] }),

  // Meter modifiers
  updateMeters: (metrics) => set((state) => ({
    meters: { ...state.meters, ...metrics }
  })),

}));
