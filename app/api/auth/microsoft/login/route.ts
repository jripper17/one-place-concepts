import { base64url } from "jose";
import { microsoftConfig } from "../../../../microsoft-auth";

export async function GET(request: Request) {
  const { MICROSOFT_TENANT_ID: tenant, MICROSOFT_CLIENT_ID: clientId } = microsoftConfig();
  if (!tenant || !clientId) return Response.json({ error: "Microsoft sign-in is not configured" }, { status: 503 });
  const state = base64url.encode(crypto.getRandomValues(new Uint8Array(24)));
  const verifier = base64url.encode(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = base64url.encode(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  const origin = new URL(request.url).origin;
  const params = new URLSearchParams({ client_id: clientId, response_type: "code", redirect_uri: `${origin}/api/auth/microsoft/callback`, response_mode: "query", scope: "openid profile email", state, code_challenge: challenge, code_challenge_method: "S256", prompt: "select_account" });
  return new Response(null, { status: 302, headers: { location: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params}`, "set-cookie": `opc_oauth=${state}.${verifier}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600` } });
}
