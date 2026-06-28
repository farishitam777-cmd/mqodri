import React, { useMemo } from "react";
import { Sliders, PowerOff } from "lucide-react";
import { useMasterStore } from "../store/masterStore";

const SIMPLIFIED_BANDS = [
  { label: "Sub Bass", fromId: 1, toId: 1, desc: "Getaran paling dalam" },
  { label: "Bass", fromId: 2, toId: 3, desc: "Nada rendah & body" },
  { label: "Low Mid", fromId: 4, toId: 5, desc: "Kehangatan & ketebalan" },
  { label: "High Mid", fromId: 6, toId: 7, desc: "Kejelasan & presence" },
  { label: "Treble", fromId: 8, toId: 9, desc: "Detail & shimmer" },
  { label: "Air", fromId: 10, toId: 10, desc: "Ujung frekuensi tinggi" },
];

function MiniSlider({ label, value, display, min, max, step, onChange }: {
  label: string; value: number; display: string; min: number; max: number; step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-3">
      <span className="text-[8px] sm:text-[9px] font-mono text-slate-400 w-11 sm:w-16 shrink-0 truncate">{label}</span>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 accent-blue-500 h-1 bg-[var(--bg-elevated)] rounded-lg cursor-pointer min-w-[60px]"
      />
      <span className="text-[9px] sm:text-[10px] font-mono text-slate-300 w-10 sm:w-14 text-right shrink-0">{display}</span>
    </div>
  );
}

function ModuleCard({ title, desc, enabled, onToggle, children }: {
  title: string; desc: string; enabled: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className={`bg-[var(--bg-elevated)] rounded-xl border p-4 space-y-3 ${
      enabled ? "border-blue-500/20" : "border-[var(--border-subtle)] opacity-60"
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggle}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              enabled ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "bg-[var(--bg-elevated)] text-slate-600 border border-[var(--border-subtle)]"
            }`}
          >
            <div className={`w-3 h-3 rounded-full ${enabled ? "bg-blue-400" : "bg-slate-600"}`} />
          </button>
          <span className="text-[10px] font-semibold text-slate-200 font-sans">{title}</span>
        </div>
        <span className="text-[8px] text-slate-500 font-mono">{desc}</span>
      </div>
      {enabled && children}
    </div>
  );
}

function generateEQCurvePath(bands: any[], enabled: boolean, width = 500, height = 100) {
  const midY = height / 2;
  const points: string[] = [];
  for (let x = 0; x <= width; x += 6) {
    const logFreq = 20 * Math.pow(1000, x / width);
    let netGain = 0;
    if (enabled) {
      bands.forEach((band: any) => {
        const freqDist = Math.abs(Math.log10(logFreq) - Math.log10(band.freq));
        if (band.type === "highpass") {
          if (logFreq < band.freq) netGain -= 12 * (1 - logFreq / band.freq);
        } else if (band.type === "lowpass") {
          if (logFreq > band.freq) netGain -= 12 * (1 - band.freq / logFreq);
        } else if (band.type === "highshelf") {
          if (logFreq > band.freq) netGain += band.gain;
          else netGain += band.gain * Math.max(0, 1 - freqDist);
        } else if (band.type === "lowshelf") {
          if (logFreq < band.freq) netGain += band.gain;
          else netGain += band.gain * Math.max(0, 1 - freqDist);
        } else {
          const bandwidth = band.q * 1.5;
          const impact = Math.max(0, 1 - freqDist / bandwidth);
          netGain += band.gain * impact;
        }
      });
    }
    const gainY = midY - (netGain * 3);
    const boundedY = Math.max(2, Math.min(height - 2, gainY));
    points.push(`${x},${boundedY}`);
  }
  return `M 0,${midY} ${points.join(" ")}`;
}

function getSimplifiedGain(bands: any[], fromId: number, toId: number): number {
  const relevant = bands.filter(b => b.id >= fromId && b.id <= toId);
  if (relevant.length === 0) return 0;
  return relevant.reduce((sum, b) => sum + b.gain, 0) / relevant.length;
}

function setSimplifiedGain(bands: any[], fromId: number, toId: number, value: number, updateEQBand: any) {
  bands.filter(b => b.id >= fromId && b.id <= toId).forEach(b => updateEQBand(b.id, { gain: value }));
}

export default function SimplifiedMastering() {
  const { chain, masterBypass, setMasterBypass, updateChain, updateEQBand, updateCompressorBand, activePresetName } = useMasterStore();

  const eqPath = useMemo(() => generateEQCurvePath(chain.eq.bands, chain.eq.enabled, 500, 100), [chain.eq.bands, chain.eq.enabled]);

  const eqSliders = SIMPLIFIED_BANDS.map((sb) => ({
    ...sb,
    gain: getSimplifiedGain(chain.eq.bands, sb.fromId, sb.toId),
  }));

  const toggleModule = (key: string) => {
    updateChain((prev) => {
      const mod = prev[key as keyof typeof prev] as any;
      return { [key]: { ...mod, enabled: !mod.enabled } };
    });
  };

  return (
    <div className="bg-[var(--bg-elevated-20)] border border-[var(--border-subtle)] rounded-xl p-5 space-y-5 mt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-300 font-sans flex items-center gap-1.5">
          <Sliders className="w-4 h-4 text-blue-400" />
          Mastering Chain
          {activePresetName && (
            <span className="ml-2 text-[8px] font-mono text-slate-500 bg-[var(--bg-elevated-20)] px-2 py-0.5 rounded-full">{activePresetName}</span>
          )}
        </h3>
        <button
          onClick={() => setMasterBypass(!masterBypass)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[9px] font-mono font-bold transition-all cursor-pointer ${
            masterBypass
              ? "bg-red-950/40 border border-red-500/30 text-red-400"
              : "bg-emerald-950/40 border border-emerald-500/30 text-emerald-400"
          }`}
        >
          <PowerOff className="w-3 h-3" />
          {masterBypass ? "BYPASS" : "AKTIF"}
        </button>
      </div>

      {/* Visual EQ */}
      <div className="bg-[var(--bg-elevated)] rounded-xl p-4 border border-[var(--border-subtle)]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">Equalizer Visual</span>
          <div className="flex items-center gap-1 text-[8px] font-mono text-slate-600">
            <span>+12dB</span>
            <span className="w-16 h-px bg-slate-700" />
            <span>-12dB</span>
          </div>
        </div>
        <div className="relative">
          <svg viewBox="0 0 500 100" className="w-full h-24" preserveAspectRatio="none">
            <line x1="0" y1="50" x2="500" y2="50" stroke="#1f2937" strokeWidth="1" strokeDasharray="3,3" />
            <line x1="0" y1="25" x2="500" y2="25" stroke="#1f2937" strokeWidth="0.5" strokeDasharray="2,4" />
            <line x1="0" y1="75" x2="500" y2="75" stroke="#1f2937" strokeWidth="0.5" strokeDasharray="2,4" />
            <path d={eqPath} fill="none" stroke={chain.eq.enabled ? "#3b82f6" : "#4b5563"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-150" />
            {chain.eq.enabled && (
              <path d={`${eqPath} L 500,50 L 0,50 Z`} fill="url(#eqGrad)" opacity="0.2" />
            )}
            <defs>
              <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
          <div className="flex justify-between text-[8px] font-mono text-slate-600 mt-1 px-0.5">
            <span>20Hz</span>
            <span>100Hz</span>
            <span>500Hz</span>
            <span>2kHz</span>
            <span>8kHz</span>
            <span>20kHz</span>
          </div>
        </div>
      </div>

      {/* Simplified 6-band EQ sliders */}
      <div className="bg-[var(--bg-elevated)] rounded-xl p-4 border border-[var(--border-subtle)]">
        <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider block mb-3">Atur Nada</span>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
          {eqSliders.map((sb) => (
            <div key={sb.label} className="text-center">
              <input
                type="range"
                min={-12} max={12} step={0.5}
                value={sb.gain}
                onChange={(e) => setSimplifiedGain(chain.eq.bands, sb.fromId, sb.toId, parseFloat(e.target.value), updateEQBand)}
                className="w-full accent-blue-500 h-28 sm:h-20 bg-[var(--bg-elevated)] rounded-lg cursor-pointer"
                style={{ writingMode: "vertical-lr", direction: "rtl", WebkitAppearance: "slider-vertical" }}
              />
              <span className="text-[10px] font-mono text-slate-400 mt-1 block">{sb.label}</span>
              <span className="text-[7px] text-slate-600 block">{sb.desc}</span>
              <span className="text-[9px] font-mono text-blue-400 block mt-0.5">{sb.gain > 0 ? `+${sb.gain}` : sb.gain}dB</span>
            </div>
          ))}
        </div>
      </div>

      {/* Module Cards — always visible */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Compressor */}
        <ModuleCard title="Compressor" desc="Atur keras lembut suara" enabled={chain.compressor.enabled}
          onToggle={() => toggleModule("compressor")}>
          <MiniSlider label="Strength" value={chain.compressor.bands[0].ratio} display={`${chain.compressor.bands[0].ratio.toFixed(1)}:1`} min={1} max={8} step={0.1}
            onChange={(v) => chain.compressor.bands.forEach((_, i) => updateCompressorBand(i, { ratio: v }))} />
          <MiniSlider label="Threshold" value={chain.compressor.bands[0].thresh} display={`${chain.compressor.bands[0].thresh} dB`} min={-40} max={0} step={0.5}
            onChange={(v) => chain.compressor.bands.forEach((_, i) => updateCompressorBand(i, { thresh: v }))} />
          <MiniSlider label="Output" value={chain.compressor.bands[0].gain} display={`+${chain.compressor.bands[0].gain.toFixed(1)} dB`} min={0} max={12} step={0.1}
            onChange={(v) => chain.compressor.bands.forEach((_, i) => updateCompressorBand(i, { gain: v }))} />
        </ModuleCard>

        {/* Limiter */}
        <ModuleCard title="Limiter" desc="Cegah pecah & clipping" enabled={chain.limiter.enabled}
          onToggle={() => toggleModule("limiter")}>
          <MiniSlider label="Loudness" value={chain.limiter.threshold} display={`${chain.limiter.threshold.toFixed(1)} dB`} min={-24} max={0} step={0.1}
            onChange={(v) => updateChain((p) => ({ limiter: { ...p.limiter, threshold: v } }))} />
          <MiniSlider label="Ceiling" value={chain.limiter.ceiling} display={`${chain.limiter.ceiling.toFixed(1)} dB`} min={-3} max={-0.1} step={0.1}
            onChange={(v) => updateChain((p) => ({ limiter: { ...p.limiter, ceiling: v } }))} />
        </ModuleCard>

        {/* Stereo Imager */}
        <ModuleCard title="Stereo Imager" desc="Lebar dimensi stereo" enabled={chain.imager.enabled}
          onToggle={() => toggleModule("imager")}>
          <MiniSlider label="Width" value={chain.imager.width} display={`${Math.floor(chain.imager.width * 100)}%`} min={0} max={2} step={0.05}
            onChange={(v) => updateChain((p) => ({ imager: { ...p.imager, width: v } }))} />
        </ModuleCard>

        {/* Saturation */}
        <ModuleCard title="Saturation" desc="Kehangatan analog" enabled={chain.saturation.enabled}
          onToggle={() => toggleModule("saturation")}>
          <select value={chain.saturation.type} onChange={(e: any) => updateChain((p) => ({ saturation: { ...p.saturation, type: e.target.value } }))}
            className="w-full bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-lg py-1.5 px-2.5 text-[10px] text-slate-300 focus:outline-none">
            <option value="tape">Tape (Gentle)</option>
            <option value="tube">Tube (Harmonic)</option>
            <option value="console">Console (Warm)</option>
          </select>
          <MiniSlider label="Drive" value={chain.saturation.drive} display={`${chain.saturation.drive}%`} min={0} max={100} step={1}
            onChange={(v) => updateChain((p) => ({ saturation: { ...p.saturation, drive: v } }))} />
          <MiniSlider label="Mix" value={chain.saturation.mix} display={`${chain.saturation.mix}%`} min={0} max={100} step={1}
            onChange={(v) => updateChain((p) => ({ saturation: { ...p.saturation, mix: v } }))} />
        </ModuleCard>

        {/* Noise Gate */}
        <ModuleCard title="Noise Gate" desc="Reduksi noise latar" enabled={chain.noiseReduction.enabled}
          onToggle={() => toggleModule("noiseReduction")}>
          <MiniSlider label="Gate" value={chain.noiseReduction.threshold} display={`${chain.noiseReduction.threshold} dB`} min={-80} max={-20} step={1}
            onChange={(v) => updateChain((p) => ({ noiseReduction: { ...p.noiseReduction, threshold: v } }))} />
          <MiniSlider label="Reduction" value={chain.noiseReduction.reduction} display={`${chain.noiseReduction.reduction} dB`} min={0} max={30} step={1}
            onChange={(v) => updateChain((p) => ({ noiseReduction: { ...p.noiseReduction, reduction: v } }))} />
        </ModuleCard>

        {/* Humanize */}
        <ModuleCard title="Humanize" desc="Vokal AI lebih alami" enabled={chain.humanize.enabled}
          onToggle={() => toggleModule("humanize")}>
          <MiniSlider label="Pitch" value={chain.humanize.pitchVariation} display={`${chain.humanize.pitchVariation}%`} min={0} max={100} step={1}
            onChange={(v) => updateChain((p) => ({ humanize: { ...p.humanize, pitchVariation: v } }))} />
          <MiniSlider label="Drift" value={chain.humanize.timingDrift} display={`${chain.humanize.timingDrift}%`} min={0} max={100} step={1}
            onChange={(v) => updateChain((p) => ({ humanize: { ...p.humanize, timingDrift: v } }))} />
          <MiniSlider label="Breath" value={chain.humanize.breathNoise} display={`${chain.humanize.breathNoise}%`} min={0} max={100} step={1}
            onChange={(v) => updateChain((p) => ({ humanize: { ...p.humanize, breathNoise: v } }))} />
          <MiniSlider label="Warmth" value={chain.humanize.warmth} display={`${chain.humanize.warmth}%`} min={0} max={100} step={1}
            onChange={(v) => updateChain((p) => ({ humanize: { ...p.humanize, warmth: v } }))} />
        </ModuleCard>
      </div>
    </div>
  );
}
