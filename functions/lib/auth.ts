import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

export interface UserPayload {
  id: string;
  email: string;
}

function getJWTSecret(env: any): Uint8Array {
  const secret = env.JWT_SECRET || "mastering_studio_ai_super_secret_token_123!@#";
  return new TextEncoder().encode(secret);
}

export async function generateToken(payload: UserPayload, env: any): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(getJWTSecret(env));
}

export async function verifyToken(token: string, env: any): Promise<UserPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJWTSecret(env));
    return payload as unknown as UserPayload;
  } catch {
    return null;
  }
}

export function hashPassword(password: string): string {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(password, salt);
}

export function comparePassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export async function getUserFromRequest(request: Request, env: any): Promise<UserPayload | null> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.split(" ")[1];
  return verifyToken(token, env);
}
