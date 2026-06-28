import { getUserFromRequest } from "../lib/auth";

export async function onRequestGet(context: any) {
  const { request, env } = context;
  const userPayload = await getUserFromRequest(request, env);
  const userId = userPayload?.id || null;

  try {
    let settings: any = {
      theme: "dark",
      language: "id",
      target_lufs: -14.0,
      default_export_format: "wav",
      shortcut_json: null,
    };

    let activeProvider = "gemini";
    let providersList: { name: string; active: boolean; hasKey: boolean }[] = [];

    if (userId) {
      const userSettings: any = await env.DB.prepare("SELECT * FROM settings WHERE user_id = ?").bind(userId).first();
      if (userSettings) settings = userSettings;

      const dbProviders: any = await env.DB.prepare("SELECT * FROM ai_providers WHERE user_id = ?").bind(userId).all();
      if (dbProviders.results?.length > 0) {
        providersList = dbProviders.results.map((p: any) => {
          if (p.is_active === 1) activeProvider = p.provider_name;
          return { name: p.provider_name, active: p.is_active === 1, hasKey: !!p.api_key };
        });
      }
    }

    return new Response(JSON.stringify({ settings, activeProvider, providers: providersList }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Get settings error:", err);
    return new Response(JSON.stringify({ error: "Failed to load settings" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function onRequestPut(context: any) {
  const { request, env } = context;
  const userPayload = await getUserFromRequest(request, env);
  const userId = userPayload?.id || null;
  const { theme, language, target_lufs, default_export_format, shortcut_json } = await request.json();

  if (!userId) {
    return new Response(JSON.stringify({ success: true, message: "Guest settings temporary updated" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    await env.DB.prepare(
      "UPDATE settings SET theme = ?, language = ?, target_lufs = ?, default_export_format = ?, shortcut_json = ? WHERE user_id = ?"
    )
      .bind(
        theme || "dark",
        language || "en",
        target_lufs !== undefined ? target_lufs : -14.0,
        default_export_format || "wav",
        shortcut_json ? JSON.stringify(shortcut_json) : null,
        userId
      )
      .run();

    return new Response(JSON.stringify({ success: true, message: "Settings updated successfully" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: "Failed to update settings" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
