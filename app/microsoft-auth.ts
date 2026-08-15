import { jwtVerify, SignJWT } from "jose";
import { env } from "cloudflare:workers";

export type MicrosoftUser = { userId: string; email: string; name: string };
const cookieName = "opc_m365_session";
type AuthEnv = { MICROSOFT_TENANT_ID?: string; MICROSOFT_CLIENT_ID?: string; MICROSOFT_CLIENT_SECRET?: string; MICROSOFT_SESSION_SECRET?: string; MICROSOFT_OWNER_EMAIL?: string };
export function microsoftConfig() { return env as unknown as AuthEnv; }

function secretKey() {
  const value = microsoftConfig().MICROSOFT_SESSION_SECRET;
  if (!value) throw new Error("Microsoft session secret is not configured");
  return new TextEncoder().encode(value);
}

function cookieValue(request: Request, name: string) {
  const header = request.headers.get("cookie") ?? "";
  return header.split(";").map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

export async function microsoftUser(request: Request): Promise<MicrosoftUser | null> {
  const host = request.headers.get("host") ?? "";
  if (host.startsWith("localhost") && !microsoftConfig().MICROSOFT_SESSION_SECRET) return { userId: "local-owner", email: "owner@tempo.local", name: "Local owner" };
  const token = cookieValue(request, cookieName);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { issuer: "opc-time-revenue", audience: "opc-web" });
    if (!payload.sub || !payload.email) return null;
    return { userId: payload.sub, email: String(payload.email).toLowerCase(), name: String(payload.name ?? payload.email) };
  } catch { return null; }
}

export async function createSession(user: MicrosoftUser) {
  return new SignJWT({ email: user.email, name: user.name }).setProtectedHeader({ alg: "HS256" }).setSubject(user.userId).setIssuer("opc-time-revenue").setAudience("opc-web").setIssuedAt().setExpirationTime("12h").sign(secretKey());
}

export function sessionCookie(token: string) { return `${cookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=43200`; }
export function clearSessionCookie() { return `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`; }
