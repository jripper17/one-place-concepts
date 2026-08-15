import { eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { teamMembers } from "../../../db/schema";
import { microsoftConfig, microsoftUser } from "../../microsoft-auth";

export async function GET(request: Request) {
  try {
    const user = await microsoftUser(request);
    if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
    const db = getDb();
    let [member] = await db.select().from(teamMembers).where(eq(teamMembers.userId, user.userId)).limit(1);
    if (!member) {
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(teamMembers);
      const ownerEmail = microsoftConfig().MICROSOFT_OWNER_EMAIL?.toLowerCase();
      [member] = await db.insert(teamMembers).values({ ...user, role: Number(count) === 0 || user.email === ownerEmail ? "manager" : "member" }).returning();
    }
    if (!member.active) return Response.json({ error: "Your access has been removed. Contact a manager." }, { status: 403 });
    return Response.json({ user: member });
  } catch { return Response.json({ error: "Could not load your account" }, { status: 500 }); }
}
