import { getUserFromRequest } from "../../lib/auth";

export async function onRequestDelete(context: any) {
  const { request, env, params } = context;
  const userPayload = await getUserFromRequest(request, env);
  if (!userPayload) {
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { id } = params;
  const userId = userPayload.id;

  try {
    const result = await env.DB.prepare("DELETE FROM presets WHERE id = ? AND user_id = ? AND is_system = 0")
      .bind(id, userId)
      .run();

    if (result.meta?.changes === 0) {
      return new Response(JSON.stringify({ error: "Preset not found or not owned by you" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, message: "Preset deleted successfully" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: "Failed to delete preset" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
