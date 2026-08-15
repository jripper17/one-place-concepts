import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { clients, teamMembers } from "../../../db/schema";
import { microsoftUser } from "../../microsoft-auth";

type NinjaEnv = { NINJAONE_INSTANCE_URL?: string; NINJAONE_CLIENT_ID?: string; NINJAONE_CLIENT_SECRET?: string };

async function isManager(request: Request) {
  const identity = await microsoftUser(request);
  if (!identity) return false;
  const [member] = await getDb().select().from(teamMembers).where(eq(teamMembers.userId, identity.userId)).limit(1);
  return member?.role === "manager";
}

function settings() {
  const runtime = env as unknown as NinjaEnv;
  return { baseUrl: runtime.NINJAONE_INSTANCE_URL?.replace(/\/$/, ""), clientId: runtime.NINJAONE_CLIENT_ID, clientSecret: runtime.NINJAONE_CLIENT_SECRET };
}

export async function GET(request: Request) {
  if (!(await isManager(request))) return Response.json({ error: "Manager access required" }, { status: 403 });
  const config = settings();
  return Response.json({ configured: Boolean(config.baseUrl && config.clientId && config.clientSecret) });
}

export async function POST(request: Request) {
  if (!(await isManager(request))) return Response.json({ error: "Manager access required" }, { status: 403 });
  const config = settings();
  if (!config.baseUrl || !config.clientId || !config.clientSecret) return Response.json({ error: "NinjaOne connection is not configured" }, { status: 409 });

  const tokenResponse = await fetch(`${config.baseUrl}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", authorization: `Basic ${btoa(`${config.clientId}:${config.clientSecret}`)}` },
    body: new URLSearchParams({ grant_type: "client_credentials", scope: "monitoring" }),
  });
  if (!tokenResponse.ok) return Response.json({ error: "NinjaOne rejected the API credentials" }, { status: 502 });
  const token = await tokenResponse.json() as { access_token: string };

  const organizations: Array<{ id: number; name: string; description?: string }> = [];
  let after: number | undefined;
  for (let page = 0; page < 50; page++) {
    const url = new URL(`${config.baseUrl}/v2/organizations`);
    url.searchParams.set("pageSize", "1000");
    if (after) url.searchParams.set("after", String(after));
    const response = await fetch(url, { headers: { accept: "application/json", authorization: `Bearer ${token.access_token}` } });
    if (!response.ok) return Response.json({ error: "Could not read NinjaOne organizations" }, { status: 502 });
    const pageRows = await response.json() as Array<{ id: number; name: string; description?: string }>;
    organizations.push(...pageRows);
    if (pageRows.length < 1000) break;
    after = pageRows.at(-1)?.id;
  }

  const db = getDb(); const syncedAt = new Date().toISOString();
  for (const organization of organizations) {
    await db.insert(clients).values({ ninjaOneId: organization.id, name: organization.name, description: organization.description ?? "", syncedAt }).onConflictDoUpdate({ target: clients.ninjaOneId, set: { name: organization.name, description: organization.description ?? "", active: true, syncedAt } });
  }
  return Response.json({ imported: organizations.length, clients: await db.select().from(clients) });
}
