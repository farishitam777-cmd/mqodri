import { Router, Response } from "express";
import bcrypt from "bcryptjs";

function uuidv4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

import { db } from "./db.js";
import { authenticate, optionalAuthenticate, generateToken, AuthenticatedRequest } from "./auth.js";
import { getAIProvider, encrypt, decrypt } from "./ai.js";

const router = Router();

// ==========================================
// AUTHENTICATION ENDPOINTS
// ==========================================

// Register
router.post("/auth/register", (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }

  try {
    // Check if user exists
    const existing = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (existing) {
      res.status(400).json({ error: "User with this email already exists." });
      return;
    }

    const id = uuidv4();
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    // Save user
    db.prepare("INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)")
      .run(id, email, passwordHash, name || "");

    // Create default settings for this user
    db.prepare("INSERT INTO settings (id, user_id) VALUES (?, ?)")
      .run(uuidv4(), id);

    // ponytail: only gemini — we removed openrouter/mimo providers
    db.prepare("INSERT INTO ai_providers (id, user_id, provider_name, is_active) VALUES (?, ?, 'gemini', 1)")
      .run(uuidv4(), id);

    const token = generateToken({ id, email });

    res.status(201).json({
      token,
      user: { id, email, name: name || "" }
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Server registration failed." });
  }
});

// Login
router.post("/auth/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }

  try {
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    const token = generateToken({ id: user.id, email: user.email });

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server login failed." });
  }
});

// Logout (In JWT clients, they just discard the token, we acknowledge)
router.post("/auth/logout", (req, res) => {
  res.json({ success: true, message: "Logged out successfully" });
});

// Get Current User
router.get("/auth/user", authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const user = db.prepare("SELECT id, email, name, created_at FROM users WHERE id = ?").get(req.user!.id) as any;
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
});

// ==========================================
// PROJECTS ENDPOINTS
// ==========================================

// Get user projects
router.get("/projects", optionalAuthenticate, (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id || null;
  try {
    let projects;
    if (userId) {
      projects = db.prepare("SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC").all(userId);
    } else {
      // Return public temporary guest projects or empty array
      projects = [];
    }
    res.json({ projects });
  } catch (err) {
    res.status(500).json({ error: "Failed to load projects" });
  }
});

// Create project
router.post("/projects", optionalAuthenticate, (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id || null;
  const { name, originalFileName, originalFileSize, originalFileType, masterSettings } = req.body;

  if (!name) {
    res.status(400).json({ error: "Project name is required" });
    return;
  }

  try {
    const id = uuidv4();
    const settingsStr = masterSettings ? JSON.stringify(masterSettings) : null;

    db.prepare(`
      INSERT INTO projects (id, user_id, name, original_file_name, original_file_size, original_file_type, state, master_settings)
      VALUES (?, ?, ?, ?, ?, ?, 'draft', ?)
    `).run(id, userId, name, originalFileName || "", originalFileSize || 0, originalFileType || "", settingsStr);

    const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
    res.status(201).json({ project });
  } catch (err) {
    console.error("Create project error:", err);
    res.status(500).json({ error: "Failed to create project" });
  }
});

// Update project
router.put("/projects/:id", optionalAuthenticate, (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { name, state, masterSettings } = req.body;

  try {
    const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as any;
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const updatedName = name !== undefined ? name : project.name;
    const updatedState = state !== undefined ? state : project.state;
    const updatedSettings = masterSettings !== undefined ? JSON.stringify(masterSettings) : project.master_settings;

    db.prepare(`
      UPDATE projects 
      SET name = ?, state = ?, master_settings = ? 
      WHERE id = ?
    `).run(updatedName, updatedState, updatedSettings, id);

    const updatedProject = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
    res.json({ project: updatedProject });
  } catch (err) {
    console.error("Update project error:", err);
    res.status(500).json({ error: "Failed to update project" });
  }
});

// Delete project
router.delete("/projects/:id", optionalAuthenticate, (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  try {
    const result = db.prepare("DELETE FROM projects WHERE id = ?").run(id);
    if (result.changes === 0) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json({ success: true, message: "Project deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete project" });
  }
});

// ==========================================
// PRESETS ENDPOINTS
// ==========================================

// Get presets (both system and user-defined)
router.get("/presets", optionalAuthenticate, (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id || null;
  try {
    let presets;
    if (userId) {
      presets = db.prepare("SELECT * FROM presets WHERE is_system = 1 OR user_id = ? ORDER BY created_at DESC").all(userId);
    } else {
      presets = db.prepare("SELECT * FROM presets WHERE is_system = 1").all();
    }
    res.json({ presets });
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve presets" });
  }
});

// Create preset
router.post("/presets", optionalAuthenticate, (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id || null;
  const { name, category, settings } = req.body;

  if (!name || !settings) {
    res.status(400).json({ error: "Name and settings are required" });
    return;
  }

  try {
    const id = uuidv4();
    const settingsStr = typeof settings === "object" ? JSON.stringify(settings) : settings;

    db.prepare(`
      INSERT INTO presets (id, user_id, name, is_system, category, settings_json)
      VALUES (?, ?, ?, 0, ?, ?)
    `).run(id, userId, name, category || "user", settingsStr);

    const preset = db.prepare("SELECT * FROM presets WHERE id = ?").get(id);
    res.status(201).json({ preset });
  } catch (err) {
    res.status(500).json({ error: "Failed to create preset" });
  }
});

// Delete custom preset
router.delete("/presets/:id", authenticate, (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const userId = req.user!.id;
  try {
    const result = db.prepare("DELETE FROM presets WHERE id = ? AND user_id = ? AND is_system = 0").run(id, userId);
    if (result.changes === 0) {
      res.status(404).json({ error: "Preset not found or not owned by you" });
      return;
    }
    res.json({ success: true, message: "Preset deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete preset" });
  }
});

// ==========================================
// SETTINGS & API KEYS ENDPOINTS
// ==========================================

// Get user settings and active AI setup
router.get("/settings", optionalAuthenticate, (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id || null;

  try {
    let settings: any = {
      theme: "dark",
      language: "id", // Indonesian default as requested, or can toggle
      target_lufs: -14.0,
      default_export_format: "wav",
      shortcut_json: null
    };

    // ponytail: gemini-only; openrouter/mimo removed
    let activeProvider = "gemini";
    let providersList: { name: string; active: boolean; hasKey: boolean }[] = [];

    if (userId) {
      const userSettings = db.prepare("SELECT * FROM settings WHERE user_id = ?").get(userId) as any;
      if (userSettings) {
        settings = userSettings;
      }

      const dbProviders = db.prepare("SELECT * FROM ai_providers WHERE user_id = ?").all(userId) as any[];
      if (dbProviders && dbProviders.length > 0) {
        providersList = dbProviders.map(p => {
          if (p.is_active === 1) {
            activeProvider = p.provider_name;
          }
          return {
            name: p.provider_name,
            active: p.is_active === 1,
            hasKey: !!p.api_key
          };
        });
      }
    }

    res.json({
      settings,
      activeProvider,
      providers: providersList
    });
  } catch (err) {
    console.error("Get settings error:", err);
    res.status(500).json({ error: "Failed to load settings" });
  }
});

// Update settings
router.put("/settings", optionalAuthenticate, (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id || null;
  const { theme, language, target_lufs, default_export_format, shortcut_json } = req.body;

  if (!userId) {
    // Guest configuration (just respond success)
    res.json({ success: true, message: "Guest settings temporary updated" });
    return;
  }

  try {
    db.prepare(`
      UPDATE settings 
      SET theme = ?, language = ?, target_lufs = ?, default_export_format = ?, shortcut_json = ?
      WHERE user_id = ?
    `).run(
      theme || "dark",
      language || "en",
      target_lufs !== undefined ? target_lufs : -14.0,
      default_export_format || "wav",
      shortcut_json ? JSON.stringify(shortcut_json) : null,
      userId
    );

    res.json({ success: true, message: "Settings updated successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to update settings" });
  }
});

// Update AI Provider configuration & keys
router.put("/settings/ai-provider", optionalAuthenticate, (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id || null;
  const { providerName, apiKey } = req.body;

  if (!providerName) {
    res.status(400).json({ error: "Provider name is required" });
    return;
  }

  try {
    if (userId) {
      // Set all other providers to inactive for this user
      db.prepare("UPDATE ai_providers SET is_active = 0 WHERE user_id = ?").run(userId);

      // Check if this provider entry exists
      const existing = db.prepare("SELECT * FROM ai_providers WHERE user_id = ? AND provider_name = ?").get(userId, providerName);

      const encryptedKey = apiKey ? encrypt(apiKey) : null;

      if (existing) {
        if (apiKey !== undefined) {
          db.prepare(`
            UPDATE ai_providers 
            SET is_active = 1, api_key = ? 
            WHERE user_id = ? AND provider_name = ?
          `).run(encryptedKey, userId, providerName);
        } else {
          db.prepare(`
            UPDATE ai_providers 
            SET is_active = 1 
            WHERE user_id = ? AND provider_name = ?
          `).run(userId, providerName);
        }
      } else {
        db.prepare(`
          INSERT INTO ai_providers (id, user_id, provider_name, is_active, api_key)
          VALUES (?, ?, ?, 1, ?)
        `).run(uuidv4(), userId, providerName, encryptedKey);
      }
    } else {
      // In guest mode, store the temporal key in session context
      // (This is fine, we return success so the frontend knows we updated the client-side active provider state)
    }

    res.json({ success: true, message: `Activated ${providerName} as the default AI provider` });
  } catch (err) {
    console.error("AI provider set error:", err);
    res.status(500).json({ error: "Failed to configure AI provider" });
  }
});

// ==========================================
// AI-POWERED ASSISTANT ENGINES
// ==========================================

// ponytail: no await needed inside
function getActiveAI(userId: string | null) {
  let providerName = "gemini";
  let apiKey = "";

  if (userId) {
    const active = db.prepare("SELECT * FROM ai_providers WHERE user_id = ? AND is_active = 1").get(userId) as any;
    if (active) {
      providerName = active.provider_name;
      apiKey = active.api_key || "";
    }
  }

  return getAIProvider(providerName, apiKey);
}

// Generate Master Settings
router.post("/ai/master", optionalAuthenticate, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id || null;
  const { analysis, referenceAnalysis, genre, userIntent } = req.body;

  if (!userIntent && !analysis) {
    res.status(400).json({ error: "Deskripsi atau analisis audio diperlukan" });
    return;
  }

  try {
    const aiProvider = await getActiveAI(userId);
    const settings = await aiProvider.master(analysis, referenceAnalysis, genre, userIntent);
    res.json({ settings });
  } catch (err) {
    console.error("AI Master Route error:", err);
    res.status(500).json({ error: "AI mastering parameters generation failed" });
  }
});

// AI Critique / Recommendations
router.post("/ai/critique", optionalAuthenticate, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id || null;
  const { audioMetadata, genre, userIntent } = req.body;

  if (!audioMetadata) {
    res.status(400).json({ error: "Audio metadata is required" });
    return;
  }

  try {
    const aiProvider = await getActiveAI(userId);
    const critique = await aiProvider.critique(audioMetadata, genre, userIntent);
    res.json({ critique });
  } catch (err) {
    console.error("AI Critique Route error:", err);
    res.status(500).json({ error: "AI critique failed" });
  }
});

export default router;
