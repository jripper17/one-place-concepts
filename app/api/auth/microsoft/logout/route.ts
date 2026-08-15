import { clearSessionCookie } from "../../../../microsoft-auth";
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return new Response(null, { status: 302, headers: { location: origin, "set-cookie": clearSessionCookie() } });
}
