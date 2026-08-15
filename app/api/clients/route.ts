import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { clients, teamMembers } from "../../../db/schema";

async function viewer(request: Request) {
  const userId = request.headers.get("oai-authenticated-user-id");
  if (!userId) return null;
  const [member] = await getDb().select().from(teamMembers).where(eq(teamMembers.userId, userId)).limit(1);
  return member;
}

export async function GET(request: Request) {
  const member = await viewer(request);
  if (!member) return Response.json({ error: "Sign in required" }, { status: 401 });
  const rows = await getDb().select().from(clients).orderBy(asc(clients.name));
  return Response.json({ clients: member.role === "manager" ? rows : rows.map(client => ({ id: client.id, name: client.name, active: client.active })) });
}

export async function PATCH(request: Request) {
  if ((await viewer(request))?.role !== "manager") return Response.json({ error: "Manager access required" }, { status: 403 });
  const { id, hourlyRate, monthlyRecurringRevenue } = await request.json() as { id: number; hourlyRate?: number; monthlyRecurringRevenue?: number };
  const update: { hourlyRate?: number; monthlyRecurringRevenue?: number } = {};
  if (hourlyRate !== undefined) update.hourlyRate = Number(hourlyRate);
  if (monthlyRecurringRevenue !== undefined) update.monthlyRecurringRevenue = Number(monthlyRecurringRevenue);
  if (!id || Object.values(update).some(value => !Number.isFinite(value) || value < 0)) return Response.json({ error: "Invalid amount" }, { status: 400 });
  const [client] = await getDb().update(clients).set(update).where(eq(clients.id, id)).returning();
  return Response.json({ client });
}
