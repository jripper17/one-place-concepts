import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { quotes, teamMembers } from "../../../db/schema";
import { microsoftUser } from "../../microsoft-auth";

async function manager(request: Request) {
  const identity = await microsoftUser(request); if (!identity) return null;
  const [member] = await getDb().select().from(teamMembers).where(eq(teamMembers.userId, identity.userId)).limit(1);
  return member?.active && member.role === "manager" ? member : null;
}

export async function GET(request: Request) {
  if (!await manager(request)) return Response.json({ error: "Manager access required" }, { status: 403 });
  return Response.json({ quotes: await getDb().select().from(quotes).orderBy(desc(quotes.createdAt)) });
}

export async function POST(request: Request) {
  if (!await manager(request)) return Response.json({ error: "Manager access required" }, { status: 403 });
  const body = await request.json() as Record<string, unknown>;
  const quantity = Number(body.quantity); const rate = Number(body.rate);
  if (!body.client || !body.description || !body.expiresOn || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(rate) || rate < 0) return Response.json({ error: "Complete all quote fields" }, { status: 400 });
  const [quote] = await getDb().insert(quotes).values({ client: String(body.client), description: String(body.description), quantity, rate, expiresOn: String(body.expiresOn), status: "draft", createdAt: new Date().toISOString() }).returning();
  return Response.json({ quote }, { status: 201 });
}

export async function PATCH(request: Request) {
  if (!await manager(request)) return Response.json({ error: "Manager access required" }, { status: 403 });
  const body = await request.json() as { id: number; status: "draft" | "sent" | "accepted" };
  if (!body.id || !["draft", "sent", "accepted"].includes(body.status)) return Response.json({ error: "Invalid quote update" }, { status: 400 });
  const [quote] = await getDb().update(quotes).set({ status: body.status }).where(eq(quotes.id, body.id)).returning();
  return quote ? Response.json({ quote }) : Response.json({ error: "Quote not found" }, { status: 404 });
}
