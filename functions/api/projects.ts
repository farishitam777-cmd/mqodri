import { getUserFromRequest } from "../lib/auth";

export async function onRequestGet(context: any) {
  const { request, env } = context;
  const userPayload = await getUserFromRequest(request, env);
  const userId = userPayload?.id || null;

  try {
    let projects: any;
    if (userId) {
      projects = await env.DB.prepare("SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC").bind(userId).all();
    } else {
      projects = { results: [] };
    }
    return new Response(JSON.stringify({ projects: projects.results }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: "Failed to load projects" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function onRequestPost(context: any) {
  const { request, env } = context;
  const userPayload = await getUserFromRequest(request, env);
  const userId = userPayload?.id || null;
  const { name, originalFileName, originalFileSize, originalFileType, masterSettings } = await request.json();

  if (!name) {
    return new Response(JSON.stringify({ error: "Project name is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const id = crypto.randomUUID();
    const settingsStr = masterSettings ? JSON.stringify(masterSettings) : null;

    await env.DB.prepare(
      "INSERT INTO projects (id, user_id, name, original_file_name, original_file_size, original_file_type, state, master_settings) VALUES (?, ?, ?, ?, ?, ?, 'draft', ?)"
    )
      .bind(id, userId, name, originalFileName || "", originalFileSize || 0, originalFileType || "", settingsStr)
      .run();

    const project = await env.DB.prepare("SELECT * FROM projects WHERE id = ?").bind(id).first();
    return new Response(JSON.stringify({ project }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Create project error:", err);
    return new Response(JSON.stringify({ error: "Failed to create project" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
