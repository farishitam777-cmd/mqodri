import { getUserFromRequest } from "../../lib/auth";

export async function onRequestPut(context: any) {
  const { request, env } = context;
  const userPayload = await getUserFromRequest(request, env);
  const userId = userPayload?.id || null;
  const { providerName, apiKey } = await request.json();

  if (!providerName) {
    return new Response(JSON.stringify({ error: "Provider name is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    if (userId) {
      await env.DB.prepare("UPDATE ai_providers SET is_active = 0 WHERE user_id = ?").bind(userId).run();

      const existing: any = await env.DB.prepare("SELECT * FROM ai_providers WHERE user_id = ? AND provider_name = ?")
        .bind(userId, providerName)
        .first();

      if (existing) {
        if (apiKey !== undefined) {
          await env.DB.prepare("UPDATE ai_providers SET is_active = 1, api_key = ? WHERE user_id = ? AND provider_name = ?")
            .bind(apiKey, userId, providerName)
            .run();
        } else {
          await env.DB.prepare("UPDATE ai_providers SET is_active = 1 WHERE user_id = ? AND provider_name = ?")
            .bind(userId, providerName)
            .run();
        }
      } else {
        await env.DB.prepare(
          "INSERT INTO ai_providers (id, user_id, provider_name, is_active, api_key) VALUES (?, ?, ?, 1, ?)"
        )
          .bind(crypto.randomUUID(), userId, providerName, apiKey || null)
          .run();
      }
    }

    return new Response(JSON.stringify({ success: true, message: `Activated ${providerName} as the default AI provider` }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("AI provider set error:", err);
    return new Response(JSON.stringify({ error: "Failed to configure AI provider" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
