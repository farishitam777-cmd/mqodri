import React, { useMemo, useState, useRef, useEffect } from "react";
import { Sliders, PowerOff } from "lucide-react";
import { useMasterStore } from "../store/masterStore";
import { audioEngine } from "../lib/audio/MasteringEngine";

// ponytail: 6 macro groups covering all 12 bands
const SIMPLIFIED_BANDS = [
  { label: "Sub", fromId: 1, toId: 1, freq: "30", desc: "Getaran" },
  { label: "Bass", fromId: 2, toId: 3, freq: "65-125", desc: "Rendah" },
  { label: "Low M", fromId: 4, toId: 5, freq: "250-500", desc: "Hangat" },
  { label: "Hi M", fromId: 6, toId: 7, freq: "1k-2k", desc: "Jelas" },
  { label: "Treble", fromId: 8, toId: 10, freq: "4k-12k", desc: "Detail" },
  { label: "Air", fromId: 11, toId: 12, freq: "16k-20k", desc: "Cahaya" },
];

// ponytail: layperson labels for each of the 12 bands
const BAND_DESC: Record<number, string> = {
  1: "Getaran",
  2: "Bass",
  3: "Body",
  4: "Hangat",
  5: "Tebal",
  6: "Jelas",
  7: "Tajam",
  8: "Detail",
  9: "Ruang",
  10: "Kilau",
  11: "Cahaya",
  12: "Akhir",
};

function getSimplifiedGain(bands: any[], fromId: number, toId: number): number {
  const relevant = bands.filter(b => b.id >= fromId && b.id <= toId);
  if (relevant.length === 0) return 0;
  return relevant.reduce((sum, b) => sum + b.gain, 0) / relevant.length;
}

function setSimplifiedGain(bands: any[], fromId: number, toId: number, value: number, updateEQBand: any) {
  bands.filter(b => b.id >= fromId && b.id <= toId).forEach(b => updateEQBand(b.id, { gain: value }));
}

// ponytail: channel-strip style EQ slider — recessed track, glowing fill, no deps
function ProSlider({ value, onChange, min = -12, max = 12, step = 0.5, freq, desc }: {
  value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number;
  freq?: string; desc?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  const range = max - min;
  const pct = ((value - min) / range) * 100;
  const display = value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
  const isBoost = value > 0;
  const isCut = value < 0;
  const color = isBoost ? "#3b82f6" : isCut ? "#f97316" : "#64748b";

  const getValue = (clientY: number) => {
    const el = ref.current;
    if (!el) return value;
    const rect = el.getBoundingClientRect();
    const y = (rect.bottom - clientY) / rect.height;
    const raw = min + Math.max(0, Math.min(1, y)) * range;
    const stepped = Math.round(raw / step) * step;
    return Math.max(min, Math.min(max, stepped));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    setActive(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    onChange(getValue(e.clientY));
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!active) return;
    onChange(getValue(e.clientY));
  };
  const onPointerUp = () => { setActive(false); };

  return (
    <div className="flex flex-col items-center select-none w-full h-full" style={{ touchAction: "none" }}>
      {/* dB value */}
      <span className="text-[10px] sm:text-[11px] font-bold font-mono leading-none tabular-nums"
        style={{ color, textShadow: active && value !== 0 ? `0 0 14px ${color}50` : "none" }}>
        {display}
      </span>

      {/* Track container */}
      <div
        ref={ref}
        className="relative w-full flex-1 cursor-pointer my-1"
        style={{ minHeight: 0, touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {/* Track groove — recessed channel look */}
        <div
          className="absolute left-1/2 -translate-x-1/2 bottom-0 w-[5px] rounded-full"
          style={{
            height: "100%",
            background: "linear-gradient(to bottom, #0f172a 0%, #1e293b 35%, #334155 50%, #1e293b 65%, #0f172a 100%)",
            boxShadow: "inset 0 1px 3px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)",
          }}
        />

        {/* Scale: +6dB tick */}
        <div className="absolute left-1/2 -translate-x-1/2 w-full flex items-center" style={{ top: "25%" }}>
          <div className="w-2 h-px bg-slate-600/25 ml-auto" />
          <div className="w-[5px]" />
        </div>
        {/* Scale: -6dB tick */}
        <div className="absolute left-1/2 -translate-x-1/2 w-full flex items-center" style={{ top: "75%" }}>
          <div className="w-2 h-px bg-slate-600/25 ml-auto" />
          <div className="w-[5px]" />
        </div>
        {/* 0dB line */}
        <div className="absolute left-1/2 -translate-x-1/2 w-full flex items-center" style={{ top: "50%" }}>
          <div className="w-[14px] h-px bg-slate-400/40 ml-auto" />
          <div className="w-[5px]" />
        </div>

        {/* Glowing fill from center to knob */}
        <div
          className="absolute left-1/2 -translate-x-1/2 w-[5px] rounded-full"
          style={{
            bottom: `${Math.min(pct, 50)}%`,
            height: `${Math.abs(pct - 50)}%`,
            backgroundColor: color,
            opacity: value === 0 ? 0.12 : 0.85,
            boxShadow: value !== 0
              ? `0 0 ${active ? "12px" : "6px"} ${color}40`
              : "none",
            transition: active ? "none" : "box-shadow 0.2s",
          }}
        />

        {/* Knob glow aura */}
        {value !== 0 && (
          <div
            className="absolute left-1/2 rounded-full pointer-events-none"
            style={{
              width: active ? 24 : 20,
              height: active ? 24 : 20,
              top: `${100 - pct}%`,
              transform: "translate(-50%, -50%)",
              backgroundColor: `${color}12`,
              transition: "width 0.1s, height 0.1s",
            }}
          />
        )}

        {/* Knob */}
        <div
          className="absolute left-1/2 rounded-full border-[2.5px]"
          style={{
            width: active ? 15 : 13,
            height: active ? 15 : 13,
            top: `${100 - pct}%`,
            transform: "translate(-50%, -50%)",
            borderColor: color,
            backgroundColor: active ? "#f8fafc" : "#ffffff",
            boxShadow: value !== 0
              ? `0 0 ${active ? "16px" : "8px"} ${color}40, 0 1px 4px rgba(0,0,0,0.35)`
              : "0 1px 3px rgba(0,0,0,0.3)",
            transition: "width 0.08s, height 0.08s, box-shadow 0.2s, background-color 0.15s",
          }}
        />
      </div>

      {/* Labels */}
      <div className="text-center leading-tight">
        {freq && <div className="text-[7px] sm:text-[8px] font-mono text-slate-500 font-medium">{freq}</div>}
        {desc && <div className="text-[6px] sm:text-[7px] text-slate-400/70 leading-none mt-px">{desc}</div>}
      </div>
    </div>
  );
}

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

function freqLabel(freq: number): string {
  return freq >= 1000 ? `${freq / 1000}k` : `${freq}`;
}

export default function SimplifiedMastering() {
  const { chain, masterBypass, setMasterBypass, updateChain, updateEQBand, updateCompressorBand, activePresetName } = useMasterStore();
  const [eqMode, setEqMode] = useState<"simple" | "full">("full");

  const eqPath = useMemo(() => generateEQCurvePath(chain.eq.bands, chain.eq.enabled, 500, 100), [chain.eq.bands, chain.eq.enabled]);
  const [visualMode, setVisualMode] = useState<"curve" | "spectrum" | "spectrogram">("curve");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const specBufRef = useRef<Uint8Array[]>([]);

  // ponytail: shared canvas draw loop for spectrum & spectrogram modes
  useEffect(() => {
    const mode = visualMode;
    if (mode === "curve" || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    let w = canvas.width, h = canvas.height;

    const heat = (v: number) => {
      const t = Math.min(1, Math.max(0, v));
      if (t < 0.25) return `hsl(220, 80%, ${12 + t * 4 * 20}%)`;
      if (t < 0.5) return `hsl(${220 - (t - 0.25) * 4 * 60}, 85%, 32%)`;
      if (t < 0.75) return `hsl(${160 - (t - 0.5) * 4 * 80}, 90%, ${32 + (t - 0.5) * 4 * 18}%)`;
      return `hsl(${40 - (t - 0.75) * 4 * 40}, 95%, ${50 + (t - 0.75) * 4 * 15}%)`;
    };

    const draw = () => {
      animRef.current = requestAnimationFrame(draw);
      const rect = canvas.getBoundingClientRect();
      w = Math.round(rect.width * devicePixelRatio);
      h = Math.round(rect.height * devicePixelRatio);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      ctx.clearRect(0, 0, w, h);

      const analyser = audioEngine?.analyser;
      if (!analyser) {
        ctx.fillStyle = "#0a0a0a"; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#1a1a2e"; ctx.font = `${Math.round(h * 0.08)}px monospace`;
        ctx.textAlign = "center";
        ctx.fillText("Tidak ada audio", w / 2, h / 2);
        return;
      }

      const bins = analyser.frequencyBinCount;
      const data = new Uint8Array(bins);
      analyser.getByteFrequencyData(data);

      if (mode === "spectrum") {
        // Draw frequency bars
        const barW = w / (bins / 2);
        for (let i = 0; i < bins / 2; i++) {
          const val = data[i] / 255;
          const barH = val * (h - 8);
          const x = i * barW;
          const grad = ctx.createLinearGradient(0, h - barH, 0, h);
          grad.addColorStop(0, `hsl(${210 - val * 60}, 85%, ${40 + val * 35}%)`);
          grad.addColorStop(1, `hsl(${210 - val * 40}, 70%, ${8 + val * 15}%)`);
          ctx.fillStyle = grad;
          ctx.fillRect(x, h - 4 - barH, Math.max(1, barW - 0.5), barH);
        }
        // Overlay EQ curve
        const bands = useMasterStore.getState().chain.eq.bands;
        const eqOn = useMasterStore.getState().chain.eq.enabled;
        ctx.beginPath();
        ctx.strokeStyle = eqOn ? "rgba(59,130,246,0.6)" : "rgba(100,116,139,0.3)";
        ctx.lineWidth = 2;
        for (let x = 0; x <= w; x += 4) {
          const logFreq = 20 * Math.pow(1000, x / w);
          let netGain = 0;
          if (eqOn) bands.forEach((b: any) => {
            const d = Math.abs(Math.log10(logFreq) - Math.log10(b.freq));
            if (b.type === "highpass") { if (logFreq < b.freq) netGain -= 12 * (1 - logFreq / b.freq); }
            else if (b.type === "lowpass") { if (logFreq > b.freq) netGain -= 12 * (1 - b.freq / logFreq); }
            else if (b.type === "highshelf") { netGain += logFreq > b.freq ? b.gain : b.gain * Math.max(0, 1 - d); }
            else if (b.type === "lowshelf") { netGain += logFreq < b.freq ? b.gain : b.gain * Math.max(0, 1 - d); }
            else { const bw = b.q * 1.5; netGain += b.gain * Math.max(0, 1 - d / bw); }
          });
          const midY = h / 2;
          const y = midY - netGain * (h / 24);
          x === 0 ? ctx.moveTo(x, Math.max(2, Math.min(h - 2, y))) : ctx.lineTo(x, Math.max(2, Math.min(h - 2, y)));
        }
        ctx.stroke();
      } else {
        // Spectrogram — scroll right
        const col = new Uint8Array(bins);
        col.set(data);
        specBufRef.current.push(col);
        const maxCols = w;
        while (specBufRef.current.length > maxCols) specBufRef.current.shift();
        const imgData = ctx.createImageData(w, h);
        for (let x = 0; x < specBufRef.current.length; x++) {
          const frame = specBufRef.current[x];
          for (let y = 0; y < h; y++) {
            const bin = Math.floor((y / h) * bins);
            const val = frame[bin] / 255;
            const idx = (x + y * w) * 4;
            const t = Math.min(1, Math.max(0, val));
            if (t < 0.25) {
              const l = 12 + t * 4 * 20;
              imgData.data[idx] = 8; imgData.data[idx + 1] = 8; imgData.data[idx + 2] = 36 + l; imgData.data[idx + 3] = 255;
            } else if (t < 0.5) {
              const s = (t - 0.25) * 4;
              imgData.data[idx] = 10 + s * 20; imgData.data[idx + 1] = 30 + s * 40; imgData.data[idx + 2] = 96 - s * 40; imgData.data[idx + 3] = 255;
            } else if (t < 0.75) {
              const s = (t - 0.5) * 4;
              imgData.data[idx] = 30 + s * 150; imgData.data[idx + 1] = 100 - s * 20; imgData.data[idx + 2] = 36 - s * 36; imgData.data[idx + 3] = 255;
            } else {
              const s = (t - 0.75) * 4;
              imgData.data[idx] = 180 + s * 75; imgData.data[idx + 1] = 80 - s * 60; imgData.data[idx + 2] = 0; imgData.data[idx + 3] = 255;
            }
          }
        }
        ctx.putImageData(imgData, 0, 0);
      }

      // Frequency labels
      ctx.fillStyle = "rgba(148,163,184,0.5)";
      ctx.font = `${Math.round(h * 0.08)}px monospace`;
      ctx.textAlign = "center";
      const labels = ["20Hz","100Hz","500Hz","2kHz","8kHz","20kHz"];
      labels.forEach((l, i) => ctx.fillText(l, (w / (labels.length - 1)) * i, h - 2));
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [visualMode]);

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

      {/* Visual EQ — 3 mode tabs */}
      <div className="bg-[var(--bg-elevated)] rounded-xl p-4 border border-[var(--border-subtle)]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex bg-[var(--bg-elevated-20)] rounded-lg p-0.5 border border-[var(--border-subtle)]">
            <button onClick={() => setVisualMode("curve")}
              className={`px-2 py-1 rounded-md text-[8px] font-mono font-semibold transition-all cursor-pointer ${visualMode === "curve" ? "bg-blue-500/20 text-blue-400" : "text-slate-500 hover:text-slate-300"}`}>Kurva</button>
            <button onClick={() => setVisualMode("spectrum")}
              className={`px-2 py-1 rounded-md text-[8px] font-mono font-semibold transition-all cursor-pointer ${visualMode === "spectrum" ? "bg-blue-500/20 text-blue-400" : "text-slate-500 hover:text-slate-300"}`}>Spektrum</button>
            <button onClick={() => setVisualMode("spectrogram")}
              className={`px-2 py-1 rounded-md text-[8px] font-mono font-semibold transition-all cursor-pointer ${visualMode === "spectrogram" ? "bg-blue-500/20 text-blue-400" : "text-slate-500 hover:text-slate-300"}`}>Spektrogram</button>
          </div>
          <span className="text-[7px] font-mono text-slate-600">+12dB / -12dB</span>
        </div>

        {visualMode === "curve" ? (
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
              <span>20Hz</span><span>100Hz</span><span>500Hz</span><span>2kHz</span><span>8kHz</span><span>20kHz</span>
            </div>
          </div>
        ) : (
          <div className="relative">
            <canvas ref={canvasRef} className="w-full h-24 rounded" />
          </div>
        )}
      </div>

      {/* Mode toggle + EQ sliders */}
      <div className="bg-[var(--bg-elevated)] rounded-xl p-4 border border-[var(--border-subtle)]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">
            {eqMode === "simple" ? "Sederhana" : "12-Band EQ"}
          </span>
          <div className="flex bg-[var(--bg-elevated-20)] rounded-lg p-0.5 border border-[var(--border-subtle)]">
            <button
              onClick={() => setEqMode("simple")}
              className={`px-2.5 py-1 rounded-md text-[9px] font-mono font-semibold transition-all cursor-pointer ${
                eqMode === "simple" ? "bg-blue-500/20 text-blue-400" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Sederhana
            </button>
            <button
              onClick={() => setEqMode("full")}
              className={`px-2.5 py-1 rounded-md text-[9px] font-mono font-semibold transition-all cursor-pointer ${
                eqMode === "full" ? "bg-blue-500/20 text-blue-400" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              12 Band
            </button>
          </div>
        </div>

        {eqMode === "simple" ? (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
            {SIMPLIFIED_BANDS.map((sb) => {
              const gain = getSimplifiedGain(chain.eq.bands, sb.fromId, sb.toId);
              return (
                <div key={sb.label} className="h-32 sm:h-36">
                  <ProSlider
                    value={gain}
                    onChange={(v) => setSimplifiedGain(chain.eq.bands, sb.fromId, sb.toId, v, updateEQBand)}
                    freq={sb.freq}
                    desc={sb.desc}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-1 sm:gap-2">
            {chain.eq.bands.map((band) => (
              <div key={band.id} className="h-32 sm:h-36">
                <ProSlider
                  value={band.gain}
                  onChange={(v) => updateEQBand(band.id, { gain: v })}
                  freq={freqLabel(band.freq)}
                  desc={BAND_DESC[band.id]}
                />
              </div>
            ))}
          </div>
        )}
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
