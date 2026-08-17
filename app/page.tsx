"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Entry = { id: number; date: string; client: string; project: string; description: string; hours: number; rate: number; billable: boolean };
type User = { id: number; name: string; email: string; role: "manager" | "member" };
type Member = User & { userId: string; active: boolean };
type Client = { id: number; ninjaOneId: number | null; name: string; description: string; hourlyRate: number; monthlyRecurringRevenue: number; active: boolean; syncedAt: string | null };
type Project = { id: number; client: string; name: string; budgetHours: number; startDate: string; dueDate: string; status: "planned" | "active" | "complete" };
type ProjectTask = { id: number; projectId: number; title: string; assigneeUserId: string; estimatedHours: number; dueDate: string; status: "todo" | "in_progress" | "complete" };
type QuoteItem = { id: number; quoteId: number; category: "hardware" | "software" | "service"; description: string; quantity: number; unitCost: number; markupPercent: number; unitPrice: number; billing: "one_time" | "monthly" };
type Quote = { id: number; client: string; description: string; quantity: number; rate: number; expiresOn: string; status: "draft" | "sent" | "accepted"; createdAt: string; items: QuoteItem[] };
type QuoteDraftItem = Omit<QuoteItem, "id" | "quoteId">;

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const blankQuoteItem = (): QuoteDraftItem => ({ category: "service", description: "", quantity: 1, unitCost: 0, markupPercent: 0, unitPrice: 0, billing: "one_time" });

function cleanEntryText(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.toLowerCase() === "undefined" || text.toLowerCase() === "null" ? "" : text;
}

function Icon({ children }: { children: React.ReactNode }) { return <span className="icon" aria-hidden="true">{children}</span>; }

export default function Home() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [view, setView] = useState<"overview" | "timesheet" | "projects" | "quotes" | "clients">("overview");
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [user, setUser] = useState<User>({ id: 0, name: "", email: "", role: "member" });
  const [authStatus, setAuthStatus] = useState<"loading" | "signedIn" | "signedOut">("loading");
  const [members, setMembers] = useState<Member[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [showInactiveClients, setShowInactiveClients] = useState(false);
  const [ninjaConfigured, setNinjaConfigured] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [fileMessage, setFileMessage] = useState("");
  const [reportClient, setReportClient] = useState("");
  const [federalTaxRate, setFederalTaxRate] = useState(25);
  const [quotePdfSettings, setQuotePdfSettings] = useState({ quoteCompanyName: "One Place Concepts", quoteTagline: "Time, technology, and business solutions", quoteContactName: "", quoteContactEmail: "" });
  const [savingQuotePdfSettings, setSavingQuotePdfSettings] = useState(false);
  const [editingClientId, setEditingClientId] = useState<number | null>(null);
  const [clientDraft, setClientDraft] = useState({ hourlyRate: "", monthlyRecurringRevenue: "" });
  const [savingClient, setSavingClient] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectTasks, setProjectTasks] = useState<ProjectTask[]>([]);
  const [projectPeople, setProjectPeople] = useState<Array<{ userId: string; name: string }>>([]);
  const [projectHours, setProjectHours] = useState<Array<{ project: string; hours: number }>>([]);
  const [projectForm, setProjectForm] = useState({ client: "", name: "", budgetHours: "", startDate: new Date().toISOString().slice(0,10), dueDate: "" });
  const [taskForm, setTaskForm] = useState({ projectId: "", title: "", assigneeUserId: "", estimatedHours: "", dueDate: "" });
  const [timesheetFilter, setTimesheetFilter] = useState({ client: "", project: "", month: "", from: "", to: "", sort: "date_desc" });
  const [overviewMonth, setOverviewMonth] = useState(new Date().toISOString().slice(0, 7));
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [printQuote, setPrintQuote] = useState<Quote | null>(null);
  const [editingQuoteId, setEditingQuoteId] = useState<number | null>(null);
  const [quoteForm, setQuoteForm] = useState({ client: "", expiresOn: new Date(Date.now() + 30 * 86400000).toISOString().slice(0,10), items: [blankQuoteItem()] });
  const importInput = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), client: "", project: "", description: "", hours: "", rate: "0", billable: true });

  useEffect(() => {
    fetch("/api/session").then(async r => ({ ok: r.ok, data: await r.json() })).then(({ ok, data }) => { if (!ok || !data.user) { setAuthStatus("signedOut"); return; } setAuthStatus("signedIn"); setUser(data.user); setView(data.user.role === "manager" ? "overview" : "timesheet"); fetch("/api/clients").then(r => r.json()).then(c => setClients(c.clients ?? [])); fetch("/api/projects").then(r => r.json()).then(p => { setProjects(p.projects ?? []); setProjectTasks(p.tasks ?? []); setProjectPeople(p.people ?? []); setProjectHours(p.entries ?? []); }); if (data.user.role === "manager") { fetch("/api/team").then(r => r.json()).then(t => setMembers(t.members ?? [])); fetch("/api/ninjaone").then(r => r.json()).then(n => setNinjaConfigured(Boolean(n.configured))); fetch("/api/settings").then(r => r.json()).then(s => setFederalTaxRate(Number(s.federalTaxRate ?? 25))); fetch("/api/quotes").then(r => r.json()).then(q => setQuotes(q.quotes ?? [])); } }).catch(() => setAuthStatus("signedOut"));
    fetch("/api/entries").then(r => r.ok ? r.json() : null).then(data => {
      if (data?.entries) setEntries(data.entries.map((e: Entry) => ({ ...e, project: cleanEntryText(e.project), description: cleanEntryText(e.description), hours: Number(e.hours), rate: Number(e.rate), billable: Boolean(e.billable) })));
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!printQuote) return;
    const timer = window.setTimeout(() => window.print(), 50);
    const finish = () => setPrintQuote(null);
    window.addEventListener("afterprint", finish, { once: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", finish);
    };
  }, [printQuote]);

  useEffect(() => {
    if (authStatus !== "signedIn" || user.role !== "manager") return;
    fetch("/api/settings").then(response => response.json()).then(settings => setQuotePdfSettings({
      quoteCompanyName: settings.quoteCompanyName ?? "One Place Concepts",
      quoteTagline: settings.quoteTagline ?? "Time, technology, and business solutions",
      quoteContactName: settings.quoteContactName ?? "",
      quoteContactEmail: settings.quoteContactEmail ?? "",
    })).catch(() => undefined);
  }, [authStatus, user.role]);

  async function changeRole(id: number, role: "manager" | "member") {
    const response = await fetch("/api/team", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, role }) });
    if (response.ok) setMembers(list => list.map(m => m.id === id ? { ...m, role } : m));
  }

  async function removeMember(member: Member) {
    if (!window.confirm(`Remove access for ${member.name}? They will no longer be able to use the application.`)) return;
    const response = await fetch(`/api/team?id=${member.id}`, { method: "DELETE" });
    if (response.ok) setMembers(list => list.filter(item => item.id !== member.id));
  }

  async function syncNinjaOne() {
    setSyncing(true); setSyncMessage("");
    const response = await fetch("/api/ninjaone", { method: "POST" });
    const data = await response.json();
    if (response.ok) { setClients(data.clients ?? []); setSyncMessage(`${data.imported} clients synced from NinjaOne`); }
    else setSyncMessage(data.error ?? "Sync failed");
    setSyncing(false);
  }

  function editClient(client: Client) {
    setEditingClientId(client.id);
    setClientDraft({ hourlyRate: String(client.hourlyRate), monthlyRecurringRevenue: String(client.monthlyRecurringRevenue ?? 0) });
  }

  async function saveClient(client: Client) {
    const hourlyRate = Number(clientDraft.hourlyRate);
    const monthlyRecurringRevenue = Number(clientDraft.monthlyRecurringRevenue);
    if (![hourlyRate, monthlyRecurringRevenue].every(value => Number.isFinite(value) && value >= 0)) return;
    setSavingClient(true);
    const response = await fetch("/api/clients", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: client.id, hourlyRate, monthlyRecurringRevenue }) });
    if (response.ok) {
      setClients(list => list.map(c => c.id === client.id ? { ...c, hourlyRate, monthlyRecurringRevenue } : c));
      setEditingClientId(null);
    }
    setSavingClient(false);
  }

  async function setClientActive(client: Client, active: boolean) {
    if (!window.confirm(`${active ? "Restore" : "Hide"} ${client.name}? Historical time entries will be preserved.`)) return;
    const response = await fetch("/api/clients", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: client.id, active }) });
    if (response.ok) setClients(list => list.map(item => item.id === client.id ? { ...item, active } : item));
  }

  async function saveTaxRate(rate: number) {
    setFederalTaxRate(rate);
    await fetch("/api/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ federalTaxRate: rate }) });
  }

  async function saveQuotePdfSettings(event: FormEvent) {
    event.preventDefault();
    setSavingQuotePdfSettings(true);
    const response = await fetch("/api/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(quotePdfSettings) });
    if (response.ok) {
      const data = await response.json();
      setQuotePdfSettings({ quoteCompanyName: data.settings.quoteCompanyName, quoteTagline: data.settings.quoteTagline, quoteContactName: data.settings.quoteContactName, quoteContactEmail: data.settings.quoteContactEmail });
    }
    setSavingQuotePdfSettings(false);
  }

  async function createProject(event: FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "project", ...projectForm, budgetHours: Number(projectForm.budgetHours) }) });
    if (response.ok) { const data = await response.json(); setProjects(list => [...list, data.project]); setProjectForm({ client: "", name: "", budgetHours: "", startDate: new Date().toISOString().slice(0,10), dueDate: "" }); }
  }

  async function createTask(event: FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "task", ...taskForm, projectId: Number(taskForm.projectId), estimatedHours: Number(taskForm.estimatedHours) }) });
    if (response.ok) { const data = await response.json(); setProjectTasks(list => [...list, data.task]); setTaskForm({ projectId: "", title: "", assigneeUserId: "", estimatedHours: "", dueDate: "" }); }
  }

  async function changeTaskStatus(task: ProjectTask, status: ProjectTask["status"]) {
    const response = await fetch("/api/projects", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: task.id, status }) });
    if (response.ok) setProjectTasks(list => list.map(item => item.id === task.id ? { ...item, status } : item));
  }

  async function createQuote(event: FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/quotes", { method: editingQuoteId ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(editingQuoteId ? { id: editingQuoteId, ...quoteForm } : quoteForm) });
    if (!response.ok) return;
    const data = await response.json();
    setQuotes(list => editingQuoteId ? list.map(quote => quote.id === editingQuoteId ? data.quote : quote) : [data.quote, ...list]);
    setEditingQuoteId(null);
    setQuoteForm({ client: "", expiresOn: new Date(Date.now() + 30 * 86400000).toISOString().slice(0,10), items: [blankQuoteItem()] });
  }

  function editQuote(quote: Quote) {
    if (quote.status !== "draft") return;
    setEditingQuoteId(quote.id);
    setQuoteForm({ client: quote.client, expiresOn: quote.expiresOn, items: quote.items.map(({ category, description, quantity, unitCost, markupPercent, unitPrice, billing }) => ({ category, description, quantity, unitCost, markupPercent, unitPrice, billing })) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelQuoteEdit() {
    setEditingQuoteId(null);
    setQuoteForm({ client: "", expiresOn: new Date(Date.now() + 30 * 86400000).toISOString().slice(0,10), items: [blankQuoteItem()] });
  }

  function updateQuoteItem(index: number, changes: Partial<QuoteDraftItem>, recalculate = false) {
    setQuoteForm(form => ({ ...form, items: form.items.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const next = { ...item, ...changes };
      return recalculate ? { ...next, unitPrice: Number((next.unitCost * (1 + next.markupPercent / 100)).toFixed(2)) } : next;
    }) }));
  }

  async function changeQuoteStatus(quote: Quote, status: Quote["status"]) {
    const response = await fetch("/api/quotes", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: quote.id, status }) });
    if (response.ok) setQuotes(list => list.map(item => item.id === quote.id ? { ...item, status } : item));
  }

  const projectStats = useMemo(() => projects.map(project => {
    const tasks = projectTasks.filter(task => task.projectId === project.id);
    const planned = tasks.reduce((sum, task) => sum + Number(task.estimatedHours), 0);
    const logged = projectHours.filter(item => item.project === project.name).reduce((sum, item) => sum + Number(item.hours), 0);
    const complete = tasks.filter(task => task.status === "complete").length;
    return { ...project, tasks, planned, logged, complete, utilization: project.budgetHours ? Math.round(logged / project.budgetHours * 100) : 0 };
  }), [projects, projectTasks, projectHours]);

  const overviewEntries = useMemo(() => entries.filter(entry => entry.date.startsWith(overviewMonth)), [entries, overviewMonth]);
  const overviewMonthLabel = useMemo(() => new Date(`${overviewMonth}-02T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" }), [overviewMonth]);
  const overviewMonthShort = useMemo(() => new Date(`${overviewMonth}-02T12:00:00`).toLocaleDateString("en-US", { month: "short" }), [overviewMonth]);
  const overviewMonthDays = useMemo(() => { const [year, month] = overviewMonth.split("-").map(Number); return new Date(year, month, 0).getDate(); }, [overviewMonth]);

  const metrics = useMemo(() => {
    const billableHours = overviewEntries.filter(e => e.billable).reduce((s, e) => s + e.hours, 0);
    const totalHours = overviewEntries.reduce((s, e) => s + e.hours, 0);
    const earned = overviewEntries.reduce((s, e) => s + (e.billable ? e.hours * e.rate : 0), 0);
    const selectedDate = new Date(`${overviewMonth}-02T12:00:00`);
    const now = new Date();
    const isCurrentMonth = selectedDate.getFullYear() === now.getFullYear() && selectedDate.getMonth() === now.getMonth();
    const totalWorkdays = 21;
    const elapsedWorkdays = isCurrentMonth ? Math.max(1, Math.min(totalWorkdays, Math.round(now.getDate() / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() * totalWorkdays))) : totalWorkdays;
    const forecast = Math.round((earned / elapsedWorkdays) * totalWorkdays);
    const monthlyRecurringRevenue = clients.filter(client => client.active).reduce((sum, client) => sum + Number(client.monthlyRecurringRevenue || 0), 0);
    const currentMonthRevenue = earned + monthlyRecurringRevenue;
    return { billableHours, totalHours, earned, forecast, monthlyRecurringRevenue, currentMonthRevenue, totalForecast: forecast + monthlyRecurringRevenue, estimatedFederalTax: currentMonthRevenue * federalTaxRate / 100, utilization: totalHours ? Math.round((billableHours / totalHours) * 100) : 0, remaining: totalWorkdays - elapsedWorkdays };
  }, [overviewEntries, overviewMonth, clients, federalTaxRate]);

  const byClient = useMemo(() => Object.values(overviewEntries.filter(e => e.billable).reduce<Record<string, { name: string; hours: number; revenue: number; rate: number }>>((acc, e) => {
    acc[e.client] ||= { name: e.client, hours: 0, revenue: 0, rate: e.rate };
    acc[e.client].hours += e.hours; acc[e.client].revenue += e.hours * e.rate; return acc;
  }, {})).sort((a, b) => b.revenue - a.revenue), [overviewEntries]);

  const visibleEntries = useMemo(() => {
    if (user.role !== "manager") return entries;
    const filtered = entries.filter(entry => (!timesheetFilter.client || entry.client === timesheetFilter.client) && (!timesheetFilter.project || entry.project === timesheetFilter.project) && (!timesheetFilter.month || entry.date.startsWith(timesheetFilter.month)) && (!timesheetFilter.from || entry.date >= timesheetFilter.from) && (!timesheetFilter.to || entry.date <= timesheetFilter.to));
    return [...filtered].sort((a,b) => {
      if (timesheetFilter.sort === "date_asc") return a.date.localeCompare(b.date);
      if (timesheetFilter.sort === "client") return a.client.localeCompare(b.client) || b.date.localeCompare(a.date);
      if (timesheetFilter.sort === "project") return a.project.localeCompare(b.project) || b.date.localeCompare(a.date);
      if (timesheetFilter.sort === "hours_desc") return b.hours - a.hours;
      return b.date.localeCompare(a.date);
    });
  }, [entries, timesheetFilter, user.role]);

  const visibleTotals = useMemo(() => ({ total: visibleEntries.reduce((sum,entry) => sum + entry.hours,0), billable: visibleEntries.filter(entry => entry.billable).reduce((sum,entry) => sum + entry.hours,0) }), [visibleEntries]);

  const entryProjectOptions = useMemo(() => Array.from(new Set([
    ...projects.filter(project => project.client === form.client).map(project => cleanEntryText(project.name)),
    ...entries.filter(entry => entry.client === form.client).map(entry => cleanEntryText(entry.project))
  ].filter(Boolean))).sort((a, b) => a.localeCompare(b)), [entries, form.client, projects]);

  function openNewEntry() {
    const firstClient = clients.find(client => client.active);
    setEditingEntry(null);
    setForm({ date: new Date().toISOString().slice(0, 10), client: firstClient?.name ?? "Internal", project: "", description: "", hours: "", rate: String(firstClient?.hourlyRate ?? 0), billable: Boolean(firstClient) });
    setOpen(true);
  }

  function openEditEntry(entry: Entry) {
    const clientRate = clients.find(client => client.name === entry.client)?.hourlyRate;
    setEditingEntry(entry);
    setForm({ date: entry.date, client: entry.client, project: cleanEntryText(entry.project), description: cleanEntryText(entry.description), hours: String(entry.hours), rate: String(clientRate ?? entry.rate), billable: entry.billable });
    setOpen(true);
  }

  async function saveEntry(event: FormEvent) {
    event.preventDefault();
    const payload: Entry = { id: editingEntry?.id ?? 0, ...form, hours: Number(form.hours), rate: Number(form.rate) };
    const response = await fetch("/api/entries", { method: editingEntry ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    if (!response.ok) return;
    const data = await response.json();
    setEntries(prev => editingEntry ? prev.map(e => e.id === data.entry.id ? data.entry : e) : [data.entry, ...prev]);
    setOpen(false); setEditingEntry(null); setSaved(true); setTimeout(() => setSaved(false), 2500);
  }

  async function deleteEntry(entry: Entry) {
    if (!window.confirm(`Delete ${entry.hours} hours for ${entry.client}?`)) return;
    const response = await fetch(`/api/entries?id=${entry.id}`, { method: "DELETE" });
    if (response.ok) setEntries(prev => prev.filter(e => e.id !== entry.id));
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = filename; link.click();
    URL.revokeObjectURL(url);
  }

  async function exportExcel() {
    const XLSX = await import("xlsx");
    const rows = entries.map(e => ({ Date: e.date, Client: e.client, Project: e.project, Description: e.description, Hours: e.hours, "Hourly Rate": e.rate, Billable: e.billable ? "Yes" : "No" }));
    const sheet = XLSX.utils.json_to_sheet(rows, { header: ["Date", "Client", "Project", "Description", "Hours", "Hourly Rate", "Billable"] });
    sheet["!cols"] = [{wch:12},{wch:24},{wch:24},{wch:48},{wch:10},{wch:14},{wch:10}];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Time Entries");
    XLSX.writeFile(workbook, `one-place-timesheet-${new Date().toISOString().slice(0,10)}.xlsx`);
    setFileMessage(`${entries.length} entries exported to Excel.`);
  }

  async function importExcel(file: File) {
    setFileMessage("Reading Excel file…");
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const normalized = rows.map((row, index) => {
        const rawDate = row.Date;
        const date = rawDate instanceof Date ? rawDate.toISOString().slice(0,10) : String(rawDate).slice(0,10);
        const billableText = String(row.Billable).trim().toLowerCase();
        return { id: 0, date, client: String(row.Client).trim(), project: String(row.Project).trim(), description: String(row.Description).trim(), hours: Number(row.Hours), rate: Number(row["Hourly Rate"] ?? 0), billable: ["yes","true","1","y"].includes(billableText), row: index + 2 };
      });
      const invalid = normalized.find(e => !e.date || !e.client || !e.project || !e.description || !Number.isFinite(e.hours) || e.hours <= 0 || !Number.isFinite(e.rate));
      if (invalid) throw new Error(`Row ${invalid.row} is missing a required value or has invalid hours/rate.`);
      const responses = [];
      for (const entry of normalized) {
        const response = await fetch("/api/entries", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(entry) });
        if (!response.ok) throw new Error(`Could not import row ${entry.row}.`);
        responses.push((await response.json()).entry as Entry);
      }
      setEntries(prev => [...responses.reverse(), ...prev]);
      setFileMessage(`${responses.length} entries imported successfully.`);
    } catch (error) { setFileMessage(error instanceof Error ? error.message : "The Excel file could not be imported."); }
    finally { if (importInput.current) importInput.current.value = ""; }
  }

  async function exportWord() {
    const selected = reportClient || Array.from(new Set(entries.map(e => e.client))).sort()[0];
    const clientEntries = entries.filter(e => e.client === selected).sort((a,b) => a.date.localeCompare(b.date));
    if (!selected || !clientEntries.length) { setFileMessage("Choose a client that has time entries."); return; }
    const { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, HeadingLevel, AlignmentType, ShadingType } = await import("docx");
    const total = clientEntries.reduce((sum,e) => sum + e.hours, 0);
    const header = (text: string) => new TableCell({ shading: { type: ShadingType.CLEAR, fill: "122D3A" }, children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: "FFFFFF" })] })] });
    const rows = clientEntries.map(e => new TableRow({ children: [
      new TableCell({ children: [new Paragraph(new Date(`${e.date}T12:00:00`).toLocaleDateString("en-US"))] }),
      new TableCell({ children: [new Paragraph(e.project)] }),
      new TableCell({ children: [new Paragraph(e.description)] }),
      new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, text: e.hours.toFixed(2) })] })
    ] }));
    const doc = new Document({ sections: [{ properties: {}, children: [
      new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: "Time Entry Details", color: "122D3A" })] }),
      new Paragraph({ children: [new TextRun({ text: selected, bold: true, size: 28, color: "76AD22" })], spacing: { after: 160 } }),
      new Paragraph({ children: [new TextRun({ text: `Total hours: ${total.toFixed(2)}`, bold: true })], spacing: { after: 240 } }),
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ tableHeader: true, children: [header("Date"), header("Project"), header("Time entry details"), header("Hours")] }), ...rows] })
    ] }] });
    downloadBlob(await Packer.toBlob(doc), `${selected.replace(/[^a-z0-9]+/gi,"-").toLowerCase()}-time-details.docx`);
    setFileMessage(`Word report prepared for ${selected}.`);
  }

  if (authStatus !== "signedIn") return <main className="auth-page"><section className="auth-card"><img src="/opc-logo.jpeg" alt="One Place Concepts"/><p className="eyebrow">TIME & REVENUE</p><h1>{authStatus === "loading" ? "Checking your account…" : "Sign in to continue"}</h1><p>{authStatus === "loading" ? "Connecting securely." : "Use your One Place Concepts Microsoft 365 account."}</p>{authStatus === "signedOut" && <a className="microsoft-signin" href="/api/auth/microsoft/login"><span>▦</span> Sign in with Microsoft</a>}</section></main>;

  return <main>
    <aside className="sidebar">
      <div className="brand"><img src="/opc-logo.jpeg" alt="One Place Concepts"/><span><strong>One Place</strong><small>Concepts</small></span></div>
      <nav aria-label="Main navigation">
        {user.role === "manager" && <button className={view === "overview" ? "active" : ""} onClick={() => setView("overview")}><Icon>⌁</Icon>Overview</button>}
        <button className={view === "timesheet" ? "active" : ""} onClick={() => setView("timesheet")}><Icon>▦</Icon>Timesheet</button>
        <button className={view === "projects" ? "active" : ""} onClick={() => setView("projects")}><Icon>✓</Icon>{user.role === "manager" ? "Projects" : "My tasks"}</button>
        {user.role === "manager" && <button className={view === "quotes" ? "active" : ""} onClick={() => setView("quotes")}><Icon>◇</Icon>Quotes</button>}
        {user.role === "manager" && <button className={view === "clients" ? "active" : ""} onClick={() => setView("clients")}><Icon>◎</Icon>Clients & rates</button>}
      </nav>
      <div className="sidebar-note"><span className="pulse" /><div><strong>Forecast is live</strong><small>Updated from every entry</small></div></div>
      <div className="profile"><span className="avatar">{(user.name || "U").slice(0,2).toUpperCase()}</span><div><strong>{user.name || "Signed-in user"}</strong><small>{user.role === "manager" ? "Manager" : "Team member"}</small></div><button aria-label="Profile options" aria-expanded={profileOpen} onClick={() => setProfileOpen(value => !value)}>•••</button>{profileOpen && <div className="profile-menu"><div><strong>{user.name || "Signed-in user"}</strong><span>{user.email}</span></div><span className="role-pill">{user.role === "manager" ? "Manager access" : "Team member"}</span><a href="/api/auth/microsoft/logout">Sign out</a></div>}</div>
    </aside>

    <section className="workspace">
      <header><div><p className="eyebrow">{view === "overview" ? overviewMonthLabel.toUpperCase() : "ONE PLACE CONCEPTS"}</p><h1>{view === "overview" ? "Good morning, Jason." : view === "timesheet" ? "Your timesheet" : view === "projects" ? (user.role === "manager" ? "Projects & capacity" : "My tasks") : view === "quotes" ? "Quotes" : "Clients & rates"}</h1><p>{view === "overview" ? "Here’s how your month is shaping up." : view === "timesheet" ? "Review and manage every hour in one place." : view === "projects" ? (user.role === "manager" ? "Forecast delivery and team utilization." : "Focus on the work assigned to you.") : view === "quotes" ? "Prepare and track straightforward client estimates." : "Know what every hour is worth."}</p></div><div className="header-actions">{view === "overview" && <label className="overview-month">View month<input type="month" aria-label="Overview month" value={overviewMonth} onChange={e => e.target.value && setOverviewMonth(e.target.value)}/></label>}<button className="primary" onClick={openNewEntry}><span>＋</span> Log time</button></div></header>

      {view === "overview" && <>
        <div className="metrics four">
          <article><div className="metric-top"><span>Revenue earned</span><span className="trend">↗ 8.2%</span></div><strong>{money.format(metrics.earned)}</strong><small>From {metrics.billableHours.toFixed(1)} billable hours</small></article>
          <article className="hero-metric"><div className="metric-top"><span>Month forecast</span><span className="live">● LIVE</span></div><strong>{money.format(metrics.totalForecast)}</strong><div className="forecast-track"><i style={{ width: `${metrics.totalForecast ? Math.min(100, (metrics.earned + metrics.monthlyRecurringRevenue) / metrics.totalForecast * 100) : 0}%` }} /></div><small>{money.format(metrics.forecast)} projected billable + {money.format(metrics.monthlyRecurringRevenue)} MRR</small></article>
          <article><div className="metric-top"><span>Billable utilization</span><span className="target">Target 80%</span></div><strong>{metrics.utilization}%</strong><small>{metrics.billableHours.toFixed(1)} of {metrics.totalHours.toFixed(1)} hours</small></article>
          <article className="tax-metric"><div className="metric-top"><span>Estimated federal tax</span><label className="tax-rate"><input aria-label="Estimated federal tax rate" type="number" min="0" max="100" step="1" value={federalTaxRate} onChange={e => saveTaxRate(Number(e.target.value))}/>%</label></div><strong>{money.format(metrics.estimatedFederalTax)}</strong><small>{federalTaxRate}% of {money.format(metrics.currentMonthRevenue)} total revenue (billable + MRR) · planning estimate only</small></article>
        </div>

        <div className="grid">
          <article className="panel forecast-panel"><div className="panel-title"><div><h2>Revenue pace</h2><p>Earned vs. projected this month</p></div><span className="legend"><i /> Earned <i /> Forecast</span></div>
            <div className="chart"><div className="y-axis"><span>$16k</span><span>$12k</span><span>$8k</span><span>$4k</span><span>$0</span></div><div className="plot"><div className="gridlines"/><svg viewBox="0 0 700 240" preserveAspectRatio="none" aria-label={`Revenue forecast chart for ${overviewMonthLabel}`}><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1c6b55" stopOpacity=".18"/><stop offset="1" stopColor="#1c6b55" stopOpacity="0"/></linearGradient></defs><path className="area" d="M0,225 L72,213 L145,194 L218,180 L290,157 L363,142 L435,119 L435,240 L0,240Z"/><path className="earned-line" d="M0,225 L72,213 L145,194 L218,180 L290,157 L363,142 L435,119"/><path className="forecast-line" d="M435,119 L510,90 L585,60 L700,20"/><circle cx="435" cy="119" r="5"/></svg><div className="x-axis"><span>{overviewMonthShort} 1</span><span>{overviewMonthShort} 8</span><span>{overviewMonthShort} 15</span><span>{overviewMonthShort} 22</span><span>{overviewMonthShort} {overviewMonthDays}</span></div></div></div>
            <div className="insight"><span>✦</span><p><strong>You’re pacing 6% ahead of last month.</strong><br/>At your current rate, you’ll finish near {money.format(metrics.forecast)}.</p></div>
          </article>

          <article className="panel recent"><div className="panel-title"><div><h2>Recent time</h2><p>Your latest entries</p></div><button onClick={() => setView("timesheet")}>View all →</button></div>
            <div className="entries">{overviewEntries.length ? overviewEntries.slice(0, 5).map(e => <div className="entry" key={e.id}><div className="client-dot" data-client={e.client[0]}>{e.client[0]}</div><div className="entry-main"><strong>{e.client}</strong><span>{e.description}</span></div><div className="entry-value"><strong>{e.hours}h</strong><span>{e.billable ? money.format(e.hours * e.rate) : "Non-billable"}</span></div></div>) : <p className="overview-empty">No time entries for {overviewMonthLabel}.</p>}</div>
          </article>
        </div>

        <article className="panel client-snapshot"><div className="panel-title"><div><h2>Client snapshot</h2><p>Revenue contribution for {overviewMonthLabel}</p></div><button onClick={() => setView("clients")}>Manage clients →</button></div><div className="client-bars">{byClient.length ? byClient.map((c, i) => <div className="client-bar" key={c.name}><span className={`client-badge c${i}`}>{c.name[0]}</span><strong>{c.name}</strong><div className="bar"><i style={{ width: `${c.revenue / byClient[0].revenue * 100}%` }}/></div><span>{c.hours}h</span><b>{money.format(c.revenue)}</b></div>) : <p className="overview-empty">No billable client activity for {overviewMonthLabel}.</p>}</div></article>
      </>}

      {view === "timesheet" && <>
        <article className="panel file-tools"><div><p className="eyebrow">DATA & REPORTS</p><h2>Timesheet files</h2><p>Move entries in or out of Excel, or prepare a client-ready Word detail report.</p></div><div className="file-actions"><button onClick={exportExcel} disabled={!entries.length}>⇩ Export Excel</button><button onClick={() => importInput.current?.click()}>⇧ Import Excel</button><input ref={importInput} className="sr-only" type="file" accept=".xlsx,.xls" onChange={e => e.target.files?.[0] && importExcel(e.target.files[0])}/><div className="word-export"><select aria-label="Client for Word report" value={reportClient} onChange={e => setReportClient(e.target.value)}><option value="">Select client…</option>{Array.from(new Set(entries.map(e => e.client))).sort().map(name => <option key={name}>{name}</option>)}</select><button onClick={exportWord}>⇩ Export Word</button></div></div>{fileMessage && <div className="file-message" role="status">{fileMessage}</div>}</article>
        {user.role === "manager" && <article className="panel timesheet-filters"><div className="filter-head"><div><p className="eyebrow">MANAGER VIEW</p><h2>Filter and sort entries</h2></div><button type="button" onClick={() => setTimesheetFilter({client:"",project:"",month:"",from:"",to:"",sort:"date_desc"})}>Clear filters</button></div><div className="filter-grid"><label>Client<select value={timesheetFilter.client} onChange={e => setTimesheetFilter({...timesheetFilter,client:e.target.value,project:""})}><option value="">All clients</option>{Array.from(new Set(entries.map(entry => entry.client))).sort().map(client => <option key={client}>{client}</option>)}</select></label><label>Project<select value={timesheetFilter.project} onChange={e => setTimesheetFilter({...timesheetFilter,project:e.target.value})}><option value="">All projects</option>{Array.from(new Set(entries.filter(entry => !timesheetFilter.client || entry.client === timesheetFilter.client).map(entry => entry.project))).sort().map(project => <option key={project}>{project}</option>)}</select></label><label>Month<input type="month" value={timesheetFilter.month} onChange={e => setTimesheetFilter({...timesheetFilter,month:e.target.value})}/></label><label>From<input type="date" value={timesheetFilter.from} onChange={e => setTimesheetFilter({...timesheetFilter,from:e.target.value})}/></label><label>To<input type="date" value={timesheetFilter.to} onChange={e => setTimesheetFilter({...timesheetFilter,to:e.target.value})}/></label><label>Sort by<select value={timesheetFilter.sort} onChange={e => setTimesheetFilter({...timesheetFilter,sort:e.target.value})}><option value="date_desc">Newest date</option><option value="date_asc">Oldest date</option><option value="client">Client</option><option value="project">Project</option><option value="hours_desc">Most hours</option></select></label></div></article>}
        <article className="panel table-panel"><div className="panel-title"><div><h2>{timesheetFilter.month ? new Date(timesheetFilter.month+"-02T12:00:00").toLocaleDateString("en-US",{month:"long",year:"numeric"}) : "Timesheet entries"}</h2><p>{visibleTotals.total.toFixed(1)} total hours · {visibleTotals.billable.toFixed(1)} billable · {visibleEntries.length} entries</p></div><button onClick={openNewEntry}>＋ Add entry</button></div><div className="table-wrap"><table><thead><tr><th>Date</th><th>Client / project</th><th>Description</th><th>Hours</th><th>Value</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{visibleEntries.length ? visibleEntries.map(e => <tr key={e.id}><td>{new Date(`${e.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td><td><strong>{e.client}</strong><small>{e.project}</small></td><td>{e.description}</td><td>{e.hours.toFixed(1)}</td><td>{e.billable ? money.format(e.hours * e.rate) : <span className="muted">Internal</span>}</td><td><div className="row-actions"><button onClick={() => openEditEntry(e)}>Edit</button><button className="danger" onClick={() => deleteEntry(e)}>Delete</button></div></td></tr>) : <tr><td colSpan={6} className="empty-state"><strong>No matching entries</strong><span>Adjust the filters or add a new time entry.</span></td></tr>}</tbody></table></div></article>
      </>}

      {view === "projects" && <section className="projects-view">
        {user.role === "manager" && <div className="project-metrics">
          <article><span>Active projects</span><strong>{projects.filter(project => project.status === "active").length}</strong></article>
          <article><span>Planned hours</span><strong>{projectStats.reduce((sum, project) => sum + project.planned, 0).toFixed(1)}h</strong></article>
          <article><span>Hours logged</span><strong>{projectStats.reduce((sum, project) => sum + project.logged, 0).toFixed(1)}h</strong></article>
          <article><span>Capacity used</span><strong>{Math.round(projectStats.reduce((sum, project) => sum + project.logged, 0) / Math.max(1, projectStats.reduce((sum, project) => sum + project.budgetHours, 0)) * 100)}%</strong></article>
        </div>}
        {user.role === "manager" && <div className="project-create-grid">
          <form className="panel project-form" onSubmit={createProject}><div><p className="eyebrow">NEW PROJECT</p><h2>Plan client work</h2></div><label>Client<select required value={projectForm.client} onChange={e => setProjectForm({...projectForm,client:e.target.value})}><option value="">Select client…</option>{clients.filter(c => c.active).map(c => <option key={c.id}>{c.name}</option>)}</select></label><label>Project name<input required value={projectForm.name} onChange={e => setProjectForm({...projectForm,name:e.target.value})}/></label><div className="compact-fields"><label>Budget hours<input type="number" min="0" required value={projectForm.budgetHours} onChange={e => setProjectForm({...projectForm,budgetHours:e.target.value})}/></label><label>Start<input type="date" required value={projectForm.startDate} onChange={e => setProjectForm({...projectForm,startDate:e.target.value})}/></label><label>Due<input type="date" required value={projectForm.dueDate} onChange={e => setProjectForm({...projectForm,dueDate:e.target.value})}/></label></div><button className="primary">Create project</button></form>
          <form className="panel project-form" onSubmit={createTask}><div><p className="eyebrow">NEW TASK</p><h2>Assign team work</h2></div><label>Project<select required value={taskForm.projectId} onChange={e => setTaskForm({...taskForm,projectId:e.target.value})}><option value="">Select project…</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Task<input required value={taskForm.title} onChange={e => setTaskForm({...taskForm,title:e.target.value})}/></label><div className="compact-fields"><label>Assignee<select required value={taskForm.assigneeUserId} onChange={e => setTaskForm({...taskForm,assigneeUserId:e.target.value})}><option value="">Select person…</option>{projectPeople.map(person => <option key={person.userId} value={person.userId}>{person.name}</option>)}</select></label><label>Est. hours<input type="number" min="0" required value={taskForm.estimatedHours} onChange={e => setTaskForm({...taskForm,estimatedHours:e.target.value})}/></label><label>Due<input type="date" required value={taskForm.dueDate} onChange={e => setTaskForm({...taskForm,dueDate:e.target.value})}/></label></div><button className="primary">Add task</button></form>
        </div>}
        <div className="project-list">{projectStats.length ? projectStats.map(project => <article className="panel project-card" key={project.id}><div className="project-head"><div><p className="eyebrow">{project.client}</p><h2>{project.name}</h2><span>Due {new Date(project.dueDate+"T12:00:00").toLocaleDateString()}</span></div>{user.role === "manager" && <div className="project-progress"><strong>{project.utilization}%</strong><span>of {project.budgetHours}h budget</span></div>}</div>{user.role === "manager" && <div className="project-bars"><div><span>Logged {project.logged.toFixed(1)}h</span><span>Budget {project.budgetHours}h</span></div><i><b style={{width:`${Math.min(100,project.utilization)}%`}}/></i><small>{project.complete} of {project.tasks.length} tasks complete · {Math.max(0,project.budgetHours-project.logged).toFixed(1)}h remaining</small></div>}<div className="task-list">{project.tasks.length ? project.tasks.map(task => <div className="task-row" key={task.id}><div><strong>{task.title}</strong><span>{projectPeople.find(person => person.userId === task.assigneeUserId)?.name ?? (user.role === "member" ? "Assigned to you" : "Team member")} · {task.estimatedHours}h · Due {new Date(task.dueDate+"T12:00:00").toLocaleDateString()}</span></div><select aria-label={`Status for ${task.title}`} value={task.status} onChange={e => changeTaskStatus(task,e.target.value as ProjectTask["status"])}><option value="todo">To do</option><option value="in_progress">In progress</option><option value="complete">Complete</option></select></div>) : <p className="no-tasks">No tasks assigned yet.</p>}</div></article>) : <article className="panel empty-projects"><h2>{user.role === "manager" ? "No projects yet" : "No tasks assigned"}</h2><p>{user.role === "manager" ? "Create a project to begin forecasting delivery and utilization." : "Your manager can assign work from the Projects view."}</p></article>}</div>
      </section>}

      {view === "quotes" && user.role === "manager" && <section className="quotes-view">
        <form className="panel quote-pdf-settings" onSubmit={saveQuotePdfSettings}><div><p className="eyebrow">CLIENT PDF HEADER</p><h2>Company information</h2><p>Edit the company and contact details shown at the top of every client PDF.</p></div><div className="quote-settings-grid"><label>Company name<input required value={quotePdfSettings.quoteCompanyName} onChange={e => setQuotePdfSettings({...quotePdfSettings,quoteCompanyName:e.target.value})}/></label><label>Tagline<input value={quotePdfSettings.quoteTagline} onChange={e => setQuotePdfSettings({...quotePdfSettings,quoteTagline:e.target.value})}/></label><label>Contact name<input value={quotePdfSettings.quoteContactName} placeholder={user.name} onChange={e => setQuotePdfSettings({...quotePdfSettings,quoteContactName:e.target.value})}/></label><label>Contact email<input type="email" value={quotePdfSettings.quoteContactEmail} placeholder={user.email} onChange={e => setQuotePdfSettings({...quotePdfSettings,quoteContactEmail:e.target.value})}/></label></div><button className="primary" disabled={savingQuotePdfSettings}>{savingQuotePdfSettings ? "Saving…" : "Save PDF header"}</button></form>
        {editingQuoteId && <div className="quote-edit-banner"><div><strong>Editing draft quote #{String(editingQuoteId).padStart(4,"0")}</strong><span>Changes will update this quote without creating a duplicate.</span></div><div><button type="button" onClick={cancelQuoteEdit}>Cancel</button><button className="primary" type="button" onClick={() => document.querySelector<HTMLFormElement>(".quote-form")?.requestSubmit()}>Update draft</button></div></div>}
        <form className="panel quote-form" onSubmit={createQuote}><div><p className="eyebrow">NEW QUOTE</p><h2>Build a client estimate</h2><p>Add hardware, software, and service line items.</p></div><div className="quote-basics"><label>Client<select required value={quoteForm.client} onChange={e => setQuoteForm({...quoteForm,client:e.target.value})}><option value="">Select client…</option>{clients.filter(c => c.active).map(c => <option key={c.id}>{c.name}</option>)}</select></label><label>Valid until<input type="date" required value={quoteForm.expiresOn} onChange={e => setQuoteForm({...quoteForm,expiresOn:e.target.value})}/></label></div><div className="quote-item-editor">{quoteForm.items.map((item,index) => <fieldset key={index}><div className="quote-item-head"><legend>Line item {index + 1}</legend>{quoteForm.items.length > 1 && <button type="button" onClick={() => setQuoteForm({...quoteForm,items:quoteForm.items.filter((_,i) => i !== index)})}>Remove</button>}</div><div className="quote-item-grid"><label>Category<select value={item.category} onChange={e => updateQuoteItem(index,{category:e.target.value as QuoteDraftItem["category"],billing:e.target.value === "software" ? item.billing : "one_time"})}><option value="hardware">Hardware</option><option value="software">Software</option><option value="service">Service</option></select></label><label className="item-description">Description<input required placeholder="Product or service" value={item.description} onChange={e => updateQuoteItem(index,{description:e.target.value})}/></label><label>Qty<input type="number" min="0.01" step="0.01" required value={item.quantity} onChange={e => updateQuoteItem(index,{quantity:Number(e.target.value)})}/></label><label>Unit cost<input type="number" min="0" step="0.01" required value={item.unitCost} onChange={e => updateQuoteItem(index,{unitCost:Number(e.target.value)},true)}/></label><label>Markup %<input type="number" min="0" step="1" required value={item.markupPercent} onChange={e => updateQuoteItem(index,{markupPercent:Number(e.target.value)},true)}/></label><label>Sell price<input type="number" min="0" step="0.01" required value={item.unitPrice} onChange={e => updateQuoteItem(index,{unitPrice:Number(e.target.value)})}/></label>{item.category === "software" && <label>Billing<select value={item.billing} onChange={e => updateQuoteItem(index,{billing:e.target.value as QuoteDraftItem["billing"]})}><option value="one_time">One time</option><option value="monthly">Monthly</option></select></label>}<div className="item-total"><span>Line total</span><strong>{money.format(item.quantity * item.unitPrice)}{item.billing === "monthly" ? "/mo" : ""}</strong></div></div></fieldset>)}</div><button className="add-quote-item" type="button" onClick={() => setQuoteForm({...quoteForm,items:[...quoteForm.items,blankQuoteItem()]})}>＋ Add line item</button><div className="quote-form-total"><span><small>One-time total</small><strong>{money.format(quoteForm.items.filter(item => item.billing === "one_time").reduce((sum,item) => sum + item.quantity * item.unitPrice,0))}</strong></span><span><small>Monthly recurring</small><strong>{money.format(quoteForm.items.filter(item => item.billing === "monthly").reduce((sum,item) => sum + item.quantity * item.unitPrice,0))}/mo</strong></span></div><button className="primary">Create draft quote</button></form>
        <div className="quote-list">{quotes.length ? quotes.map(quote => { const oneTime = quote.items.filter(item => item.billing === "one_time").reduce((sum,item) => sum + item.quantity * item.unitPrice,0); const monthly = quote.items.filter(item => item.billing === "monthly").reduce((sum,item) => sum + item.quantity * item.unitPrice,0); return <article className="panel quote-card" key={quote.id}><div className="quote-card-head"><div><span className={`quote-status ${quote.status}`}>{quote.status}</span><p>Quote #{String(quote.id).padStart(4,"0")}</p></div><div className="quote-card-totals"><strong>{money.format(oneTime)}</strong>{monthly > 0 && <span>+ {money.format(monthly)}/mo</span>}</div></div><h2>{quote.client}</h2><div className="quote-lines">{quote.items.map(item => <div key={item.id}><span className={`quote-category ${item.category}`}>{item.category}</span><p><strong>{item.description}</strong><small>{item.quantity} × {money.format(item.unitPrice)}{item.billing === "monthly" ? " monthly" : ""}</small></p><b>{money.format(item.quantity * item.unitPrice)}{item.billing === "monthly" ? "/mo" : ""}</b></div>)}</div><div className="quote-meta"><span>{quote.items.length} line item{quote.items.length === 1 ? "" : "s"}</span><span>Valid until {new Date(quote.expiresOn+"T12:00:00").toLocaleDateString()}</span></div><div className="quote-actions"><select aria-label={`Status for quote ${quote.id}`} value={quote.status} onChange={e => changeQuoteStatus(quote,e.target.value as Quote["status"])}><option value="draft">Draft</option><option value="sent">Sent</option><option value="accepted">Accepted</option></select>{quote.status === "draft" && <button type="button" onClick={() => editQuote(quote)}>Edit draft</button>}<button type="button" onClick={() => setPrintQuote(quote)}>Client PDF</button></div></article> }) : <article className="panel empty-quotes"><h2>No quotes yet</h2><p>Create your first client estimate using the form.</p></article>}</div>
      </section>}

      {view === "clients" && user.role === "manager" && <>
        <article className="panel ninja-panel"><div><span className="ninja-mark">N</span><div><h2>NinjaOne client sync</h2><p>{ninjaConfigured ? "Connected securely · Organizations become One Place Concepts clients" : "Ready to connect · API credentials are still required"}</p></div></div><button className="primary" disabled={!ninjaConfigured || syncing} onClick={syncNinjaOne}>{syncing ? "Syncing…" : "↻ Sync clients"}</button>{syncMessage && <small className="sync-message">{syncMessage}</small>}</article>
        <article className="panel mrr-summary"><div><p className="eyebrow">MONTHLY RECURRING REVENUE</p><h2>{money.format(metrics.monthlyRecurringRevenue)} MRR</h2><p>Fixed recurring revenue across {clients.filter(c => c.active && c.monthlyRecurringRevenue > 0).length} active clients.</p></div><div className="mrr-actions"><span>Annualized: <strong>{money.format(metrics.monthlyRecurringRevenue * 12)}</strong></span><button type="button" onClick={() => setShowInactiveClients(value => !value)}>{showInactiveClients ? "Hide inactive" : `Show inactive (${clients.filter(c => !c.active).length})`}</button></div></article>
        <div className="client-cards">{(clients.length ? clients : byClient.map((c, i) => ({ id: -i-1, ninjaOneId: null, name: c.name, description: "", hourlyRate: c.rate, monthlyRecurringRevenue: 0, active: true, syncedAt: null }))).filter(c => showInactiveClients || c.active).map((c, i) => {
          const activity = byClient.find(b => b.name === c.name);
          const editing = editingClientId === c.id;
          return <article className={`panel client-card ${editing ? "editing" : ""} ${!c.active ? "inactive-client" : ""}`} key={c.id}>
            <div className={`big-badge c${i%3}`}>{c.name[0]}</div><div className="client-card-head"><div><h2>{c.name}{!c.active && <span className="inactive-pill">Inactive</span>}</h2><p>{c.ninjaOneId ? `NinjaOne organization #${c.ninjaOneId}` : c.description || "Client"}</p></div>{!editing && <div className="client-head-actions"><button className="client-edit" type="button" disabled={c.id < 0} onClick={() => editClient(c)}>Edit</button><button className={c.active ? "client-hide" : "client-restore"} type="button" disabled={c.id < 0} onClick={() => setClientActive(c, !c.active)}>{c.active ? "Hide" : "Restore"}</button></div>}</div>
            <div className="rate"><span>Hourly billing rate</span>{editing ? <label className="inline-rate">$ <input type="number" min="0" value={clientDraft.hourlyRate} onChange={e => setClientDraft(draft => ({ ...draft, hourlyRate: e.target.value }))}/></label> : <strong>{money.format(c.hourlyRate)}/hr</strong>}</div>
            <div className="rate"><span>Monthly recurring revenue</span>{editing ? <label className="inline-rate">$ <input type="number" min="0" value={clientDraft.monthlyRecurringRevenue} onChange={e => setClientDraft(draft => ({ ...draft, monthlyRecurringRevenue: e.target.value }))}/></label> : <strong>{money.format(c.monthlyRecurringRevenue ?? 0)}</strong>}</div>
            {editing && <div className="client-edit-actions"><button type="button" className="cancel" onClick={() => setEditingClientId(null)}>Cancel</button><button type="button" className="save-client" disabled={savingClient} onClick={() => saveClient(c)}>{savingClient ? "Saving…" : "Save changes"}</button></div>}
            <div className="rate"><span>Billable revenue this month</span><strong>{money.format(activity?.revenue ?? 0)}</strong></div><div className="rate"><span>Hours logged</span><strong>{activity?.hours ?? 0}h</strong></div>
          </article>;
        })}</div>
        <article className="panel team-access"><div className="panel-title"><div><h2>Team access</h2><p>Choose roles or remove access for team members and old accounts.</p></div></div><div className="members">{members.map(m => <div className="member" key={m.id}><span className="avatar">{m.name.slice(0,2).toUpperCase()}</span><div><strong>{m.name}{m.id === user.id ? " (you)" : ""}</strong><small>{m.email}</small></div><select aria-label={`Role for ${m.name}`} value={m.role} disabled={m.id === user.id} onChange={e => changeRole(m.id, e.target.value as "manager" | "member")}><option value="member">Team member — timesheet only</option><option value="manager">Manager — full access</option></select><button className="remove-member" type="button" disabled={m.id === user.id} onClick={() => removeMember(m)}>Remove access</button></div>)}</div></article>
      </>}
    </section>

    {open && <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setOpen(false)}><form className="modal" onSubmit={saveEntry}><div className="modal-head"><div><p className="eyebrow">{editingEntry ? "EDIT ENTRY" : "NEW ENTRY"}</p><h2>{editingEntry ? "Update your time" : "Log your time"}</h2></div><button type="button" onClick={() => setOpen(false)} aria-label="Close">×</button></div><label>Date<input type="date" required value={form.date} onChange={e => setForm({...form, date: e.target.value})}/></label><div className="form-row"><label>Client<select value={form.client} onChange={e => { const selected = clients.find(c => c.name === e.target.value); setForm({...form, client:e.target.value, project:"", rate:String(selected?.hourlyRate ?? 0)})}}>{clients.map(c => <option key={c.id}>{c.name}</option>)}<option>Internal</option></select></label><label>Project<input required list="entry-project-options" placeholder="Choose or enter a project" value={form.project} onChange={e => setForm({...form, project:e.target.value})}/><datalist id="entry-project-options">{entryProjectOptions.map(project => <option key={project} value={project}/>)}</datalist><small>Select a previous project or type a new one.</small></label></div><label>What did you work on?<input autoFocus required placeholder="e.g. Client workshop and notes" value={form.description} onChange={e => setForm({...form, description:e.target.value})}/></label><div className="form-row"><label>Hours<input type="number" step="0.25" min="0.25" required placeholder="0.0" value={form.hours} onChange={e => setForm({...form, hours:e.target.value})}/></label><label>Hourly rate<input type="number" min="0" required value={form.rate} onChange={e => setForm({...form, rate:e.target.value})}/></label></div><label className="check"><input type="checkbox" checked={form.billable} onChange={e => setForm({...form, billable:e.target.checked})}/><span>Billable time</span><small>Counts toward revenue and forecast</small></label><button className="primary submit" type="submit">{editingEntry ? "Update time entry" : "Save time entry"}</button></form></div>}
    {printQuote && (() => {
      const client = clients.find(item => item.name === printQuote.client);
      const oneTime = printQuote.items.filter(item => item.billing === "one_time").reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const monthly = printQuote.items.filter(item => item.billing === "monthly").reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      return <article className="quote-document" aria-label={`Client quote ${printQuote.id}`}>
        <header className="quote-document-header">
          <div className="quote-company"><img src="/opc-logo.jpeg" alt={quotePdfSettings.quoteCompanyName}/><div><strong>{quotePdfSettings.quoteCompanyName}</strong>{quotePdfSettings.quoteTagline && <span>{quotePdfSettings.quoteTagline}</span>}<span>{quotePdfSettings.quoteContactName || user.name}{(quotePdfSettings.quoteContactEmail || user.email) && ` · ${quotePdfSettings.quoteContactEmail || user.email}`}</span></div></div>
          <div className="quote-title"><span>QUOTE</span><strong>#{String(printQuote.id).padStart(4,"0")}</strong></div>
        </header>
        <section className="quote-parties">
          <div><span>PREPARED FOR</span><strong>{printQuote.client}</strong>{client?.description && <p>{client.description}</p>}</div>
          <dl><div><dt>Issued</dt><dd>{new Date(printQuote.createdAt).toLocaleDateString()}</dd></div><div><dt>Valid until</dt><dd>{new Date(printQuote.expiresOn+"T12:00:00").toLocaleDateString()}</dd></div><div><dt>Status</dt><dd>{printQuote.status}</dd></div></dl>
        </section>
        <table className="quote-document-lines"><thead><tr><th>Item</th><th>Billing</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>{printQuote.items.map(item => <tr key={item.id}><td><strong>{item.description}</strong><span>{item.category}</span></td><td>{item.billing === "monthly" ? "Monthly" : "One time"}</td><td>{item.quantity}</td><td>{money.format(item.unitPrice)}</td><td>{money.format(item.quantity * item.unitPrice)}{item.billing === "monthly" ? "/mo" : ""}</td></tr>)}</tbody></table>
        <section className="quote-document-totals"><div><span>One-time total</span><strong>{money.format(oneTime)}</strong></div>{monthly > 0 && <div className="monthly"><span>Monthly recurring</span><strong>{money.format(monthly)}/mo</strong></div>}</section>
        <footer><strong>Thank you for the opportunity to work with you.</strong><p>Pricing is valid through the date shown above. Taxes, shipping, and third-party fees are excluded unless specifically listed. Recurring services are billed monthly.</p></footer>
      </article>;
    })()}
    {saved && <div className="toast">✓ Time entry saved</div>}
  </main>;
}
