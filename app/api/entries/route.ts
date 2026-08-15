import { desc } from "drizzle-orm";
import { getDb } from "../../../db";
import { timeEntries } from "../../../db/schema";

export async function GET() {
  try {
    const entries = await getDb().select().from(timeEntries).orderBy(desc(timeEntries.date), desc(timeEntries.id)).limit(200);
    return Response.json({ entries });
  } catch { return Response.json({ entries: [] }); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as typeof timeEntries.$inferInsert;
    if (!body.date || !body.client || !body.project || !body.description || Number(body.hours) <= 0) return Response.json({ error: "Missing required fields" }, { status: 400 });
    const [entry] = await getDb().insert(timeEntries).values({ date: body.date, client: body.client, project: body.project, description: body.description, hours: Number(body.hours), rate: Number(body.rate), billable: Boolean(body.billable) }).returning();
    return Response.json({ entry }, { status: 201 });
  } catch { return Response.json({ error: "Could not save this entry" }, { status: 500 }); }
}
