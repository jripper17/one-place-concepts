import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { teamMembers } from "../../../db/schema";

async function currentManager(request: Request) {
  const authenticatedUserId = request.headers.get("oai-authenticated-user-id");
  const host = request.headers.get("host") ?? "";
  if (!authenticatedUserId && !host.startsWith("localhost")) return false;
  const userId = authenticatedUserId ?? "local-owner";
  const [member] = await getDb().select().from(teamMembers).where(eq(teamMembers.userId, userId)).limit(1);
  return member?.role === "manager";
}
export async function GET(request: Request) {
  if (!(await currentManager(request))) return Response.json({ error: "Manager access required" }, { status: 403 });
  return Response.json({ members: await getDb().select().from(teamMembers) });
}
export async function PATCH(request: Request) {
  if (!(await currentManager(request))) return Response.json({ error: "Manager access required" }, { status: 403 });
  const { id, role } = await request.json() as { id: number; role: "manager" | "member" };
  if (!id || !["manager", "member"].includes(role)) return Response.json({ error: "Invalid role" }, { status: 400 });
  const [member] = await getDb().update(teamMembers).set({ role }).where(eq(teamMembers.id, id)).returning();
  return Response.json({ member });
}
