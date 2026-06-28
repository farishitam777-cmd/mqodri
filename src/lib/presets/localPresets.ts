import { MasteringChain } from "../../types";

export interface LocalPreset {
  id: string;
  name: string;
  group: string;
  chain: MasteringChain;
}

const defHumanize = { enabled: false, pitchVariation: 30, timingDrift: 20, breathNoise: 10, warmth: 40 };

const base: MasteringChain = {
  eq: { enabled: true, bands: [
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
  ]},
  compressor: { enabled: false, bands: [
    { enabled: true, lowFreq: 20, highFreq: 120, thresh: -18, ratio: 2, attack: 50, release: 150, gain: 0 },
    { enabled: true, lowFreq: 120, highFreq: 500, thresh: -20, ratio: 2, attack: 30, release: 100, gain: 0 },
    { enabled: true, lowFreq: 500, highFreq: 2500, thresh: -20, ratio: 2, attack: 25, release: 80, gain: 0 },
    { enabled: true, lowFreq: 2500, highFreq: 8000, thresh: -22, ratio: 2, attack: 20, release: 70, gain: 0 },
    { enabled: true, lowFreq: 8000, highFreq: 20000, thresh: -20, ratio: 1.8, attack: 15, release: 60, gain: 0 }
  ]},
  limiter: { enabled: true, threshold: -3, ceiling: -0.3, release: 150, lookahead: 0.005 },
  imager: { enabled: false, width: 1, pan: 0, midSideMode: false },
  saturation: { enabled: false, type: "tape", drive: 10, mix: 20, bias: 5 },
  noiseReduction: { enabled: false, threshold: -60, reduction: 10, type: "spectral" },
  humanize: defHumanize,
  targetLUFS: -14
};

function clone(c: MasteringChain): MasteringChain {
  return JSON.parse(JSON.stringify(c));
}

function updateEq(c: MasteringChain, gains: number[], types?: string[], freqs?: number[], qs?: number[]): MasteringChain {
  const n = clone(c);
  n.eq.bands = n.eq.bands.map((b, i) => ({
    ...b,
    gain: gains[i] ?? b.gain,
    type: (types?.[i] ?? b.type) as any,
    freq: freqs?.[i] ?? b.freq,
    q: qs?.[i] ?? b.q,
  }));
  n.eq.enabled = true;
  return n;
}

function setComp(c: MasteringChain, enabled: boolean, bands: Partial<typeof c.compressor.bands[0]>[]): MasteringChain {
  const n = clone(c);
  n.compressor.enabled = enabled;
  n.compressor.bands = n.compressor.bands.map((b, i) => ({ ...b, ...bands[i] }));
  return n;
}

function setSat(c: MasteringChain, enabled: boolean, type: "tube" | "tape" | "console", drive: number, mix: number, bias?: number): MasteringChain {
  const n = clone(c);
  n.saturation = { enabled, type, drive, mix, bias: bias ?? 5 };
  return n;
}

function setLim(c: MasteringChain, enabled: boolean, threshold: number, ceiling: number, release: number): MasteringChain {
  const n = clone(c);
  n.limiter = { ...n.limiter, enabled, threshold, ceiling, release };
  return n;
}

function setImg(c: MasteringChain, enabled: boolean, width: number): MasteringChain {
  const n = clone(c);
  n.imager = { ...n.imager, enabled, width };
  return n;
}

const presets: LocalPreset[] = [
  // ═══════════════════════════════════
  // GLOBAL / UNIVERSAL
  // ═══════════════════════════════════
  {
    id: "global_clean", name: "Clean & Transparent", group: "Global",
    chain: (() => {
      const n = clone(base);
      n.limiter = { enabled: true, threshold: -6, ceiling: -0.5, release: 120, lookahead: 0.005 };
      n.eq.enabled = false;
      n.saturation.enabled = false;
      return n;
    })()
  },
  {
    id: "global_warm", name: "Warm Analog", group: "Global",
    chain: (() => {
      const n = updateEq(base, [0, 1.5, 1, 0.5, 0, -0.5, 0.5, 1, 1.5, 0]);
      n.limiter = { enabled: true, threshold: -4, ceiling: -0.5, release: 180, lookahead: 0.005 };
      n.saturation = { enabled: true, type: "tube", drive: 25, mix: 30, bias: 4 };
      return n;
    })()
  },
  {
    id: "global_loud", name: "Modern Loud", group: "Global",
    chain: (() => {
      const n = updateEq(base, [0, -0.5, 0, 0, 0, 0.5, 1, 1.5, 2, 0]);
      n.compressor = { enabled: true, bands: n.compressor.bands.map((b, i) => ({
        ...b,
        thresh: [-12, -14, -16, -18, -18][i],
        ratio: [2.5, 3, 3.5, 3, 2.5][i],
        attack: [30, 20, 15, 12, 10][i],
        release: [100, 80, 60, 50, 40][i],
        gain: [1, 1.5, 2, 2, 1.5][i],
      }))};
      n.limiter = { enabled: true, threshold: -2, ceiling: -0.3, release: 80, lookahead: 0.005 };
      return n;
    })()
  },
  {
    id: "global_broadcast", name: "Dynamic Broadcast", group: "Global",
    chain: (() => {
      const n = updateEq(base, [0, 0, -0.5, -0.5, 0, 0.5, 1, 1, 0.5, 0]);
      n.compressor = { enabled: true, bands: n.compressor.bands.map((b, i) => ({
        ...b,
        thresh: [-14, -16, -18, -20, -18][i],
        ratio: [2, 2.5, 3, 3, 2][i],
        attack: [40, 30, 20, 15, 15][i],
        release: [120, 100, 80, 60, 50][i],
        gain: [0, 0.5, 1, 1, 0.5][i],
      }))};
      n.limiter = { enabled: true, threshold: -4, ceiling: -0.5, release: 120, lookahead: 0.005 };
      n.targetLUFS = -16;
      return n;
    })()
  },

  // ═══════════════════════════════════
  // POP
  // ═══════════════════════════════════
  {
    id: "pop_radio", name: "Pop Radio", group: "Pop",
    chain: (() => {
      const n = updateEq(base, [0, -1, -0.5, 0, 0.5, 1, 1.5, 2, 2.5, 0], undefined, undefined, [0.7, 1, 1, 1, 1, 1, 1, 1.2, 0.7, 0.7]);
      n.compressor = { enabled: true, bands: n.compressor.bands.map((b, i) => ({
        ...b, thresh: [-10, -12, -14, -16, -16][i], ratio: [2, 2.5, 3, 3, 2.5][i],
        attack: [30, 25, 20, 15, 12][i], release: [100, 80, 60, 50, 40][i],
        gain: [1, 1.5, 2, 2, 1.5][i],
      }))};
      n.limiter = { enabled: true, threshold: -2.5, ceiling: -0.3, release: 100, lookahead: 0.005 };
      n.saturation = { enabled: true, type: "tape", drive: 15, mix: 25, bias: 3 };
      return n;
    })()
  },
  {
    id: "pop_modern", name: "Modern Pop", group: "Pop",
    chain: (() => {
      const n = updateEq(base, [0, 2, 1, 0, 0, 0.5, 1, 2, 3, 0], undefined, [20, 55, 110, 250, 500, 1000, 2400, 5000, 14000, 20000], [0.7, 0.8, 0.8, 1, 1, 1, 1, 1.2, 0.7, 0.7]);
      n.compressor = { enabled: true, bands: n.compressor.bands.map((b, i) => ({
        ...b, thresh: [-8, -10, -12, -14, -14][i], ratio: [2.5, 3, 3.5, 3.5, 3][i],
        attack: [25, 20, 15, 12, 10][i], release: [80, 60, 50, 40, 35][i],
        gain: [1.5, 2, 2.5, 2.5, 2][i],
      }))};
      n.limiter = { enabled: true, threshold: -1.5, ceiling: -0.2, release: 60, lookahead: 0.005 };
      n.saturation = { enabled: true, type: "tube", drive: 20, mix: 35, bias: 3 };
      n.imager = { enabled: true, width: 1.25, pan: 0, midSideMode: false };
      n.targetLUFS = -9;
      return n;
    })()
  },
  {
    id: "pop_synth", name: "Synth Pop", group: "Pop",
    chain: (() => {
      const n = updateEq(base, [0, 1.5, 1, 0, -0.5, 0, 1, 2.5, 3, 0], undefined, [20, 60, 120, 300, 600, 1200, 2800, 6000, 16000, 20000]);
      n.compressor = { enabled: true, bands: n.compressor.bands.map((b, i) => ({
        ...b, thresh: [-10, -12, -14, -16, -18][i], ratio: [2, 2.5, 3, 3.5, 3][i],
        attack: [35, 25, 20, 15, 12][i], release: [100, 80, 60, 50, 40][i],
        gain: [1, 1.5, 2, 2.5, 2][i],
      }))};
      n.limiter = { enabled: true, threshold: -2, ceiling: -0.3, release: 80, lookahead: 0.005 };
      n.saturation = { enabled: true, type: "tape", drive: 10, mix: 30, bias: 5 };
      n.imager = { enabled: true, width: 1.4, pan: 0, midSideMode: false };
      n.targetLUFS = -10;
      return n;
    })()
  },
  {
    id: "pop_indie", name: "Indie Pop", group: "Pop",
    chain: (() => {
      const n = updateEq(base, [0, 0.5, 1, 1, 0.5, 0, 0.5, 1.5, 1, 0], undefined, undefined, [0.7, 0.8, 0.8, 1, 1, 1, 1, 1, 0.7, 0.7]);
      n.compressor = { enabled: true, bands: n.compressor.bands.map((b, i) => ({
        ...b, thresh: [-14, -16, -18, -20, -18][i], ratio: [2, 2, 2.5, 2.5, 2][i],
        attack: [40, 30, 25, 20, 15][i], release: [120, 100, 80, 70, 60][i],
        gain: [0, 0.5, 1, 1, 0.5][i],
      }))};
      n.limiter = { enabled: true, threshold: -4, ceiling: -0.5, release: 150, lookahead: 0.005 };
      n.saturation = { enabled: true, type: "tube", drive: 30, mix: 25, bias: 4 };
      n.targetLUFS = -13;
      return n;
    })()
  },

  // ═══════════════════════════════════
  // ROCK
  // ═══════════════════════════════════
  {
    id: "rock_classic", name: "Classic Rock", group: "Rock",
    chain: (() => {
      const n = updateEq(base, [0, 0, 0.5, 1.5, 2, 1.5, 1, 0.5, 0, 0], undefined, [30, 80, 200, 400, 800, 2000, 4000, 8000, 12000, 20000], [0.7, 1, 1.2, 1.5, 1.5, 1.2, 1, 1, 0.7, 0.7]);
      n.compressor = { enabled: true, bands: n.compressor.bands.map((b, i) => ({
        ...b, thresh: [-16, -18, -20, -22, -20][i], ratio: [2, 2.5, 3, 3, 2][i],
        attack: [40, 30, 25, 20, 15][i], release: [150, 120, 100, 80, 60][i],
        gain: [0, 0.5, 1.5, 1.5, 0.5][i],
      }))};
      n.limiter = { enabled: true, threshold: -4, ceiling: -0.5, release: 200, lookahead: 0.005 };
      n.saturation = { enabled: true, type: "tape", drive: 35, mix: 30, bias: 3 };
      n.targetLUFS = -14;
      return n;
    })()
  },
  {
    id: "rock_modern", name: "Modern Rock", group: "Rock",
    chain: (() => {
      const n = updateEq(base, [0, -1, 0.5, 1, 1, 0.5, 1.5, 2, 1.5, 0], undefined, [25, 70, 150, 350, 700, 1800, 3500, 7000, 13000, 20000]);
      n.compressor = { enabled: true, bands: n.compressor.bands.map((b, i) => ({
        ...b, thresh: [-12, -14, -16, -18, -16][i], ratio: [3, 3.5, 4, 4, 3][i],
        attack: [25, 20, 15, 12, 10][i], release: [80, 60, 50, 40, 35][i],
        gain: [2, 2.5, 3, 3, 2][i],
      }))};
      n.limiter = { enabled: true, threshold: -2, ceiling: -0.3, release: 80, lookahead: 0.005 };
      n.saturation = { enabled: true, type: "console", drive: 40, mix: 30, bias: 5 };
      n.targetLUFS = -10;
      return n;
    })()
  },
  {
    id: "rock_alternative", name: "Alternative Rock", group: "Rock",
    chain: (() => {
      const n = updateEq(base, [0, 0, 1, 1.5, 1, 0.5, 1, 1.5, 1, 0], undefined, [30, 75, 180, 400, 800, 2000, 4000, 8000, 14000, 20000]);
      n.compressor = { enabled: true, bands: n.compressor.bands.map((b, i) => ({
        ...b, thresh: [-14, -16, -18, -20, -18][i], ratio: [2.5, 3, 3.5, 3, 2.5][i],
        attack: [30, 25, 20, 15, 12][i], release: [100, 80, 70, 60, 50][i],
        gain: [1, 1.5, 2, 2, 1][i],
      }))};
      n.limiter = { enabled: true, threshold: -3, ceiling: -0.4, release: 120, lookahead: 0.005 };
      n.saturation = { enabled: true, type: "tube", drive: 25, mix: 35, bias: 4 };
      n.imager = { enabled: true, width: 1.2, pan: 0, midSideMode: false };
      n.targetLUFS = -12;
      return n;
    })()
  },
  {
    id: "rock_punk", name: "Punk", group: "Rock",
    chain: (() => {
      const n = updateEq(base, [0, -0.5, 0.5, 1.5, 2, 2, 2, 1.5, 1, 0], undefined, [30, 80, 200, 500, 1000, 2500, 5000, 8000, 13000, 20000]);
      n.compressor = { enabled: true, bands: n.compressor.bands.map((b, i) => ({
        ...b, thresh: [-8, -10, -12, -14, -12][i], ratio: [4, 4.5, 5, 5, 4][i],
        attack: [15, 12, 10, 8, 6][i], release: [50, 40, 30, 25, 20][i],
        gain: [3, 3.5, 4, 4, 3][i],
      }))};
      n.limiter = { enabled: true, threshold: -1, ceiling: -0.2, release: 50, lookahead: 0.005 };
      n.saturation = { enabled: true, type: "console", drive: 50, mix: 40, bias: 6 };
      n.targetLUFS = -8;
      return n;
    })()
  },

  // ═══════════════════════════════════
  // ELECTRONIC / DANCE
  // ═══════════════════════════════════
  {
    id: "edm_festival", name: "EDM Festival", group: "Electronic / Dance",
    chain: (() => {
      const n = updateEq(base, [0, 3, 2, 0, -0.5, 0, 1, 2.5, 3, 0], undefined, [20, 50, 100, 200, 500, 1000, 3000, 7000, 16000, 20000], [0.7, 0.6, 0.6, 1, 1, 1, 1, 1.3, 0.7, 0.7]);
      n.compressor = { enabled: true, bands: n.compressor.bands.map((b, i) => ({
        ...b, thresh: [-6, -8, -10, -12, -14][i], ratio: [2, 2.5, 3, 3.5, 3][i],
        attack: [30, 25, 20, 15, 10][i], release: [80, 60, 50, 40, 30][i],
        gain: [2, 2, 2.5, 3, 2][i],
      }))};
      n.limiter = { enabled: true, threshold: -1, ceiling: -0.2, release: 50, lookahead: 0.005 };
      n.saturation = { enabled: true, type: "tube", drive: 15, mix: 25, bias: 3 };
      n.imager = { enabled: true, width: 1.5, pan: 0, midSideMode: false };
      n.targetLUFS = -8;
      return n;
    })()
  },
  {
    id: "house", name: "House", group: "Electronic / Dance",
    chain: (() => {
      const n = updateEq(base, [0, 2, 1.5, 0, -0.5, 0, 0.5, 1.5, 1, 0], undefined, [20, 55, 110, 250, 500, 1200, 3000, 6000, 15000, 20000]);
      n.compressor = { enabled: true, bands: n.compressor.bands.map((b, i) => ({
        ...b, thresh: [-8, -10, -12, -14, -16][i], ratio: [2, 2.5, 3, 3, 2.5][i],
        attack: [35, 30, 25, 20, 15][i], release: [100, 80, 60, 50, 40][i],
        gain: [1.5, 1.5, 2, 2, 1.5][i],
      }))};
      n.limiter = { enabled: true, threshold: -2, ceiling: -0.3, release: 80, lookahead: 0.005 };
      n.saturation = { enabled: true, type: "tape", drive: 10, mix: 15, bias: 3 };
      n.imager = { enabled: true, width: 1.2, pan: 0, midSideMode: false };
      n.targetLUFS = -11;
      return n;
    })()
  },
  {
    id: "techno", name: "Techno", group: "Electronic / Dance",
    chain: (() => {
      const n = updateEq(base, [0, 1, 1, -1, -2, 0, 1, 2, 1.5, 0], undefined, [20, 55, 110, 250, 600, 1500, 3500, 7000, 16000, 20000]);
      n.compressor = { enabled: true, bands: n.compressor.bands.map((b, i) => ({
        ...b, thresh: [-10, -12, -14, -16, -18][i], ratio: [3, 3.5, 4, 4, 3][i],
        attack: [20, 15, 12, 10, 8][i], release: [60, 50, 40, 30, 25][i],
        gain: [2, 2.5, 3, 3, 2][i],
      }))};
      n.limiter = { enabled: true, threshold: -2, ceiling: -0.3, release: 60, lookahead: 0.005 };
      n.saturation = { enabled: true, type: "console", drive: 20, mix: 20, bias: 3 };
      n.imager = { enabled: true, width: 1.1, pan: 0, midSideMode: false };
      n.targetLUFS = -10;
      return n;
    })()
  },
  {
    id: "lo_fi", name: "Lo-fi", group: "Electronic / Dance",
    chain: (() => {
      const n = updateEq(base, [0, 1.5, 2, 1, 0.5, 0, -0.5, -1.5, -3, -6], undefined, [30, 70, 150, 300, 600, 1500, 3500, 7000, 12000, 18000]);
      n.compressor = { enabled: false, bands: n.compressor.bands };
      n.limiter = { enabled: true, threshold: -6, ceiling: -1, release: 250, lookahead: 0.005 };
      n.saturation = { enabled: true, type: "tape", drive: 50, mix: 60, bias: 6 };
      n.imager = { enabled: true, width: 0.8, pan: 0, midSideMode: false };
      n.targetLUFS = -16;
      return n;
    })()
  },

  // ═══════════════════════════════════
  // HIP HOP / R&B
  // ═══════════════════════════════════
  {
    id: "hiphop_trap", name: "Trap", group: "Hip Hop / R&B",
    chain: (() => {
      const n = updateEq(base, [0, 4, 2, 0.5, 0, 0, 1, 2.5, 3, 0], undefined, [20, 40, 80, 160, 400, 1000, 3000, 7000, 16000, 20000], [0.7, 0.5, 0.5, 1, 1, 1, 1, 1.2, 0.7, 0.7]);
      n.compressor = { enabled: true, bands: n.compressor.bands.map((b, i) => ({
        ...b, thresh: [-4, -6, -10, -14, -16][i], ratio: [2, 2.5, 3, 3.5, 3][i],
        attack: [25, 20, 15, 12, 10][i], release: [80, 60, 50, 40, 30][i],
        gain: [2, 2.5, 3, 3, 2][i],
      }))};
      n.limiter = { enabled: true, threshold: -1, ceiling: -0.2, release: 50, lookahead: 0.005 };
      n.saturation = { enabled: true, type: "tube", drive: 20, mix: 20, bias: 3 };
      n.imager = { enabled: true, width: 1.1, pan: 0, midSideMode: false };
      n.targetLUFS = -8;
      return n;
    })()
  },
  {
    id: "hiphop_boombap", name: "Boom Bap", group: "Hip Hop / R&B",
    chain: (() => {
      const n = updateEq(base, [0, 2.5, 2, 1.5, 1, 0.5, 0.5, 1, 0.5, 0], undefined, [25, 60, 120, 300, 600, 1500, 3500, 7000, 14000, 20000], [0.7, 0.6, 0.7, 1, 1.2, 1, 1, 1, 0.7, 0.7]);
      n.compressor = { enabled: true, bands: n.compressor.bands.map((b, i) => ({
        ...b, thresh: [-10, -12, -14, -16, -16][i], ratio: [2.5, 3, 3.5, 3, 2.5][i],
        attack: [30, 25, 20, 15, 12][i], release: [100, 80, 60, 50, 40][i],
        gain: [1.5, 2, 2.5, 2, 1.5][i],
      }))};
      n.limiter = { enabled: true, threshold: -3, ceiling: -0.5, release: 120, lookahead: 0.005 };
      n.saturation = { enabled: true, type: "tape", drive: 25, mix: 25, bias: 4 };
      n.targetLUFS = -12;
      return n;
    })()
  },
  {
    id: "rnb_smooth", name: "R&B Smooth", group: "Hip Hop / R&B",
    chain: (() => {
      const n = updateEq(base, [0, 1.5, 1.5, 1, 0.5, 0.5, 1, 1.5, 1, 0], undefined, [20, 60, 130, 280, 600, 1500, 3500, 7000, 15000, 20000]);
      n.compressor = { enabled: true, bands: n.compressor.bands.map((b, i) => ({
        ...b, thresh: [-12, -14, -16, -18, -16][i], ratio: [2, 2.5, 2.5, 2.5, 2][i],
        attack: [35, 30, 25, 20, 15][i], release: [120, 100, 80, 70, 60][i],
        gain: [0.5, 1, 1.5, 1.5, 1][i],
      }))};
      n.limiter = { enabled: true, threshold: -4, ceiling: -0.5, release: 150, lookahead: 0.005 };
      n.saturation = { enabled: true, type: "tube", drive: 15, mix: 20, bias: 3 };
      n.targetLUFS = -13;
      return n;
    })()
  },
  {
    id: "hiphop_cloud", name: "Cloud Rap", group: "Hip Hop / R&B",
    chain: (() => {
      const n = updateEq(base, [0, 3, 1.5, 0, 0, 0.5, 1, 2, 2.5, -4], undefined, [20, 50, 100, 220, 500, 1200, 3000, 7000, 14000, 18000]);
      n.compressor = { enabled: false, bands: n.compressor.bands };
      n.limiter = { enabled: true, threshold: -5, ceiling: -0.8, release: 200, lookahead: 0.005 };
      n.saturation = { enabled: true, type: "tape", drive: 30, mix: 50, bias: 5 };
      n.imager = { enabled: true, width: 1.5, pan: 0, midSideMode: false };
      n.targetLUFS = -14;
      return n;
    })()
  },

  // ═══════════════════════════════════
  // JAZZ / ACOUSTIC
  // ═══════════════════════════════════
  {
    id: "jazz_club", name: "Jazz Club", group: "Jazz / Acoustic",
    chain: (() => {
      const n = updateEq(base, [0, 0.5, 1, 1.5, 1, 0.5, 0, -0.5, -1, -2], undefined, [30, 60, 130, 300, 600, 1500, 4000, 8000, 12000, 18000]);
      n.compressor = { enabled: true, bands: n.compressor.bands.map((b, i) => ({
        ...b, thresh: [-18, -20, -22, -24, -22][i], ratio: [1.5, 2, 2, 2, 1.5][i],
        attack: [60, 50, 40, 30, 25][i], release: [200, 150, 120, 100, 80][i],
        gain: [0, 0, 0.5, 0.5, 0][i],
      }))};
      n.limiter = { enabled: true, threshold: -6, ceiling: -1, release: 250, lookahead: 0.005 };
      n.saturation = { enabled: true, type: "tube", drive: 15, mix: 20, bias: 3 };
      n.targetLUFS = -16;
      return n;
    })()
  },
  {
    id: "acoustic_folk", name: "Acoustic Folk", group: "Jazz / Acoustic",
    chain: (() => {
      const n = updateEq(base, [0, 0, 0.5, 1, 1, 0.5, 0.5, 0.5, 0, -1]);
      n.compressor = { enabled: false, bands: n.compressor.bands };
      n.limiter = { enabled: true, threshold: -8, ceiling: -1.5, release: 300, lookahead: 0.005 };
      n.eq.enabled = true;
      n.targetLUFS = -18;
      return n;
    })()
  },
  {
    id: "classical", name: "Classical", group: "Jazz / Acoustic",
    chain: (() => {
      const n = clone(base);
      n.eq.enabled = false;
      n.compressor.enabled = false;
      n.limiter = { enabled: true, threshold: -10, ceiling: -2, release: 500, lookahead: 0.005 };
      n.saturation.enabled = false;
      n.targetLUFS = -20;
      return n;
    })()
  },
  {
    id: "singer_songwriter", name: "Singer-Songwriter", group: "Jazz / Acoustic",
    chain: (() => {
      const n = updateEq(base, [0, 0, 0.5, 1, 1.5, 2, 1.5, 0.5, 0, -1], undefined, [30, 80, 160, 350, 700, 1800, 4000, 8000, 14000, 20000], [0.7, 1, 1, 1.2, 1.2, 1, 1, 1, 0.7, 0.7]);
      n.compressor = { enabled: true, bands: n.compressor.bands.map((b, i) => ({
        ...b, thresh: [-16, -18, -20, -22, -20][i], ratio: [2, 2.5, 2.5, 2, 1.5][i],
        attack: [40, 30, 25, 20, 15][i], release: [150, 120, 100, 80, 60][i],
        gain: [0, 0.5, 1, 0.5, 0][i],
      }))};
      n.limiter = { enabled: true, threshold: -5, ceiling: -0.8, release: 180, lookahead: 0.005 };
      n.saturation = { enabled: true, type: "tube", drive: 20, mix: 20, bias: 3 };
      n.targetLUFS = -14;
      return n;
    })()
  },

  // ═══════════════════════════════════
  // METAL / HEAVY
  // ═══════════════════════════════════
  {
    id: "metal_modern", name: "Modern Metal", group: "Metal / Heavy",
    chain: (() => {
      const n = updateEq(base, [0, -1.5, 0.5, 2, -2, -1, 2, 3, 2, 0], undefined, [30, 60, 150, 400, 800, 2000, 4000, 8000, 15000, 20000]);
      n.compressor = { enabled: true, bands: n.compressor.bands.map((b, i) => ({
        ...b, thresh: [-8, -10, -12, -14, -12][i], ratio: [4, 4.5, 5, 5, 4][i],
        attack: [15, 12, 10, 8, 6][i], release: [40, 30, 25, 20, 15][i],
        gain: [3, 3.5, 4, 4, 3][i],
      }))};
      n.limiter = { enabled: true, threshold: -1, ceiling: -0.2, release: 40, lookahead: 0.005 };
      n.saturation = { enabled: true, type: "console", drive: 60, mix: 50, bias: 6 };
      n.imager = { enabled: true, width: 0.9, pan: 0, midSideMode: false };
      n.targetLUFS = -7;
      return n;
    })()
  },
  {
    id: "metal_death", name: "Death Metal", group: "Metal / Heavy",
    chain: (() => {
      const n = updateEq(base, [0, 0, 2, 1.5, -1.5, -2, 1.5, 3, 2, 0], undefined, [30, 65, 150, 350, 700, 2000, 4500, 9000, 16000, 20000]);
      n.compressor = { enabled: true, bands: n.compressor.bands.map((b, i) => ({
        ...b, thresh: [-6, -8, -10, -12, -10][i], ratio: [5, 5.5, 6, 6, 5][i],
        attack: [10, 8, 6, 5, 4][i], release: [30, 25, 20, 15, 10][i],
        gain: [4, 4.5, 5, 5, 4][i],
      }))};
      n.limiter = { enabled: true, threshold: -0.5, ceiling: -0.1, release: 30, lookahead: 0.005 };
      n.saturation = { enabled: true, type: "console", drive: 70, mix: 60, bias: 7 };
      n.targetLUFS = -6;
      return n;
    })()
  },
  {
    id: "metal_doom", name: "Doom", group: "Metal / Heavy",
    chain: (() => {
      const n = updateEq(base, [0, 3, 3, 1.5, 0, -1, -2, -0.5, 0, -3], undefined, [25, 50, 120, 250, 600, 1500, 3500, 7000, 12000, 18000]);
      n.compressor = { enabled: true, bands: n.compressor.bands.map((b, i) => ({
        ...b, thresh: [-14, -16, -18, -20, -18][i], ratio: [3, 3.5, 4, 4, 3][i],
        attack: [50, 40, 30, 25, 20][i], release: [200, 150, 120, 100, 80][i],
        gain: [1, 1.5, 2, 2, 1.5][i],
      }))};
      n.limiter = { enabled: true, threshold: -3, ceiling: -0.5, release: 200, lookahead: 0.005 };
      n.saturation = { enabled: true, type: "tape", drive: 45, mix: 50, bias: 5 };
      n.imager = { enabled: true, width: 1.35, pan: 0, midSideMode: false };
      n.targetLUFS = -12;
      return n;
    })()
  },
  {
    id: "metal_stoner", name: "Stoner Rock", group: "Metal / Heavy",
    chain: (() => {
      const n = updateEq(base, [0, 2, 2.5, 2, 1, 0.5, 0, -0.5, 0, -2]);
      n.compressor = { enabled: true, bands: n.compressor.bands.map((b, i) => ({
        ...b, thresh: [-12, -14, -16, -18, -16][i], ratio: [2.5, 3, 3.5, 3, 2.5][i],
        attack: [35, 30, 25, 20, 15][i], release: [120, 100, 80, 60, 50][i],
        gain: [1, 1.5, 2, 2, 1][i],
      }))};
      n.limiter = { enabled: true, threshold: -3.5, ceiling: -0.5, release: 150, lookahead: 0.005 };
      n.saturation = { enabled: true, type: "tube", drive: 50, mix: 45, bias: 5 };
      n.targetLUFS = -13;
      return n;
    })()
  },

  // ═══════════════════════════════════
  // WORLD / ETHNIC
  // ═══════════════════════════════════
  {
    id: "world_dangdut", name: "Dangdut", group: "World / Ethnic",
    chain: (() => {
      const n = updateEq(base, [0, 1, 0.5, 1.5, 1, 0, 1, 2.5, 3, 0], undefined, [30, 65, 130, 300, 600, 1500, 3500, 7000, 16000, 20000]);
      n.compressor = { enabled: true, bands: n.compressor.bands.map((b, i) => ({
        ...b, thresh: [-10, -12, -14, -16, -14][i], ratio: [2.5, 3, 3.5, 3, 2.5][i],
        attack: [25, 20, 15, 12, 10][i], release: [80, 60, 50, 40, 35][i],
        gain: [1.5, 2, 2.5, 2, 1.5][i],
      }))};
      n.limiter = { enabled: true, threshold: -2, ceiling: -0.3, release: 80, lookahead: 0.005 };
      n.saturation = { enabled: true, type: "tape", drive: 15, mix: 20, bias: 3 };
      n.imager = { enabled: true, width: 1.2, pan: 0, midSideMode: false };
      n.targetLUFS = -10;
      return n;
    })()
  },
  {
    id: "world_kpop", name: "K-Pop", group: "World / Ethnic",
    chain: (() => {
      const n = updateEq(base, [0, 1.5, 1, 0.5, 0, 0.5, 1.5, 3, 3.5, 0], undefined, [20, 55, 110, 250, 550, 1200, 3000, 7000, 16000, 20000]);
      n.compressor = { enabled: true, bands: n.compressor.bands.map((b, i) => ({
        ...b, thresh: [-6, -8, -10, -12, -14][i], ratio: [2.5, 3, 3.5, 3.5, 3][i],
        attack: [20, 15, 12, 10, 8][i], release: [60, 50, 40, 35, 30][i],
        gain: [2, 2.5, 3, 3, 2][i],
      }))};
      n.limiter = { enabled: true, threshold: -1, ceiling: -0.2, release: 50, lookahead: 0.005 };
      n.saturation = { enabled: true, type: "tube", drive: 10, mix: 15, bias: 2 };
      n.imager = { enabled: true, width: 1.3, pan: 0, midSideMode: false };
      n.targetLUFS = -8;
      return n;
    })()
  },
  {
    id: "world_latin", name: "Latin", group: "World / Ethnic",
    chain: (() => {
      const n = updateEq(base, [0, 2, 1.5, 1, 0.5, 0.5, 1, 1.5, 1, 0], undefined, [25, 60, 120, 280, 600, 1500, 3500, 7000, 15000, 20000]);
      n.compressor = { enabled: true, bands: n.compressor.bands.map((b, i) => ({
        ...b, thresh: [-10, -12, -14, -16, -14][i], ratio: [2, 2.5, 3, 3, 2.5][i],
        attack: [30, 25, 20, 15, 12][i], release: [100, 80, 60, 50, 40][i],
        gain: [1, 1.5, 2, 2, 1.5][i],
      }))};
      n.limiter = { enabled: true, threshold: -3, ceiling: -0.5, release: 100, lookahead: 0.005 };
      n.saturation = { enabled: true, type: "tube", drive: 20, mix: 25, bias: 4 };
      n.imager = { enabled: true, width: 1.15, pan: 0, midSideMode: false };
      n.targetLUFS = -11;
      return n;
    })()
  },
  {
    id: "world_reggae", name: "Reggae", group: "World / Ethnic",
    chain: (() => {
      const n = updateEq(base, [0, 3, 2.5, 1, 0, -0.5, -0.5, 0, -1, -3], undefined, [25, 55, 110, 250, 600, 1500, 3500, 8000, 14000, 18000]);
      n.compressor = { enabled: true, bands: n.compressor.bands.map((b, i) => ({
        ...b, thresh: [-14, -16, -18, -20, -18][i], ratio: [2, 2, 2.5, 2.5, 2][i],
        attack: [50, 40, 30, 25, 20][i], release: [150, 120, 100, 80, 60][i],
        gain: [0, 0.5, 1, 1, 0.5][i],
      }))};
      n.limiter = { enabled: true, threshold: -5, ceiling: -0.8, release: 200, lookahead: 0.005 };
      n.saturation = { enabled: true, type: "tape", drive: 20, mix: 30, bias: 4 };
      n.targetLUFS = -14;
      return n;
    })()
  },
];

export function getLocalPresets(): LocalPreset[] {
  return presets;
}
