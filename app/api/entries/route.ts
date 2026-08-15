import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { clients, teamMembers, timeEntries } from "../../../db/schema";

async function viewer(request: Request) {
  const authenticatedUserId = request.headers.get("oai-authenticated-user-id");
  const host = request.headers.get("host") ?? "";
  if (!authenticatedUserId && !host.startsWith("localhost")) return null;
  const userId = authenticatedUserId ?? "local-owner";
  const [member] = await getDb().select().from(teamMembers).where(eq(teamMembers.userId, userId)).limit(1);
  return { userId, role: member?.role ?? "member" };
}

export async function GET(request: Request) {
  try {
    const user = await viewer(request);
    if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
    const query = getDb().select().from(timeEntries);
    const entries = user.role === "manager" ? await query.orderBy(desc(timeEntries.date), desc(timeEntries.id)).limit(200) : await query.where(eq(timeEntries.userId, user.userId)).orderBy(desc(timeEntries.date), desc(timeEntries.id)).limit(200);
    return Response.json({ entries });
  } catch { return Response.json({ entries: [] }); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as typeof timeEntries.$inferInsert;
    const user = await viewer(request);
    if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
    if (!body.date || !body.client || !body.project || !body.description || Number(body.hours) <= 0) return Response.json({ error: "Missing required fields" }, { status: 400 });
    const [matchedClient] = await getDb().select({ hourlyRate: clients.hourlyRate }).from(clients).where(eq(clients.name, body.client)).limit(1);
    const trustedRate = matchedClient?.hourlyRate ?? Number(body.rate);
    const [entry] = await getDb().insert(timeEntries).values({ userId: user.userId, date: body.date, client: body.client, project: body.project, description: body.description, hours: Number(body.hours), rate: trustedRate, billable: Boolean(body.billable) }).returning();
    return Response.json({ entry }, { status: 201 });
  } catch { return Response.json({ error: "Could not save this entry" }, { status: 500 }); }
}
