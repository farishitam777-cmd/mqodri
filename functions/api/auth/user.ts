import { getUserFromRequest } from "../../lib/auth";

export async function onRequestGet(context: any) {
  const { request, env } = context;
  const userPayload = await getUserFromRequest(request, env);

  if (!userPayload) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const user: any = await env.DB.prepare("SELECT id, email, name, created_at FROM users WHERE id = ?")
      .bind(userPayload.id)
      .first();

    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ user }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: "Failed to fetch user profile" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
