import { getUserFromRequest } from "../../lib/auth";

export async function onRequestPut(context: any) {
  const { request, env, params } = context;
  const { id } = params;
  const { name, state, masterSettings } = await request.json();

  try {
    const project: any = await env.DB.prepare("SELECT * FROM projects WHERE id = ?").bind(id).first();
    if (!project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const updatedName = name !== undefined ? name : project.name;
    const updatedState = state !== undefined ? state : project.state;
    const updatedSettings = masterSettings !== undefined ? JSON.stringify(masterSettings) : project.master_settings;

    await env.DB.prepare("UPDATE projects SET name = ?, state = ?, master_settings = ? WHERE id = ?")
      .bind(updatedName, updatedState, updatedSettings, id)
      .run();

    const updatedProject = await env.DB.prepare("SELECT * FROM projects WHERE id = ?").bind(id).first();
    return new Response(JSON.stringify({ project: updatedProject }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Update project error:", err);
    return new Response(JSON.stringify({ error: "Failed to update project" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function onRequestDelete(context: any) {
  const { request, env, params } = context;
  const { id } = params;

  try {
    const result = await env.DB.prepare("DELETE FROM projects WHERE id = ?").bind(id).run();
    if (result.meta?.changes === 0) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ success: true, message: "Project deleted successfully" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: "Failed to delete project" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
