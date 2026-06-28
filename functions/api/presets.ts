import { getUserFromRequest } from "../lib/auth";

export async function onRequestGet(context: any) {
  const { request, env } = context;
  const userPayload = await getUserFromRequest(request, env);
  const userId = userPayload?.id || null;

  try {
    let presets: any;
    if (userId) {
      presets = await env.DB.prepare("SELECT * FROM presets WHERE is_system = 1 OR user_id = ? ORDER BY created_at DESC")
        .bind(userId)
        .all();
    } else {
      presets = await env.DB.prepare("SELECT * FROM presets WHERE is_system = 1").all();
    }
    return new Response(JSON.stringify({ presets: presets.results }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: "Failed to retrieve presets" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function onRequestPost(context: any) {
  const { request, env } = context;
  const userPayload = await getUserFromRequest(request, env);
  const userId = userPayload?.id || null;
  const { name, category, settings } = await request.json();

  if (!name || !settings) {
    return new Response(JSON.stringify({ error: "Name and settings are required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const id = crypto.randomUUID();
    const settingsStr = typeof settings === "object" ? JSON.stringify(settings) : settings;

    await env.DB.prepare(
      "INSERT INTO presets (id, user_id, name, is_system, category, settings_json) VALUES (?, ?, ?, 0, ?, ?)"
    )
      .bind(id, userId, name, category || "user", settingsStr)
      .run();

    const preset = await env.DB.prepare("SELECT * FROM presets WHERE id = ?").bind(id).first();
    return new Response(JSON.stringify({ preset }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: "Failed to create preset" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
