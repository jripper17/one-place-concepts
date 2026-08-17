import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { businessSettings, teamMembers } from "../../../db/schema";
import { microsoftUser } from "../../microsoft-auth";

async function manager(request: Request) {
  const identity = await microsoftUser(request);
  if (!identity) return false;
  const [member] = await getDb().select().from(teamMembers).where(eq(teamMembers.userId, identity.userId)).limit(1);
  return member?.active === true && member.role === "manager";
}

export async function GET(request: Request) {
  if (!await manager(request)) return Response.json({ error: "Manager access required" }, { status: 403 });
  const [settings] = await getDb().select().from(businessSettings).where(eq(businessSettings.id, 1)).limit(1);
  return Response.json(settings ?? { federalTaxRate: 25, quoteCompanyName: "One Place Concepts", quoteTagline: "Time, technology, and business solutions", quoteContactName: "", quoteContactEmail: "" });
}

export async function PATCH(request: Request) {
  if (!await manager(request)) return Response.json({ error: "Manager access required" }, { status: 403 });
  const body = await request.json() as { federalTaxRate?: number; quoteCompanyName?: string; quoteTagline?: string; quoteContactName?: string; quoteContactEmail?: string };
  const update: Partial<typeof businessSettings.$inferInsert> = {};
  if (body.federalTaxRate !== undefined) {
    const rate = Number(body.federalTaxRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) return Response.json({ error: "Rate must be between 0 and 100" }, { status: 400 });
    update.federalTaxRate = rate;
  }
  for (const field of ["quoteCompanyName", "quoteTagline", "quoteContactName", "quoteContactEmail"] as const) {
    if (body[field] !== undefined) update[field] = String(body[field]).trim().slice(0, 160);
  }
  if (!Object.keys(update).length || update.quoteCompanyName === "") return Response.json({ error: "Invalid settings update" }, { status: 400 });
  const [settings] = await getDb().insert(businessSettings).values({ id: 1, ...update }).onConflictDoUpdate({ target: businessSettings.id, set: update }).returning();
  return Response.json({ settings });
}
