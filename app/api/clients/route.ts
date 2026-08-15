import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { clients, teamMembers } from "../../../db/schema";
import { microsoftUser } from "../../microsoft-auth";

async function viewer(request: Request) {
  const identity = await microsoftUser(request);
  if (!identity) return null;
  const [member] = await getDb().select().from(teamMembers).where(eq(teamMembers.userId, identity.userId)).limit(1);
  return member?.active ? member : null;
}

export async function GET(request: Request) {
  const member = await viewer(request);
  if (!member) return Response.json({ error: "Sign in required" }, { status: 401 });
  const rows = await getDb().select().from(clients).orderBy(asc(clients.name));
  return Response.json({ clients: member.role === "manager" ? rows : rows.filter(client => client.active).map(client => ({ id: client.id, name: client.name, active: client.active })) });
}

export async function PATCH(request: Request) {
  if ((await viewer(request))?.role !== "manager") return Response.json({ error: "Manager access required" }, { status: 403 });
  const { id, hourlyRate, monthlyRecurringRevenue, active } = await request.json() as { id: number; hourlyRate?: number; monthlyRecurringRevenue?: number; active?: boolean };
  const update: { hourlyRate?: number; monthlyRecurringRevenue?: number; active?: boolean } = {};
  if (hourlyRate !== undefined) update.hourlyRate = Number(hourlyRate);
  if (monthlyRecurringRevenue !== undefined) update.monthlyRecurringRevenue = Number(monthlyRecurringRevenue);
  if (active !== undefined) update.active = Boolean(active);
  const amounts = [update.hourlyRate, update.monthlyRecurringRevenue].filter(value => value !== undefined) as number[];
  if (!id || !Object.keys(update).length || amounts.some(value => !Number.isFinite(value) || value < 0)) return Response.json({ error: "Invalid client update" }, { status: 400 });
  const [client] = await getDb().update(clients).set(update).where(eq(clients.id, id)).returning();
  return Response.json({ client });
}
