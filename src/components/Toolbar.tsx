import React, { useRef, useState, useEffect } from "react";
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
  Menu
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
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Click outside to close mobile menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setShowMobileMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
      {/* Centered Title */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-sm font-semibold text-white tracking-tight pointer-events-none select-none">
        Audio Mastering (Mqodri_project)
      </div>

      {/* Center Section: DAW Transport & Playback Control */}
      <div className="flex items-center gap-1 sm:gap-4 md:gap-6">
        {/* Buttons transport */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          <button
            onClick={handlePlayPause}
            disabled={!audioFile}
            className={`w-8 sm:w-9 h-8 sm:h-9 rounded-lg flex items-center justify-center transition-all ${
              isPlaying 
                ? "bg-blue-600 text-white hover:bg-blue-500" 
                : "bg-[var(--bg-elevated)] text-slate-300 hover:text-white border border-[var(--border-subtle)] disabled:opacity-30"
            }`}
            title="Play / Pause"
          >
            {isPlaying ? <Pause className="w-3.5 sm:w-4 h-3.5 sm:h-4 fill-current" /> : <Play className="w-3.5 sm:w-4 h-3.5 sm:h-4 fill-current ml-0.5" />}
          </button>

          <button
            onClick={handleStop}
            disabled={!audioFile}
            className="w-8 sm:w-9 h-8 sm:h-9 bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-slate-400 hover:text-white border border-[var(--border-subtle)] rounded-lg flex items-center justify-center disabled:opacity-30 transition-all"
            title="Stop"
          >
            <Square className="w-3 sm:w-3.5 h-3 sm:h-3.5 fill-current" />
          </button>

          <button
            onClick={() => setLoop(!loop)}
            disabled={!audioFile}
            className={`w-8 sm:w-9 h-8 sm:h-9 rounded-lg border flex items-center justify-center disabled:opacity-30 transition-all ${
              loop 
                ? "bg-blue-500/10 border-blue-500/50 text-blue-400" 
                : "bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-slate-400 hover:text-white"
            }`}
            title="Loop Playback"
          >
            <RotateCw className={`w-3 sm:w-3.5 h-3 sm:h-3.5 ${loop ? "animate-spin-slow" : ""}`} />
          </button>
        </div>

        {/* Playhead Time Readout */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-2 sm:px-3 md:px-4 py-1 sm:py-1.5 rounded-lg font-mono text-center min-w-[80px] sm:min-w-[110px] md:min-w-[130px]">
          <p className="text-[8px] sm:text-[10px] text-slate-500 leading-none mb-0.5 hidden sm:block">PLAYHEAD</p>
          <p className="text-[11px] sm:text-sm font-bold text-white tracking-wider tabular-nums leading-none">
            {formatTime(currentTime)}
          </p>
        </div>

        {/* Undo Redo controls */}
        <div className="flex items-center gap-0.5 sm:gap-1">
          <button
            onClick={undo}
            disabled={undoStack.length === 0}
            className="w-7 sm:w-8 h-7 sm:h-8 rounded-lg flex items-center justify-center border border-[var(--border-subtle)] text-slate-400 hover:text-white disabled:opacity-30 bg-[var(--bg-elevated)] transition-all"
            title="Undo"
          >
            <Undo className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
          </button>
          <button
            onClick={redo}
            disabled={redoStack.length === 0}
            className="w-7 sm:w-8 h-7 sm:h-8 rounded-lg flex items-center justify-center border border-[var(--border-subtle)] text-slate-400 hover:text-white disabled:opacity-30 bg-[var(--bg-elevated)] transition-all"
            title="Redo"
          >
            <Redo className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
          </button>
        </div>
      </div>

      {/* Right Section: Zoom, Settings, Export & User Account */}
      <div className="flex items-center gap-1 sm:gap-3">
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

        {/* Mobile overflow menu (< sm) */}
        <div ref={mobileMenuRef} className="relative sm:hidden">
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="w-8 h-8 bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded-lg flex items-center justify-center text-slate-300 hover:text-white transition-colors"
            title="Menu lainnya"
          >
            <Menu className="w-4 h-4" />
          </button>
          {showMobileMenu && (
            <div className="absolute right-0 top-full mt-2 bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-xl shadow-2xl p-2 min-w-[180px] z-50 space-y-1">
              {/* Settings */}
              <button
                onClick={() => { onOpenSettings(); setShowMobileMenu(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs text-slate-300 hover:bg-[var(--bg-hover)] hover:text-white transition-colors"
              >
                <Sliders className="w-3.5 h-3.5" />
                Pengaturan Studio
              </button>

              {/* Export */}
              <button
                onClick={() => { onTriggerOfflineRender(); setShowMobileMenu(false); }}
                disabled={!audioFile || isRendering}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs text-white bg-blue-600 hover:bg-blue-500 disabled:bg-[var(--bg-elevated)] disabled:text-slate-500 transition-colors"
              >
                {isRendering ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Rendering {Math.floor(renderProgress * 100)}%</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    EXPORT MASTER
                  </>
                )}
              </button>

              {/* Auth divider + control */}
              {user ? (
                <div className="border-t border-[var(--border-subtle)] pt-2 mt-2 px-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 text-[10px] font-mono font-bold">
                      {user.name ? user.name[0].toUpperCase() : user.email[0].toUpperCase()}
                    </div>
                    <span className="text-[10px] text-slate-400 truncate max-w-[90px]">{user.name || user.email}</span>
                  </div>
                  <button
                    onClick={() => { setAuth(null, null); setShowMobileMenu(false); }}
                    className="text-[10px] font-mono text-slate-500 hover:text-red-400 transition-colors"
                  >
                    Keluar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { onOpenAuth(); setShowMobileMenu(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs text-slate-300 hover:bg-[var(--bg-hover)] hover:text-white transition-colors"
                >
                  <User className="w-3.5 h-3.5" />
                  Masuk
                </button>
              )}
            </div>
          )}
        </div>

        {/* Desktop right section (sm+) */}
        <div className="hidden sm:flex items-center gap-1.5 md:gap-3">
          {/* Settings and Info buttons */}
          <button
            onClick={onOpenSettings}
            className="w-8 md:w-9 h-8 md:h-9 bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded-lg flex items-center justify-center text-slate-300 hover:text-white transition-colors"
            title="Pengaturan Studio"
          >
            <Sliders className="w-3.5 md:w-4 h-3.5 md:h-4" />
          </button>

          {/* Master & Export Button */}
          <button
            onClick={onTriggerOfflineRender}
            disabled={!audioFile || isRendering}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-[var(--bg-elevated)] text-white disabled:text-slate-500 font-semibold px-3 md:px-4 h-8 md:h-9 rounded-md text-[10px] md:text-xs flex items-center gap-1 sm:gap-1.5 transition-colors"
          >
            {isRendering ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span className="hidden sm:inline">Rendering {Math.floor(renderProgress * 100)}%</span>
                <span className="sm:hidden">{Math.floor(renderProgress * 100)}%</span>
              </>
            ) : (
              <>
                <Download className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                <span className="hidden sm:inline">EXPORT MASTER</span>
                <span className="sm:hidden">Export</span>
              </>
            )}
          </button>

          {/* Authentication Control */}
          {user ? (
            <div className="flex items-center gap-1.5 md:gap-2 pl-1.5 md:pl-2 border-l border-[var(--border-subtle)]">
              <div className="w-7 md:w-8 h-7 md:h-8 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 text-[10px] md:text-xs font-mono font-bold" title={user.email}>
                {user.name ? user.name[0].toUpperCase() : user.email[0].toUpperCase()}
              </div>
              <button
                onClick={() => setAuth(null, null)}
                className="text-[10px] font-mono text-slate-500 hover:text-red-400 transition-colors hidden md:inline"
              >
                Keluar
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="h-8 md:h-9 border border-[var(--border-subtle)] hover:border-[var(--border-default)] bg-[var(--bg-elevated)] text-slate-300 hover:text-white px-2.5 md:px-3.5 rounded-lg text-[10px] md:text-xs font-medium flex items-center gap-1 md:gap-1.5 transition-all"
            >
              <User className="w-3 md:w-3.5 h-3 md:h-3.5" />
              <span className="hidden sm:inline">Masuk</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
