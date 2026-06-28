import React, { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { 
  Upload, 
  Activity, 
  RefreshCw, 
  Music, 
  Sparkles,
  Zap
} from "lucide-react";
import { useMasterStore } from "../store/masterStore";
import { audioEngine } from "../lib/audio/MasteringEngine";
import SimplifiedMastering from "./SimplifiedMastering";

interface CenterPanelProps {
  onFileDrop: (file: File) => void;
  wavesurferRef: React.MutableRefObject<WaveSurfer | null>;
}

export default function CenterPanel({ onFileDrop, wavesurferRef }: CenterPanelProps) {
  const {
    audioFile,
    audioUrl,
    audioBuffer,
    isPlaying,
    setCurrentTime,
    setDuration,
    zoom,
    loop,
    isLoadingAudio,
    meters,
    analysis,
    chain,
    loadPreset,
    token,
    userGenre,
    setUserGenre,
    userIntent,
    setUserIntent,
    aiCritique,
    setAiCritique,
    isCritiquing,
    setIsCritiquing,
  } = useMasterStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const spectrumCanvasRef = useRef<HTMLCanvasElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [aiApplying, setAiApplying] = useState(false);

  // 0. Initialize mastering engine from decoded AudioBuffer
  useEffect(() => {
    if (!audioBuffer) return;
    audioEngine.initFromBuffer(audioBuffer, chain);
    if (isPlaying) audioEngine.play();
    else audioEngine.updateParams(chain);
  }, [audioBuffer]);

  // 1. Initialize WaveSurfer (visualization only, no audio)
  useEffect(() => {
    if (!containerRef.current || !audioUrl) return;

    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
    }

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "rgba(255, 255, 255, 0.1)",
      progressColor: "#3b82f6",
      cursorColor: "#60a5fa",
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1.5,
      height: 64,
      normalize: true,
      backend: "WebAudio"
    });

    wavesurferRef.current = ws;

    ws.load(audioUrl);

    ws.on("ready", () => {
      setDuration(ws.getDuration());
      ws.setVolume(0);
    });

    ws.on("interaction", () => {
      const t = ws.getCurrentTime();
      setCurrentTime(t);
      audioEngine.seekTo(t);
    });

    ws.on("finish", () => {
      if (loop) { ws.play(); return; }
      useMasterStore.getState().setPlaying(false);
    });

    return () => {
      ws.destroy();
      wavesurferRef.current = null;
    };
  }, [audioUrl]);

  // 2. Playback state listener — engine handles audio, wavesurfer just cursor
  useEffect(() => {
    if (!wavesurferRef.current) return;
    if (isPlaying) {
      audioEngine.play();
      wavesurferRef.current.play();
    } else {
      audioEngine.pause();
      wavesurferRef.current.pause();
    }
  }, [isPlaying]);

  // 3. Zoom level listener
  useEffect(() => {
    if (!wavesurferRef.current) return;
    wavesurferRef.current.zoom(zoom * 5);
  }, [zoom]);

  // 4. Spectrum Analyzer Canvas Drawing loop
  useEffect(() => {
    if (!spectrumCanvasRef.current) return;

    const canvas = spectrumCanvasRef.current;
    const ctx = canvas.getContext("2d")!;
    let animId: number;

    const draw = () => {
      animId = requestAnimationFrame(draw);

      if (!audioEngine.analyser) {
        // Draw idle line
        ctx.fillStyle = "#0a0a0a";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "#171717";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
        return;
      }

      const bufferLength = audioEngine.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      audioEngine.analyser.getByteFrequencyData(dataArray);

      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw grid lines
      ctx.strokeStyle = "#151515";
      ctx.lineWidth = 1;
      for (let i = 1; i < 6; i++) {
        const x = (canvas.width / 6) * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();

        const y = (canvas.height / 6) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Draw FFT Curve
      ctx.beginPath();
      ctx.strokeStyle = "rgba(59, 130, 246, 0.85)";
      ctx.lineWidth = 2.5;

      const sliceWidth = canvas.width / (bufferLength / 2); // Show lower half frequencies
      let x = 0;

      for (let i = 0; i < bufferLength / 2; i++) {
        const v = dataArray[i] / 255;
        const y = canvas.height - (v * canvas.height);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height);
      ctx.stroke();

      // Create a gradient fill under FFT Curve
      const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      grad.addColorStop(0, "rgba(59, 130, 246, 0.15)");
      grad.addColorStop(1, "rgba(59, 130, 246, 0.0)");
      ctx.fillStyle = grad;
      ctx.lineTo(canvas.width, canvas.height);
      ctx.lineTo(0, canvas.height);
      ctx.fill();
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [audioFile]);

  // 5. Drag & Drop events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileDrop(e.dataTransfer.files[0]);
    }
  };

  const handleManualSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileDrop(e.target.files[0]);
    }
  };

  const handleApplyAIMastering = async () => {
    if (!userIntent.trim()) return;
    setAiApplying(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/ai/master", {
        method: "POST",
        headers,
        body: JSON.stringify({
          genre: userGenre || undefined,
          userIntent,
          analysis: analysis || undefined
        })
      });
      const data = await res.json();
      if (data.settings) {
        loadPreset(data.settings, "AI Custom");
      }
    } catch (err) {
      console.error("AI Master apply error:", err);
    } finally {
      setAiApplying(false);
    }
  };

  const handleAICritique = async () => {
    if (!audioFile) return;
    setIsCritiquing(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/ai/critique", {
        method: "POST",
        headers,
        body: JSON.stringify({
          audioMetadata: { name: audioFile.name, size: audioFile.size, type: audioFile.type },
          genre: userGenre || undefined,
          userIntent: userIntent || undefined
        })
      });
      const data = await res.json();
      if (data.critique) {
        setAiCritique(data.critique);
      }
    } catch (err) {
      console.error("AI Critique error:", err);
    } finally {
      setIsCritiquing(false);
    }
  };

  const formatDb = (val: number) => {
    if (val === -Infinity || val < -90) return "-∞";
    return `${val.toFixed(1)} dB`;
  };

  return (
    <div className="flex-1 bg-[var(--bg-panel)] flex flex-col h-full relative overflow-y-auto">
      {/* If no audio file, display a glorious drag-and-drop landing area */}
      {!audioFile ? (
        <div 
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          className={`flex-1 flex flex-col items-center justify-center p-8 transition-all ${
            dragActive ? "bg-blue-950/20" : "bg-[var(--bg-panel)]"
          }`}
        >
          <div className="max-w-md w-full border border-dashed border-[var(--border-subtle)] rounded-2xl p-12 text-center bg-[var(--bg-elevated-20)] relative overflow-hidden flex flex-col items-center justify-center">
            {/* Ambient Background Glow */}
            <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-blue-400 mb-6 shrink-0 shadow-lg shadow-blue-500/5">
              <Upload className="w-10 h-10 stroke-[1.5]" />
            </div>

            <h3 className="text-lg font-semibold text-slate-100 font-sans tracking-tight mb-2">
              Bawa Track Anda Ke Sini
            </h3>
            <p className="text-xs text-slate-400 font-sans mb-8 leading-relaxed max-w-xs mx-auto">
              Seret dan taruh file audio stereo Anda di mana saja untuk memulai rantai mastering analog AI profesional.
            </p>

            <label className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-xs cursor-pointer transition-colors shadow-md shadow-blue-500/10 font-sans">
              Pilih File Audio
              <input 
                type="file" 
                accept="audio/*" 
                onChange={handleManualSelect} 
                className="hidden" 
              />
            </label>

            <p className="text-[10px] text-slate-500 mt-6 font-mono tracking-wider uppercase">
              WAV • FLAC • MP3 • AAC • M4A
            </p>
          </div>
        </div>
      ) : (
        <div className="p-4 space-y-3 flex-1 flex flex-col justify-start">
          {/* Section 1: Waveform visualizer container */}
          <div className="bg-[var(--bg-elevated-20)] border border-[var(--border-subtle)] rounded-xl p-3 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Music className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span className="text-xs font-semibold text-slate-300 font-sans">Waveform Editor</span>
              </div>
              <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest bg-[var(--bg-elevated)] px-2 py-0.5 rounded">
                32-Bit Float
              </span>
            </div>

            {isLoadingAudio && (
              <div className="absolute inset-0 bg-[var(--bg-panel)]/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                <RefreshCw className="w-5 h-5 text-[var(--accent)] animate-spin mb-1" />
                <p className="text-[10px] font-mono text-[var(--accent)]">MEMUAT...</p>
              </div>
            )}

            <div ref={containerRef} className="w-full" />
          </div>

          {/* Section 2: Realtime Metering & Spectrum Analyzer */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
            {/* Realtime Spectrum Analyzer (Canvas) */}
            <div className="lg:col-span-7 bg-[var(--bg-elevated-20)] border border-[var(--border-subtle)] rounded-xl p-3 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span className="text-xs font-semibold text-slate-300 font-sans">Spectrum Analyzer</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                  <span className="text-[8px] font-mono text-slate-500 uppercase">Stereo</span>
                </div>
              </div>
              
              <div className="flex-1 bg-[var(--bg-elevated)] rounded-lg overflow-hidden border border-[var(--border-subtle)] h-28 relative">
                <canvas ref={spectrumCanvasRef} width="400" height="112" className="w-full h-full block" />
              </div>
            </div>

            {/* EBU R128 & True Peak Loudness meters */}
            <div className="lg:col-span-5 bg-[var(--bg-elevated-20)] border border-[var(--border-subtle)] rounded-xl p-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-300 font-sans">Loudness & Metering</span>
                  <span className="text-[8px] font-mono text-slate-500 uppercase">EBU R128</span>
                </div>

                <div className="space-y-2">
                  {/* LUFS Integrated */}
                  <div>
                    <div className="flex justify-between text-[9px] font-mono text-slate-500 mb-0.5">
                      <span>INTEGRATED</span>
                      <span className="text-[var(--accent)] font-bold">{meters.lufsIntegrated.toFixed(1)} LUFS</span>
                    </div>
                    <div className="bg-[var(--bg-elevated)] h-1.5 rounded overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-emerald-500 to-yellow-500 h-full transition-all duration-100"
                        style={{ width: `${Math.max(0, Math.min(100, (meters.lufsIntegrated + 70) * (100 / 64)))}%` }}
                      />
                    </div>
                  </div>

                  {/* LUFS Short term */}
                  <div>
                    <div className="flex justify-between text-[9px] font-mono text-slate-500 mb-0.5">
                      <span>SHORT TERM</span>
                      <span className="text-[var(--accent)] font-bold">{meters.lufsShort.toFixed(1)} LUFS</span>
                    </div>
                    <div className="bg-[var(--bg-elevated)] h-1.5 rounded overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-emerald-500 to-yellow-500 h-full transition-all duration-100"
                        style={{ width: `${Math.max(0, Math.min(100, (meters.lufsShort + 70) * (100 / 64)))}%` }}
                      />
                    </div>
                  </div>

                  {/* True Peak Left & Right */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex justify-between text-[8px] font-mono text-slate-500 mb-0.5">
                        <span>PEAK L</span>
                        <span className="text-slate-400">{formatDb(meters.truePeakLeft)}</span>
                      </div>
                      <div className="bg-[var(--bg-elevated)] h-1.5 rounded overflow-hidden">
                        <div 
                          className="bg-[var(--accent)] h-full transition-all duration-75"
                          style={{ width: `${Math.max(0, Math.min(100, (meters.truePeakLeft + 60) * (100 / 60)))}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[8px] font-mono text-slate-500 mb-0.5">
                        <span>PEAK R</span>
                        <span className="text-slate-400">{formatDb(meters.truePeakRight)}</span>
                      </div>
                      <div className="bg-[var(--bg-elevated)] h-1.5 rounded overflow-hidden">
                        <div 
                          className="bg-[var(--accent)] h-full transition-all duration-75"
                          style={{ width: `${Math.max(0, Math.min(100, (meters.truePeakRight + 60) * (100 / 60)))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Correlation Phase Meter */}
              <div className="mt-2 pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between">
                <div>
                  <span className="text-[8px] font-mono text-slate-500">PHASE CORRELATION</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[8px] font-mono text-slate-600">-1 (OUT)</span>
                    <div className="w-20 bg-[var(--bg-elevated)] h-1 rounded relative overflow-hidden">
                      <div 
                        className="absolute h-full w-2 bg-[var(--accent)] transition-all duration-100"
                        style={{ left: `${((meters.correlation + 1) / 2) * 80}%` }}
                      />
                    </div>
                    <span className="text-[8px] font-mono text-[var(--accent)]">+1 (IN)</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[8px] font-mono text-slate-500">CORRELATION</span>
                  <p className="text-[10px] font-bold text-[var(--accent)] font-mono">{meters.correlation.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: AI Mastering Assistant */}
          <div className="bg-[var(--bg-elevated-20)] border border-[var(--border-subtle)] rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-300 font-sans flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
                AI Mastering Assistant
              </h3>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={userGenre}
                onChange={(e) => setUserGenre(e.target.value)}
                placeholder="Genre (opsional)"
                className="sm:flex-1 bg-[var(--bg-elevated)] border border-[var(--border-default)] focus:border-[var(--accent)]/50 rounded-lg py-1.5 px-2.5 text-[10px] text-slate-300 focus:outline-none placeholder-slate-600"
              />
              <textarea
                value={userIntent}
                onChange={(e) => setUserIntent(e.target.value)}
                placeholder="Suara yang diinginkan..."
                rows={1}
                className="sm:flex-[2] bg-[var(--bg-elevated)] border border-[var(--border-default)] focus:border-[var(--accent)]/50 rounded-lg py-1.5 px-2.5 text-[10px] text-slate-300 focus:outline-none placeholder-slate-600 resize-none"
              />
              <button
                onClick={handleApplyAIMastering}
                disabled={aiApplying || !userIntent.trim()}
                className="px-3 py-2 sm:py-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:bg-[var(--bg-elevated)] disabled:text-neutral-500 text-white rounded-lg text-[9px] font-bold font-mono transition-colors shrink-0 cursor-pointer"
              >
                {aiApplying ? "..." : "Generate"}
              </button>
            </div>
          </div>

          {/* Section 4: AI Critique */}
          <div className="bg-[var(--bg-elevated-20)] border border-[var(--border-subtle)] rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-300 font-sans flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
                Rekomendasi AI
              </h3>
              <button
                onClick={handleAICritique}
                disabled={isCritiquing}
                className="px-2.5 py-1 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:bg-[var(--bg-elevated)] disabled:text-neutral-500 text-white rounded-lg text-[8px] font-bold font-mono transition-colors cursor-pointer"
              >
                {isCritiquing ? "..." : "Minta Rekomendasi"}
              </button>
            </div>

            {aiCritique ? (
              <div className="space-y-2 text-[10px]">
                <div className="bg-[var(--bg-elevated)] p-2 rounded-lg border border-[var(--border-subtle)]">
                  <p className="text-slate-300">{aiCritique.overallAssessment}</p>
                </div>
                {aiCritique.weaknesses?.map((w: any, i: number) => (
                  <div key={i} className="bg-[var(--bg-elevated)] p-2 rounded-lg border border-[var(--border-subtle)]">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-semibold text-slate-200">{w.area}</span>
                      <span className={`text-[7px] font-mono px-1 py-0.5 rounded-full ${
                        w.severity === "critical" ? "bg-red-500/20 text-red-400" :
                        w.severity === "major" ? "bg-yellow-500/20 text-yellow-400" :
                        "bg-[var(--accent)]/20 text-[var(--accent)]"
                      }`}>{w.severity}</span>
                    </div>
                    <p className="text-slate-400">{w.issue}</p>
                    <p className="text-[var(--accent)] mt-0.5">{w.recommendation}</p>
                  </div>
                ))}
                {aiCritique.priorityActions?.length > 0 && (
                  <ul className="space-y-0.5">
                    {aiCritique.priorityActions.map((a: string, i: number) => (
                      <li key={i} className="text-slate-400 flex items-start gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-[var(--accent)] shrink-0 mt-1.5" />
                        {a}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="border border-dashed border-[var(--border-subtle)] rounded-lg p-4 text-center text-[10px] text-slate-500">
                <p>Tekan "Minta Rekomendasi" untuk analisis AI</p>
              </div>
            )}
          </div>

          {/* Section 5: Simplified Mastering Chain */}
          <SimplifiedMastering />
        </div>
      )}
    </div>
  );
}
