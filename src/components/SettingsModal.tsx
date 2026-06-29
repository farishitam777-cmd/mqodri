import React, { useState, useEffect } from "react";
import { X, Cpu, Key, Sliders, Globe, Palette } from "lucide-react";
import { useMasterStore } from "../store/masterStore";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { userSettings, setUserSettings, token } = useMasterStore();
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [language, setLanguage] = useState<"id" | "en">("id");
  const [targetLUFS, setTargetLUFS] = useState(-14.0);
  const [exportFormat, setExportFormat] = useState<"wav">("wav");
  
  const [accentColor, setAccentColor] = useState("#3b82f6");
  const [fontScale, setFontScale] = useState(100);
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (isOpen) {
      setTheme(userSettings.theme);
      setLanguage(userSettings.language);
      setTargetLUFS(userSettings.target_lufs);
      setExportFormat(userSettings.default_export_format);
      setAccentColor(userSettings.accentColor);
      setFontScale(userSettings.fontScale);
    }
  }, [isOpen, userSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMsg("");

    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      // 1. Save general settings
      await fetch("/api/settings", {
        method: "PUT",
        headers,
        body: JSON.stringify({
          theme,
          language,
          target_lufs: targetLUFS,
          default_export_format: exportFormat,
          accent_color: accentColor,
          font_scale: fontScale
        })
      });

      // 2. Save Gemini API Key
      await fetch("/api/settings/ai-provider", {
        method: "PUT",
        headers,
        body: JSON.stringify({
          providerName: "gemini",
          apiKey: apiKey || undefined
        })
      });

      setUserSettings({
        theme,
        language,
        target_lufs: targetLUFS,
        default_export_format: exportFormat,
        shortcut_json: null,
        accentColor,
        fontScale
      });

      setSuccessMsg("Pengaturan berhasil disimpan!");
      setApiKey("");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      console.error("Save settings error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div 
        id="settings-modal"
        className="bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-xl w-full max-w-lg p-6 relative shadow-2xl overflow-hidden"
      >
        <button 
          id="close-settings"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-semibold text-slate-100 font-sans tracking-tight mb-6 flex items-center gap-2">
          <Sliders className="w-5 h-5 text-blue-400" />
          Pengaturan Studio
        </h2>

        {successMsg && (
          <div className="bg-emerald-950/40 border border-emerald-900 text-emerald-400 text-xs rounded-lg p-3 mb-4 font-mono">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Section 1: General Preferences */}
          <div>
            <h3 className="text-xs font-mono text-slate-400 mb-3 tracking-widest uppercase flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" />
              Preferensi Umum
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-slate-500 mb-1.5">BAHASA</label>
                <select
                  value={language}
                  onChange={(e: any) => setLanguage(e.target.value)}
                  className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] focus:border-blue-500 rounded-lg py-2 px-3 text-xs text-slate-300 focus:outline-none cursor-pointer"
                >
                  <option value="id">Bahasa Indonesia</option>
                  <option value="en">English (US)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-500 mb-1.5">FORMAT EXPORT DEFAULT</label>
                {/* ponytail: only WAV export is implemented — hide dead options */}
                <select
                  value={exportFormat}
                  onChange={(e: any) => setExportFormat(e.target.value)}
                  className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] focus:border-blue-500 rounded-lg py-2 px-3 text-xs text-slate-300 focus:outline-none cursor-pointer"
                >
                  <option value="wav">WAV (32-bit Float, Gapless)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Mastering Targets */}
          <div>
            <h3 className="text-xs font-mono text-slate-400 mb-3 tracking-widest uppercase flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5" />
              Target Mastering
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-slate-500 mb-1.5">TARGET LOUDSENS (LUFS)</label>
                <input
                  type="number"
                  step="0.5"
                  min="-24"
                  max="-6"
                  value={targetLUFS}
                  onChange={(e) => setTargetLUFS(parseFloat(e.target.value))}
                  className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] focus:border-blue-500 rounded-lg py-1.5 px-3 text-xs text-slate-300 focus:outline-none"
                />
                <p className="text-[10px] text-slate-500 mt-1">Standar Spotify / YouTube: -14 LUFS</p>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-500 mb-1.5">TEMA STUDIO</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTheme("dark")}
                    className={`py-1.5 px-3 rounded-lg border text-xs transition-all cursor-pointer ${
                      theme === "dark" 
                        ? "bg-blue-950/40 border-blue-500/30 text-blue-400" 
                        : "bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-slate-400"
                    }`}
                  >
                    Dark Theme
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme("light")}
                    className={`py-1.5 px-3 rounded-lg border text-xs transition-all cursor-pointer ${
                      theme === "light" 
                        ? "bg-blue-950/40 border-blue-500/30 text-blue-400" 
                        : "bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-slate-400"
                    }`}
                  >
                    Light Theme
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Appearance */}
          <div>
            <h3 className="text-xs font-mono text-slate-400 mb-3 tracking-widest uppercase flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5" />
              Tampilan
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-slate-500 mb-1.5">WARNA AKSEN</label>
                <div className="flex gap-1.5 items-center">
                  {["#3b82f6","#8b5cf6","#ec4899","#ef4444","#f59e0b","#10b981"].map(c => (
                    <button key={c} type="button" onClick={() => setAccentColor(c)}
                      className={`w-6 h-6 rounded-full border-2 transition-all cursor-pointer ${
                        accentColor === c ? "border-white scale-110" : "border-transparent"
                      }`} style={{ background: c }}
                    />
                  ))}
                  <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-500 mb-1.5">UKURAN FONT ({fontScale}%)</label>
                <input type="range" min={80} max={130} value={fontScale}
                  onChange={e => setFontScale(Number(e.target.value))}
                  className="w-full accent-[var(--accent)] h-1 bg-[var(--bg-elevated)] rounded-lg cursor-pointer" />
              </div>
            </div>
          </div>

          {/* Section 4: AI Engine Config */}
          <div>
            <h3 className="text-xs font-mono text-slate-400 mb-3 tracking-widest uppercase flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5" />
              Integrasi Kecerdasan Buatan (AI Engine)
            </h3>
            <div className="space-y-4">
              {/* ponytail: gemini-only provider, openrouter/mimo removed */}
              <div className="text-xs text-slate-500 font-mono bg-[var(--bg-elevated-20)] p-3 rounded-lg border border-[var(--border-subtle)]">
                AI Engine: <span className="text-blue-400">Google Gemini</span>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-500 mb-1.5 uppercase flex items-center gap-1">
                  <Key className="w-3 h-3" />
                  Kunci API Gemini (opsional)
                </label>
                <input
                  type="password"
                  placeholder="Biarkan kosong untuk menggunakan Kunci Sistem Gemini"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] focus:border-blue-500 rounded-lg py-2 px-3 text-xs text-slate-300 focus:outline-none"
                />
                <p className="text-[10px] text-slate-500 mt-1 font-mono">
                  * Kunci Anda dienkripsi menggunakan AES-256-CBC sebelum disimpan ke SQLite database.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-slate-400 border border-[var(--border-subtle)] rounded-lg text-xs font-medium transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white rounded-lg text-xs font-medium transition-all cursor-pointer"
            >
              {loading ? "Menyimpan..." : "Simpan Konfigurasi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
