import React, { useRef } from "react";
import { 
  Play, 
  Pause, 
  Square, 
  RotateCw, 
  ZoomIn, 
  ZoomOut, 
  Undo, 
  Redo, 
  Save, 
  Download, 
  Sliders, 
  User, 
  Sparkles,
  HelpCircle,
  FileAudio,
  Upload
} from "lucide-react";
import { useMasterStore } from "../store/masterStore";
import { audioEngine } from "../lib/audio/MasteringEngine";

interface ToolbarProps {
  onOpenAuth: () => void;
  onOpenSettings: () => void;
  onReplaceAudio: (file: File) => void;
  onTriggerOfflineRender: () => void;
  isRendering: boolean;
  renderProgress: number;
}

export default function Toolbar({
  onOpenAuth,
  onOpenSettings,
  onReplaceAudio,
  onTriggerOfflineRender,
  isRendering,
  renderProgress
}: ToolbarProps) {
  const {
    user,
    setAuth,
    activeProject,
    isPlaying,
    setPlaying,
    currentTime,
    duration,
    zoom,
    setZoom,
    loop,
    setLoop,
    undoStack,
    redoStack,
    undo,
    redo,
    audioFile
  } = useMasterStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePlayPause = () => {
    if (!audioFile) return;
    setPlaying(!isPlaying);
  };

  const handleStop = () => {
    setPlaying(false);
    audioEngine.stop();
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    const ms = Math.floor((time % 1) * 1000);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
  };

  return (
    <div 
      id="daw-toolbar"
      className="bg-[var(--bg-panel)] border-b border-[var(--border-subtle)] h-16 px-6 flex items-center justify-between select-none relative z-10"
    >
      {/* Left section: App Name & Active File */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-lg">
            M
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white tracking-tight leading-none">
              Mastering Studio AI
            </h1>
            <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-medium">
              Project: {activeProject ? activeProject.name : "Late Night Jazz Session"}
            </p>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg max-w-[240px] overflow-hidden">
          <FileAudio className="w-4 h-4 text-blue-400 shrink-0" />
          <div className="overflow-hidden flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-300 truncate leading-none mb-0.5">
              {audioFile ? audioFile.name : "Tanpa File Audio"}
            </p>
            <p className="text-[9px] text-slate-500 font-mono leading-none">
              {audioFile ? `${(audioFile.size / (1024 * 1024)).toFixed(2)} MB` : "Gunakan drag & drop"}
            </p>
          </div>
          {audioFile && (
            <>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-1 hover:bg-[var(--bg-hover)] rounded text-slate-500 hover:text-blue-400 transition-colors shrink-0"
                title="Ganti File Audio"
              >
                <Upload className="w-3.5 h-3.5" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) onReplaceAudio(e.target.files[0]);
                  e.target.value = "";
                }}
              />
            </>
          )}
        </div>
      </div>

      {/* Center Section: DAW Transport & Playback Control */}
      <div className="flex items-center gap-6">
        {/* Buttons transport */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handlePlayPause}
            disabled={!audioFile}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
              isPlaying 
                ? "bg-blue-600 text-white hover:bg-blue-500" 
                : "bg-[var(--bg-elevated)] text-slate-300 hover:text-white border border-[var(--border-subtle)] disabled:opacity-30"
            }`}
            title="Play / Pause"
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>

          <button
            onClick={handleStop}
            disabled={!audioFile}
            className="w-9 h-9 bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-slate-400 hover:text-white border border-[var(--border-subtle)] rounded-lg flex items-center justify-center disabled:opacity-30 transition-all"
            title="Stop"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>

          <button
            onClick={() => setLoop(!loop)}
            disabled={!audioFile}
            className={`w-9 h-9 rounded-lg border flex items-center justify-center disabled:opacity-30 transition-all ${
              loop 
                ? "bg-blue-500/10 border-blue-500/50 text-blue-400" 
                : "bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-slate-400 hover:text-white"
            }`}
            title="Loop Playback"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loop ? "animate-spin-slow" : ""}`} />
          </button>
        </div>

        {/* Playhead Time Readout */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-4 py-1.5 rounded-lg font-mono text-center min-w-[130px]">
          <p className="text-[10px] text-slate-500 leading-none mb-0.5">PLAYHEAD</p>
          <p className="text-sm font-bold text-white tracking-wider tabular-nums leading-none">
            {formatTime(currentTime)}
          </p>
        </div>

        {/* Undo Redo controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={undo}
            disabled={undoStack.length === 0}
            className="w-8 h-8 rounded-lg flex items-center justify-center border border-[var(--border-subtle)] text-slate-400 hover:text-white disabled:opacity-30 bg-[var(--bg-elevated)] transition-all"
            title="Undo"
          >
            <Undo className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={redo}
            disabled={redoStack.length === 0}
            className="w-8 h-8 rounded-lg flex items-center justify-center border border-[var(--border-subtle)] text-slate-400 hover:text-white disabled:opacity-30 bg-[var(--bg-elevated)] transition-all"
            title="Redo"
          >
            <Redo className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Right Section: Zoom, Settings, Export & User Account */}
      <div className="flex items-center gap-3">
        {/* Zoom adjustment */}
        <div className="hidden lg:flex items-center gap-1.5 mr-2">
          <button
            onClick={() => setZoom(Math.max(1, zoom - 2))}
            disabled={!audioFile}
            className="w-7 h-7 bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-slate-400 border border-[var(--border-subtle)] rounded-md flex items-center justify-center disabled:opacity-30"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono text-slate-500 w-8 text-center">{zoom}x</span>
          <button
            onClick={() => setZoom(Math.min(30, zoom + 2))}
            disabled={!audioFile}
            className="w-7 h-7 bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-slate-400 border border-[var(--border-subtle)] rounded-md flex items-center justify-center disabled:opacity-30"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Settings and Info buttons */}
        <button
          onClick={onOpenSettings}
          className="w-9 h-9 bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded-lg flex items-center justify-center text-slate-300 hover:text-white transition-colors"
          title="Pengaturan Studio"
        >
          <Sliders className="w-4 h-4" />
        </button>

        {/* Master & Export Button */}
        <button
          onClick={onTriggerOfflineRender}
          disabled={!audioFile || isRendering}
          className="bg-blue-600 hover:bg-blue-500 disabled:bg-[var(--bg-elevated)] text-white disabled:text-slate-500 font-semibold px-4 h-9 rounded-md text-xs flex items-center gap-1.5 transition-colors"
        >
          {isRendering ? (
            <>
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Rendering {Math.floor(renderProgress * 100)}%</span>
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5" />
              <span>EXPORT MASTER</span>
            </>
          )}
        </button>

        {/* Authentication Control */}
        {user ? (
          <div className="flex items-center gap-2 pl-2 border-l border-[var(--border-subtle)]">
            <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 text-xs font-mono font-bold" title={user.email}>
              {user.name ? user.name[0].toUpperCase() : user.email[0].toUpperCase()}
            </div>
            <button
              onClick={() => setAuth(null, null)}
              className="text-[10px] font-mono text-slate-500 hover:text-red-400 transition-colors"
            >
              Keluar
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className="h-9 border border-[var(--border-subtle)] hover:border-[var(--border-default)] bg-[var(--bg-elevated)] text-slate-300 hover:text-white px-3.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all"
          >
            <User className="w-3.5 h-3.5" />
            <span>Masuk</span>
          </button>
        )}
      </div>
    </div>
  );
}
