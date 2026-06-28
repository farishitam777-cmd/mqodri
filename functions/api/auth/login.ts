import { generateToken, comparePassword } from "../../lib/auth";

export async function onRequestPost(context: any) {
  const { request, env } = context;
  const { email, password } = await request.json();

  if (!email || !password) {
    return new Response(JSON.stringify({ error: "Email and password are required." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const user: any = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
    if (!user || !comparePassword(password, user.password_hash)) {
      return new Response(JSON.stringify({ error: "Invalid email or password." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const token = await generateToken({ id: user.id, email: user.email }, env);

    return new Response(
      JSON.stringify({ token, user: { id: user.id, email: user.email, name: user.name } }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Login error:", err);
    return new Response(JSON.stringify({ error: "Server login failed." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
