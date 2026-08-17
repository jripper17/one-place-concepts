import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { quoteItems, quotes, teamMembers } from "../../../db/schema";
import { microsoftUser } from "../../microsoft-auth";

async function manager(request: Request) {
  const identity = await microsoftUser(request); if (!identity) return null;
  const [member] = await getDb().select().from(teamMembers).where(eq(teamMembers.userId, identity.userId)).limit(1);
  return member?.active && member.role === "manager" ? member : null;
}

export async function GET(request: Request) {
  if (!await manager(request)) return Response.json({ error: "Manager access required" }, { status: 403 });
  const db = getDb(); const allQuotes = await db.select().from(quotes).orderBy(desc(quotes.createdAt));
  const allItems = await db.select().from(quoteItems);
  return Response.json({ quotes: allQuotes.map(quote => ({ ...quote, items: allItems.filter(item => item.quoteId === quote.id) })) });
}

export async function POST(request: Request) {
  if (!await manager(request)) return Response.json({ error: "Manager access required" }, { status: 403 });
  const body = await request.json() as { client?: string; expiresOn?: string; items?: Array<Record<string, unknown>> };
  const items = (body.items ?? []).map(item => ({ category: String(item.category) as "hardware" | "software" | "service", description: String(item.description ?? "").trim(), quantity: Number(item.quantity), unitCost: Number(item.unitCost), markupPercent: Number(item.markupPercent), unitPrice: Number(item.unitPrice), billing: String(item.billing) as "one_time" | "monthly" }));
  const invalid = items.some(item => !["hardware", "software", "service"].includes(item.category) || !item.description || !Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unitCost) || item.unitCost < 0 || !Number.isFinite(item.markupPercent) || item.markupPercent < 0 || !Number.isFinite(item.unitPrice) || item.unitPrice < 0 || !["one_time", "monthly"].includes(item.billing));
  if (!body.client || !body.expiresOn || !items.length || invalid) return Response.json({ error: "Complete all quote fields" }, { status: 400 });
  const oneTimeTotal = items.filter(item => item.billing === "one_time").reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const db = getDb();
  const [quote] = await db.insert(quotes).values({ client: body.client, description: `${items.length} line item${items.length === 1 ? "" : "s"}`, quantity: 1, rate: oneTimeTotal, expiresOn: body.expiresOn, status: "draft", createdAt: new Date().toISOString() }).returning();
  const savedItems = [];
  for (const item of items) { const [saved] = await db.insert(quoteItems).values({ quoteId: quote.id, ...item }).returning(); savedItems.push(saved); }
  return Response.json({ quote: { ...quote, items: savedItems } }, { status: 201 });
}

export async function PATCH(request: Request) {
  if (!await manager(request)) return Response.json({ error: "Manager access required" }, { status: 403 });
  const body = await request.json() as { id: number; status: "draft" | "sent" | "accepted" };
  if (!body.id || !["draft", "sent", "accepted"].includes(body.status)) return Response.json({ error: "Invalid quote update" }, { status: 400 });
  const [quote] = await getDb().update(quotes).set({ status: body.status }).where(eq(quotes.id, body.id)).returning();
  return quote ? Response.json({ quote }) : Response.json({ error: "Quote not found" }, { status: 404 });
}
