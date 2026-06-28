import React, { useState, useRef, useEffect } from "react";
import WaveSurfer from "wavesurfer.js";
import { Folder, ChevronLeft } from "lucide-react";
import { useMasterStore } from "./store/masterStore";
import { audioEngine } from "./lib/audio/MasteringEngine";
import Toolbar from "./components/Toolbar";
import LeftPanel from "./components/LeftPanel";
import CenterPanel from "./components/CenterPanel";
import AuthModal from "./components/AuthModal";
import SettingsModal from "./components/SettingsModal";

export default function App() {
  const {
    audioFile,
    setAudioFile,
    isLoadingAudio,
    setIsLoadingAudio,
    chain,
    masterBypass,
    updateMeters,
    userSettings
  } = useMasterStore();

  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  
  // Real-time rendering state
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);

  // References to handle binary buffers offline
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const originalAudioBufferRef = useRef<AudioBuffer | null>(null);

  // Register the real-time analyzer meter updating loop
  useEffect(() => {
    audioEngine.registerMeterCallback((metrics) => {
      updateMeters(metrics);
    });
    audioEngine.setTimeUpdateCallback((time) => {
      useMasterStore.getState().setCurrentTime(time);
    });
    audioEngine.setOnFinishedCallback(() => {
      useMasterStore.getState().setPlaying(false);
    });
  }, []);

  // ponytail: keyboard shortcuts — space, undo/redo, save
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      const s = useMasterStore.getState();
      if (e.code === 'Space' && s.audioFile) { e.preventDefault(); s.setPlaying(!s.isPlaying); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); s.undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) { e.preventDefault(); s.redo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); /* save: auto-persisted to localStorage */ }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Update DSP parameters live as sliders shift
  useEffect(() => {
    if (masterBypass) {
      const bypassed = {
        ...chain,
        eq: { ...chain.eq, enabled: false },
        compressor: { ...chain.compressor, enabled: false },
        limiter: { ...chain.limiter, enabled: false },
        imager: { ...chain.imager, enabled: false },
        saturation: { ...chain.saturation, enabled: false },
        noiseReduction: { ...chain.noiseReduction, enabled: false },
      };
      audioEngine.updateParams(bypassed);
    } else {
      audioEngine.updateParams(chain);
    }
  }, [chain, masterBypass]);

  /**
   * Decodes dropped audio file into raw binary buffer for the offline bouncing engine
   */
  const handleLoadAudioFile = async (file: File) => {
    const prevUrl = useMasterStore.getState().audioUrl;
    if (prevUrl) URL.revokeObjectURL(prevUrl);
    setIsLoadingAudio(true);
    const objectUrl = URL.createObjectURL(file);
    setAudioFile(file, objectUrl, null);

    try {
      // Decode audio sample rate and channel arrays
      const audioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const tempCtx = new audioCtxClass();
      const arrayBuf = await file.arrayBuffer();
      const decodedBuf = await tempCtx.decodeAudioData(arrayBuf);
      
      originalAudioBufferRef.current = decodedBuf;
      setAudioFile(file, objectUrl, decodedBuf);
      tempCtx.close();
    } catch (err) {
      console.error("Decoding audio signal failed:", err);
    } finally {
      setIsLoadingAudio(false);
    }
  };

  /**
   * Triggers the high-speed Offline render and downloads the mastered WAV file
   */
  const handleTriggerOfflineRender = async () => {
    if (!originalAudioBufferRef.current) return;
    setIsRendering(true);
    setRenderProgress(0);

    try {
      // Render offline through active chain
      const masteredBuffer = await audioEngine.renderOffline(
        originalAudioBufferRef.current,
        chain,
        (progress) => {
          setRenderProgress(progress);
        }
      );

      // Encode mastered buffer to WAV Blob
      const wavBlob = audioEngine.bufferToWavBlob(masteredBuffer);
      const dlUrl = URL.createObjectURL(wavBlob);

      // Download file
      const a = document.createElement("a");
      a.href = dlUrl;
      const cleanedName = audioFile ? audioFile.name.replace(/\.[^/.]+$/, "") : "mastered";
      a.download = `Mastered_${cleanedName}.wav`;
      a.click();
    } catch (err) {
      console.error("Master rendering failed:", err);
    } finally {
      setIsRendering(false);
      setRenderProgress(0);
    }
  };

  return (
    <div className={`h-screen flex flex-col bg-[var(--bg-app)] text-slate-400 font-sans overflow-hidden ${userSettings.theme}`} style={{ fontSize: `${userSettings.fontScale}%`, '--accent': userSettings.accentColor, '--accent-hover': userSettings.accentColor } as React.CSSProperties}>
      {/* 1. Header Toolbar Controls */}
      <Toolbar 
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onReplaceAudio={handleLoadAudioFile}
        onTriggerOfflineRender={handleTriggerOfflineRender}
        isRendering={isRendering}
        renderProgress={renderProgress}
      />

      {/* 2. Main Workstation Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile overlay backdrop when left panel is open */}
        {leftOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-20 md:hidden"
            onClick={() => setLeftOpen(false)}
          />
        )}

        {/* Presets Sidebar Collapsed Control */}
        <button
          onClick={() => setLeftOpen(!leftOpen)}
          className={`absolute bottom-4 left-4 z-40 w-8 h-8 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--accent)] hover:text-[var(--accent)] flex items-center justify-center transition-all shadow-md`}
          title={leftOpen ? "Sembunyikan Menu Samping" : "Tampilkan Menu Samping"}
        >
          {leftOpen ? <ChevronLeft className="w-4 h-4" /> : <Folder className="w-4 h-4" />}
        </button>

        {/* Left Side Panel (Projects, Presets, Queue) */}
        {leftOpen && <LeftPanel onLoadAudioBuffer={handleLoadAudioFile} />}

        {/* Center Panel (Waveform, Spectrum, EBU R128 Loudness Meters) */}
        <CenterPanel 
          onFileDrop={handleLoadAudioFile} 
          wavesurferRef={wavesurferRef} 
        />

      </div>

      {/* 3. Auth & Settings Modal Panels */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
