import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { businessSettings, teamMembers } from "../../../db/schema";
import { microsoftUser } from "../../microsoft-auth";

async function manager(request: Request) {
  const identity = await microsoftUser(request);
  if (!identity) return false;
  const [member] = await getDb().select().from(teamMembers).where(eq(teamMembers.userId, identity.userId)).limit(1);
  return member?.role === "manager";
}

export async function GET(request: Request) {
  if (!await manager(request)) return Response.json({ error: "Manager access required" }, { status: 403 });
  const [settings] = await getDb().select().from(businessSettings).where(eq(businessSettings.id, 1)).limit(1);
  return Response.json({ federalTaxRate: settings?.federalTaxRate ?? 25 });
}

export async function PATCH(request: Request) {
  if (!await manager(request)) return Response.json({ error: "Manager access required" }, { status: 403 });
  const { federalTaxRate } = await request.json() as { federalTaxRate: number };
  const rate = Number(federalTaxRate);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) return Response.json({ error: "Rate must be between 0 and 100" }, { status: 400 });
  const [settings] = await getDb().insert(businessSettings).values({ id: 1, federalTaxRate: rate }).onConflictDoUpdate({ target: businessSettings.id, set: { federalTaxRate: rate } }).returning();
  return Response.json({ settings });
}
