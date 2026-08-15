import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { teamMembers } from "../../../db/schema";
import { microsoftUser } from "../../microsoft-auth";

async function currentManager(request: Request) {
  const identity = await microsoftUser(request);
  if (!identity) return false;
  const [member] = await getDb().select().from(teamMembers).where(eq(teamMembers.userId, identity.userId)).limit(1);
  return member?.active === true && member.role === "manager";
}
export async function GET(request: Request) {
  if (!(await currentManager(request))) return Response.json({ error: "Manager access required" }, { status: 403 });
  return Response.json({ members: (await getDb().select().from(teamMembers)).filter(member => member.active) });
}
export async function DELETE(request: Request) {
  const manager = await currentManager(request);
  if (!manager) return Response.json({ error: "Manager access required" }, { status: 403 });
  const identity = await microsoftUser(request);
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) return Response.json({ error: "Team member ID required" }, { status: 400 });
  const [target] = await getDb().select().from(teamMembers).where(eq(teamMembers.id, id)).limit(1);
  if (!target) return Response.json({ error: "Team member not found" }, { status: 404 });
  if (target.userId === identity?.userId) return Response.json({ error: "You cannot remove your own access" }, { status: 400 });
  await getDb().update(teamMembers).set({ active: false }).where(eq(teamMembers.id, id));
  return Response.json({ removed: id });
}
export async function PATCH(request: Request) {
  if (!(await currentManager(request))) return Response.json({ error: "Manager access required" }, { status: 403 });
  const { id, role } = await request.json() as { id: number; role: "manager" | "member" };
  if (!id || !["manager", "member"].includes(role)) return Response.json({ error: "Invalid role" }, { status: 400 });
  const [member] = await getDb().update(teamMembers).set({ role }).where(eq(teamMembers.id, id)).returning();
  return Response.json({ member });
}
