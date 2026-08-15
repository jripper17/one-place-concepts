import { eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { teamMembers } from "../../../db/schema";

function identity(request: Request) {
  const userId = request.headers.get("oai-authenticated-user-id") ?? "local-owner";
  const email = request.headers.get("oai-authenticated-user-email") ?? "owner@tempo.local";
  const encodedName = request.headers.get("oai-authenticated-user-full-name");
  const name = encodedName ? decodeURIComponent(encodedName) : email.split("@")[0];
  return { userId, email, name };
}

export async function GET(request: Request) {
  try {
    const user = identity(request); const db = getDb();
    let [member] = await db.select().from(teamMembers).where(eq(teamMembers.userId, user.userId)).limit(1);
    if (!member) {
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(teamMembers);
      [member] = await db.insert(teamMembers).values({ ...user, role: Number(count) === 0 ? "manager" : "member" }).returning();
    }
    return Response.json({ user: member });
  } catch { return Response.json({ user: { id: 0, userId: "local-owner", email: "owner@tempo.local", name: "Jason", role: "manager" } }); }
}
