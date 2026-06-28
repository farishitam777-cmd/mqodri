import { getUserFromRequest } from "../../lib/auth";
import { getAIProvider } from "../../lib/gemini";

export async function onRequestPost(context: any) {
  const { request, env } = context;
  const userPayload = await getUserFromRequest(request, env);
  const userId = userPayload?.id || null;
  const { analysis, referenceAnalysis, genre, userIntent } = await request.json();

  if (!userIntent && !analysis) {
    return new Response(JSON.stringify({ error: "Deskripsi atau analisis audio diperlukan" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    let apiKey = "";
    if (userId) {
      const active: any = await env.DB.prepare("SELECT * FROM ai_providers WHERE user_id = ? AND is_active = 1")
        .bind(userId)
        .first();
      if (active) apiKey = active.api_key || "";
    }

    const aiProvider = getAIProvider(apiKey || env.GEMINI_API_KEY || "");
    const settings = await aiProvider.master(analysis, referenceAnalysis, genre, userIntent);
    return new Response(JSON.stringify({ settings }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("AI Master error:", err);
    return new Response(JSON.stringify({ error: "AI mastering parameters generation failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
