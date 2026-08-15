import { asc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../db";
import { projects, projectTasks, teamMembers, timeEntries } from "../../../db/schema";
import { microsoftUser } from "../../microsoft-auth";

async function viewer(request: Request) {
  const identity = await microsoftUser(request); if (!identity) return null;
  const [member] = await getDb().select().from(teamMembers).where(eq(teamMembers.userId, identity.userId)).limit(1);
  return member?.active ? member : null;
}

export async function GET(request: Request) {
  const member = await viewer(request); if (!member) return Response.json({ error: "Sign in required" }, { status: 401 });
  const db = getDb();
  const allTasks = member.role === "manager" ? await db.select().from(projectTasks).orderBy(asc(projectTasks.dueDate)) : await db.select().from(projectTasks).where(eq(projectTasks.assigneeUserId, member.userId)).orderBy(asc(projectTasks.dueDate));
  const projectIds = [...new Set(allTasks.map(task => task.projectId))];
  const allProjects = member.role === "manager" ? await db.select().from(projects).orderBy(asc(projects.dueDate)) : projectIds.length ? await db.select().from(projects).where(inArray(projects.id, projectIds)).orderBy(asc(projects.dueDate)) : [];
  const entries = member.role === "manager" ? await db.select().from(timeEntries) : await db.select().from(timeEntries).where(eq(timeEntries.userId, member.userId));
  const people = member.role === "manager" ? await db.select({ userId: teamMembers.userId, name: teamMembers.name }).from(teamMembers).where(eq(teamMembers.active, true)) : [];
  return Response.json({ projects: allProjects, tasks: allTasks, entries: entries.map(entry => ({ project: entry.project, hours: entry.hours })), people });
}

export async function POST(request: Request) {
  const member = await viewer(request); if (member?.role !== "manager") return Response.json({ error: "Manager access required" }, { status: 403 });
  const body = await request.json() as Record<string, unknown>;
  if (body.type === "project") {
    if (!body.client || !body.name || !body.startDate || !body.dueDate) return Response.json({ error: "Missing project fields" }, { status: 400 });
    const [project] = await getDb().insert(projects).values({ client: String(body.client), name: String(body.name), budgetHours: Number(body.budgetHours ?? 0), startDate: String(body.startDate), dueDate: String(body.dueDate), status: "active" }).returning();
    return Response.json({ project }, { status: 201 });
  }
  if (body.type === "task") {
    if (!body.projectId || !body.title || !body.assigneeUserId || !body.dueDate) return Response.json({ error: "Missing task fields" }, { status: 400 });
    const [task] = await getDb().insert(projectTasks).values({ projectId: Number(body.projectId), title: String(body.title), assigneeUserId: String(body.assigneeUserId), estimatedHours: Number(body.estimatedHours ?? 0), dueDate: String(body.dueDate), status: "todo" }).returning();
    return Response.json({ task }, { status: 201 });
  }
  return Response.json({ error: "Unknown record type" }, { status: 400 });
}

export async function PATCH(request: Request) {
  const member = await viewer(request); if (!member) return Response.json({ error: "Sign in required" }, { status: 401 });
  const body = await request.json() as { id: number; status: "todo" | "in_progress" | "complete" };
  const [task] = await getDb().select().from(projectTasks).where(eq(projectTasks.id, body.id)).limit(1);
  if (!task || (member.role !== "manager" && task.assigneeUserId !== member.userId)) return Response.json({ error: "Task not found" }, { status: 404 });
  const [updated] = await getDb().update(projectTasks).set({ status: body.status }).where(eq(projectTasks.id, body.id)).returning();
  return Response.json({ task: updated });
}
