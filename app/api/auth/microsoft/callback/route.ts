import { createRemoteJWKSet, jwtVerify } from "jose";
import { createSession, microsoftConfig, sessionCookie } from "../../../../microsoft-auth";

function oauthCookie(request: Request) { return (request.headers.get("cookie") ?? "").split(";").map(v => v.trim()).find(v => v.startsWith("opc_oauth="))?.slice(10); }

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code"); const state = url.searchParams.get("state"); const stored = oauthCookie(request);
  const [storedState, verifier] = stored?.split(".") ?? [];
  if (!code || !state || state !== storedState || !verifier) return Response.json({ error: "Invalid or expired sign-in request" }, { status: 400 });
  const config = microsoftConfig(); const tenant = config.MICROSOFT_TENANT_ID!; const clientId = config.MICROSOFT_CLIENT_ID!; const clientSecret = config.MICROSOFT_CLIENT_SECRET!;
  const redirectUri = `${url.origin}/api/auth/microsoft/callback`;
  const tokenResponse = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri, grant_type: "authorization_code", code_verifier: verifier, scope: "openid profile email" }) });
  if (!tokenResponse.ok) return Response.json({ error: "Microsoft sign-in could not be completed" }, { status: 401 });
  const tokens = await tokenResponse.json() as { id_token: string };
  const issuer = `https://login.microsoftonline.com/${tenant}/v2.0`;
  const { payload } = await jwtVerify(tokens.id_token, createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`)), { issuer, audience: clientId });
  const email = String(payload.preferred_username ?? payload.email ?? "").toLowerCase();
  if (!payload.oid || !email) return Response.json({ error: "Microsoft account is missing required identity information" }, { status: 403 });
  const session = await createSession({ userId: `m365:${payload.oid}`, email, name: String(payload.name ?? email) });
  return new Response(null, { status: 302, headers: { location: "/", "set-cookie": sessionCookie(session) } });
}
