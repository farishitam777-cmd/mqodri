import { generateToken, hashPassword } from "../../lib/auth";

export async function onRequestPost(context: any) {
  const { request, env } = context;
  const { email, password, name } = await request.json();

  if (!email || !password) {
    return new Response(JSON.stringify({ error: "Email and password are required." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
    if (existing) {
      return new Response(JSON.stringify({ error: "User with this email already exists." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const id = crypto.randomUUID();
    const passwordHash = hashPassword(password);

    await env.DB.prepare("INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)")
      .bind(id, email, passwordHash, name || "")
      .run();

    await env.DB.prepare("INSERT INTO settings (id, user_id) VALUES (?, ?)")
      .bind(crypto.randomUUID(), id)
      .run();

    await env.DB.prepare("INSERT INTO ai_providers (id, user_id, provider_name, is_active) VALUES (?, ?, 'gemini', 1)")
      .bind(crypto.randomUUID(), id)
      .run();

    const token = await generateToken({ id, email }, env);

    return new Response(
      JSON.stringify({ token, user: { id, email, name: name || "" } }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Register error:", err);
    return new Response(JSON.stringify({ error: "Server registration failed." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
