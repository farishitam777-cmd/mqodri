import React, { useState, useEffect, useMemo, useCallback } from "react";
import { 
  Folder, 
  Sparkles, 
  Plus, 
  Trash, 
  ChevronRight, 
  ChevronDown,
  FolderOpen,
  Sliders,
} from "lucide-react";
import { useMasterStore } from "../store/masterStore";
import { getLocalPresets } from "../lib/presets/localPresets";

interface LeftPanelProps {
  onLoadAudioBuffer: (file: File) => void;
}

export default function LeftPanel({ onLoadAudioBuffer }: LeftPanelProps) {
  const {
    user,
    token,
    projects,
    setProjects,
    activeProject,
    setActiveProject,
    presets,
    setPresets,
    chain,
    loadPreset,
    activePresetName
  } = useMasterStore();

  const [activeTab, setActiveTab] = useState<"projects" | "presets">("projects");
  const [newProjectName, setNewProjectName] = useState("");
  const [newPresetName, setNewPresetName] = useState("");

  useEffect(() => {
    fetchProjects();
    fetchPresets();
  }, [user, token]);

  const fetchProjects = async () => {
    try {
      const headers: HeadersInit = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      
      const res = await fetch("/api/projects", { headers });
      const data = await res.json();
      if (data.projects) setProjects(data.projects);
    } catch (err) {
      console.error("Failed to load projects", err);
    }
  };

  const fetchPresets = async () => {
    try {
      const headers: HeadersInit = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/presets", { headers });
      const data = await res.json();
      if (data.presets) setPresets(data.presets);
    } catch (err) {
      console.error("Failed to load presets", err);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/projects", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: newProjectName,
          masterSettings: chain
        })
      });

      const data = await res.json();
      if (data.project) {
        setNewProjectName("");
        fetchProjects();
        setActiveProject(data.project);
      }
    } catch (err) {
      console.error("Failed to create project", err);
    }
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const headers: HeadersInit = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      await fetch(`/api/projects/${id}`, { method: "DELETE", headers });
      fetchProjects();
      if (activeProject?.id === id) setActiveProject(null);
    } catch (err) {
      console.error("Failed to delete project", err);
    }
  };

  const handleSavePreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim()) return;

    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/presets", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: newPresetName,
          category: "user",
          settings: chain
        })
      });

      if (res.ok) {
        setNewPresetName("");
        fetchPresets();
      }
    } catch (err) {
      console.error("Failed to create preset", err);
    }
  };

  const handleDeletePreset = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const headers: HeadersInit = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      await fetch(`/api/presets/${id}`, { method: "DELETE", headers });
      fetchPresets();
    } catch (err) {
      console.error("Failed to delete preset", err);
    }
  };

  return (
    <div className="w-80 border-r border-[var(--border-subtle)] bg-[var(--bg-panel)] flex flex-col h-full shrink-0 select-none">
      {/* Navigation Tabs */}
      <div className="grid grid-cols-2 border-b border-[var(--border-subtle)] h-11 bg-[var(--bg-elevated)] p-1 gap-1">
        <button
          onClick={() => setActiveTab("projects")}
          className={`flex items-center justify-center gap-1.5 rounded-md text-xs font-medium font-sans transition-all ${
            activeTab === "projects" 
              ? "bg-[var(--bg-elevated)] text-blue-400 font-semibold" 
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Folder className="w-3.5 h-3.5" />
          Proyek
        </button>
        <button
          onClick={() => setActiveTab("presets")}
          className={`flex items-center justify-center gap-1.5 rounded-md text-xs font-medium font-sans transition-all ${
            activeTab === "presets" 
              ? "bg-[var(--bg-elevated)] text-blue-400 font-semibold" 
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          Preset
        </button>
      </div>

      {/* Main Panel Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* TAB 1: Projects Manager */}
        {activeTab === "projects" && (
          <div className="space-y-4">
            <form onSubmit={handleCreateProject} className="flex gap-2">
              <input
                type="text"
                placeholder="Nama proyek baru..."
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border-default)] focus:border-blue-500/50 rounded-lg py-1.5 px-3 text-xs text-slate-300 focus:outline-none placeholder-slate-600 font-sans"
              />
              <button
                type="submit"
                className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center justify-center shrink-0 transition-colors"
                title="Proyek Baru"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
              </button>
            </form>

            <div className="space-y-1.5">
              <h3 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest px-1">
                {user ? "PROYEK AWAN SQLITE" : "PROYEK SEMENTARA (GUEST)"}
              </h3>
              
              {projects.length === 0 ? (
                <div className="border border-dashed border-[var(--border-default)] rounded-lg p-6 text-center text-xs text-slate-500">
                  <FolderOpen className="w-8 h-8 mx-auto mb-2 text-slate-700 stroke-[1.5]" />
                  <p>Tidak ada proyek.</p>
                  <p className="text-[10px] text-slate-600 mt-1">Buat di atas untuk mengorganisasi file.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {projects.map((proj) => (
                    <div
                      key={proj.id}
                      onClick={() => setActiveProject(proj)}
                      className={`w-full text-left p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                        activeProject?.id === proj.id
                          ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                          : "bg-[var(--bg-elevated-20)] border-[var(--border-subtle)] text-slate-300 hover:bg-[var(--bg-elevated)]"
                      }`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <Folder className="w-4 h-4 text-slate-500 shrink-0" />
                        <span className="text-xs font-medium truncate font-sans">{proj.name}</span>
                      </div>
                      <button
                        onClick={(e) => handleDeleteProject(proj.id, e)}
                        className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-950/20 rounded-md transition-all shrink-0"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: Custom / System Presets */}
        {activeTab === "presets" && (
          <div className="space-y-4">
            <form onSubmit={handleSavePreset} className="flex gap-2">
              <input
                type="text"
                placeholder="Simpan preset rantai..."
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border-default)] focus:border-blue-500/50 rounded-lg py-1.5 px-3 text-xs text-slate-300 focus:outline-none placeholder-slate-600 font-sans"
              />
              <button
                type="submit"
                className="px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium flex items-center justify-center shrink-0 transition-colors"
              >
                Simpan
              </button>
            </form>

            <div className="space-y-4">
              {/* ── LOCAL PRESETS (always available) ── */}
              <div>
                <h3 className="text-[10px] font-mono text-blue-400 uppercase tracking-widest px-1 mb-2 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  PRESET LOKAL GENRE
                </h3>
                <LocalPresetBrowser onSelect={(chain, name) => loadPreset(chain, name)} activePresetName={activePresetName} />
              </div>

              {/* System targets (from server) */}
              {presets.filter(p => p.is_system === 1 && p.category === "target_platform").length > 0 && (
                <div>
                  <h3 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest px-1 mb-2">
                    TARGET PLATFORM PENYIARAN
                  </h3>
                  <div className="grid grid-cols-1 gap-1.5">
                    {presets
                      .filter(p => p.is_system === 1 && p.category === "target_platform")
                      .map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => loadPreset(JSON.parse(preset.settings_json), preset.name)}
                          className={`w-full text-left p-2.5 bg-[var(--bg-elevated-20)] hover:bg-[var(--bg-elevated)] border rounded-lg text-xs font-medium flex items-center justify-between group transition-all ${
                            activePresetName === preset.name ? "border-blue-500/40 text-blue-300" : "border-[var(--border-subtle)] hover:border-[var(--border-default)] text-slate-300"
                          }`}
                        >
                          <span className="font-sans">{preset.name}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* User presets */}
              {user && (
                <div>
                  <h3 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest px-1 mb-2">
                    PRESET KUSTOM PENGGUNA
                  </h3>
                  {presets.filter(p => p.is_system === 0).length === 0 ? (
                    <p className="text-[10px] text-slate-600 px-1 italic">Belum ada preset kustom disimpan.</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-1.5">
                      {presets
                        .filter(p => p.is_system === 0)
                        .map((preset) => (
                          <div
                            key={preset.id}
                            onClick={() => loadPreset(JSON.parse(preset.settings_json), preset.name)}
                            className={`w-full p-2.5 bg-[var(--bg-elevated-20)] hover:bg-[var(--bg-elevated)] border text-xs font-medium flex items-center justify-between group cursor-pointer transition-all rounded-lg ${
                              activePresetName === preset.name ? "border-blue-500/40 text-blue-300" : "border-[var(--border-subtle)] hover:border-blue-500/30 text-slate-300"
                            }`}
                          >
                            <span className="font-sans truncate mr-2">{preset.name}</span>
                            <button
                              onClick={(e) => handleDeletePreset(preset.id, e)}
                              className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                            >
                              <Trash className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

/* ─── Local genre preset browser ─── */
function LocalPresetBrowser({ onSelect, activePresetName }: { onSelect: (chain: any, name: string) => void; activePresetName: string | null }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const presets = useMemo(() => {
    const all = getLocalPresets();
    const groups: { group: string; items: typeof all }[] = [];
    const seen = new Map<string, typeof all>();
    for (const p of all) {
      if (!seen.has(p.group)) seen.set(p.group, []);
      seen.get(p.group)!.push(p);
    }
    for (const [group, items] of seen) {
      groups.push({ group, items });
    }
    // Move "Global" first
    const globalIdx = groups.findIndex(g => g.group === "Global");
    if (globalIdx > 0) {
      const [g] = groups.splice(globalIdx, 1);
      groups.unshift(g);
    }
    return groups;
  }, []);

  useEffect(() => {
    // Expand Global by default
    setExpanded(prev => ({ ...prev, Global: true }));
  }, []);

  const toggle = useCallback((g: string) => {
    setExpanded(prev => ({ ...prev, [g]: !prev[g] }));
  }, []);

  return (
    <div className="space-y-1">
      {presets.map(({ group, items }) => (
        <div key={group} className="border border-[var(--border-subtle)] rounded-lg overflow-hidden bg-black/10">
          <button
            onClick={() => toggle(group)}
            className="w-full flex items-center justify-between px-2.5 py-2 text-[10px] font-mono text-slate-400 hover:text-slate-200 bg-[var(--bg-elevated-20)] hover:bg-[var(--bg-elevated)] transition-colors"
          >
            <span>{group}</span>
            {expanded[group] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
          {expanded[group] && (
            <div className="p-1 space-y-0.5">
              {items.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onSelect(p.chain, p.name)}
                  className={`w-full text-left px-2.5 py-1.5 text-[11px] font-sans rounded transition-all flex items-center justify-between group ${
                    activePresetName === p.name
                      ? "text-blue-300 bg-blue-500/10"
                      : "text-slate-300 hover:text-blue-300 hover:bg-blue-500/5"
                  }`}
                >
                  <span>{p.name}</span>
                  <ChevronRight className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 -mr-1 transition-all" />
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
