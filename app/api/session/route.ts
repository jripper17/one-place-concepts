import { eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { teamMembers } from "../../../db/schema";

function identity(request: Request) {
  const authenticatedUserId = request.headers.get("oai-authenticated-user-id");
  const host = request.headers.get("host") ?? "";
  if (!authenticatedUserId && !host.startsWith("localhost")) return null;
  const userId = authenticatedUserId ?? "local-owner";
  const email = request.headers.get("oai-authenticated-user-email") ?? "owner@tempo.local";
  const encodedName = request.headers.get("oai-authenticated-user-full-name");
  const name = encodedName ? decodeURIComponent(encodedName) : email.split("@")[0];
  return { userId, email, name };
}

export async function GET(request: Request) {
  try {
    const user = identity(request);
    if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
    const db = getDb();
    let [member] = await db.select().from(teamMembers).where(eq(teamMembers.userId, user.userId)).limit(1);
    if (!member) {
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(teamMembers);
      [member] = await db.insert(teamMembers).values({ ...user, role: Number(count) === 0 ? "manager" : "member" }).returning();
    }
    return Response.json({ user: member });
  } catch { return Response.json({ error: "Could not load your account" }, { status: 500 }); }
}
