"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Entry = { id: number; date: string; client: string; project: string; description: string; hours: number; rate: number; billable: boolean };
type User = { id: number; name: string; email: string; role: "manager" | "member" };
type Member = User & { userId: string };
type Client = { id: number; ninjaOneId: number | null; name: string; description: string; hourlyRate: number; monthlyRecurringRevenue: number; active: boolean; syncedAt: string | null };

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function Icon({ children }: { children: React.ReactNode }) { return <span className="icon" aria-hidden="true">{children}</span>; }

export default function Home() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [view, setView] = useState<"overview" | "timesheet" | "clients">("overview");
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [user, setUser] = useState<User>({ id: 0, name: "", email: "", role: "member" });
  const [members, setMembers] = useState<Member[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [ninjaConfigured, setNinjaConfigured] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [fileMessage, setFileMessage] = useState("");
  const [reportClient, setReportClient] = useState("");
  const [federalTaxRate, setFederalTaxRate] = useState(25);
  const importInput = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), client: "", project: "", description: "", hours: "", rate: "0", billable: true });

  useEffect(() => {
    fetch("/api/session").then(r => r.json()).then(data => { if (!data.user) return; setUser(data.user); setView(data.user.role === "manager" ? "overview" : "timesheet"); fetch("/api/clients").then(r => r.json()).then(c => setClients(c.clients ?? [])); if (data.user.role === "manager") { fetch("/api/team").then(r => r.json()).then(t => setMembers(t.members ?? [])); fetch("/api/ninjaone").then(r => r.json()).then(n => setNinjaConfigured(Boolean(n.configured))); fetch("/api/settings").then(r => r.json()).then(s => setFederalTaxRate(Number(s.federalTaxRate ?? 25))); } });
    fetch("/api/entries").then(r => r.ok ? r.json() : null).then(data => {
      if (data?.entries) setEntries(data.entries.map((e: Entry) => ({ ...e, hours: Number(e.hours), rate: Number(e.rate), billable: Boolean(e.billable) })));
    }).catch(() => undefined);
  }, []);

  async function changeRole(id: number, role: "manager" | "member") {
    const response = await fetch("/api/team", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, role }) });
    if (response.ok) setMembers(list => list.map(m => m.id === id ? { ...m, role } : m));
  }

  async function syncNinjaOne() {
    setSyncing(true); setSyncMessage("");
    const response = await fetch("/api/ninjaone", { method: "POST" });
    const data = await response.json();
    if (response.ok) { setClients(data.clients ?? []); setSyncMessage(`${data.imported} clients synced from NinjaOne`); }
    else setSyncMessage(data.error ?? "Sync failed");
    setSyncing(false);
  }

  async function changeRate(id: number, hourlyRate: number) {
    const response = await fetch("/api/clients", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, hourlyRate }) });
    if (response.ok) setClients(list => list.map(c => c.id === id ? { ...c, hourlyRate } : c));
  }

  async function changeMrr(id: number, monthlyRecurringRevenue: number) {
    const response = await fetch("/api/clients", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, monthlyRecurringRevenue }) });
    if (response.ok) setClients(list => list.map(c => c.id === id ? { ...c, monthlyRecurringRevenue } : c));
  }

  async function saveTaxRate(rate: number) {
    setFederalTaxRate(rate);
    await fetch("/api/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ federalTaxRate: rate }) });
  }

  const metrics = useMemo(() => {
    const billableHours = entries.filter(e => e.billable).reduce((s, e) => s + e.hours, 0);
    const totalHours = entries.reduce((s, e) => s + e.hours, 0);
    const earned = entries.reduce((s, e) => s + (e.billable ? e.hours * e.rate : 0), 0);
    const elapsedWorkdays = 10;
    const totalWorkdays = 21;
    const forecast = Math.round((earned / elapsedWorkdays) * totalWorkdays);
    const monthlyRecurringRevenue = clients.reduce((sum, client) => sum + Number(client.monthlyRecurringRevenue || 0), 0);
    return { billableHours, totalHours, earned, forecast, monthlyRecurringRevenue, estimatedFederalTax: earned * federalTaxRate / 100, utilization: totalHours ? Math.round((billableHours / totalHours) * 100) : 0, remaining: totalWorkdays - elapsedWorkdays };
  }, [entries, clients, federalTaxRate]);

  const byClient = useMemo(() => Object.values(entries.filter(e => e.billable).reduce<Record<string, { name: string; hours: number; revenue: number; rate: number }>>((acc, e) => {
    acc[e.client] ||= { name: e.client, hours: 0, revenue: 0, rate: e.rate };
    acc[e.client].hours += e.hours; acc[e.client].revenue += e.hours * e.rate; return acc;
  }, {})).sort((a, b) => b.revenue - a.revenue), [entries]);

  function openNewEntry() {
    const firstClient = clients[0];
    setEditingEntry(null);
    setForm({ date: new Date().toISOString().slice(0, 10), client: firstClient?.name ?? "Internal", project: "", description: "", hours: "", rate: String(firstClient?.hourlyRate ?? 0), billable: Boolean(firstClient) });
    setOpen(true);
  }

  function openEditEntry(entry: Entry) {
    setEditingEntry(entry);
    setForm({ date: entry.date, client: entry.client, project: entry.project, description: entry.description, hours: String(entry.hours), rate: String(entry.rate), billable: entry.billable });
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

  return <main>
    <aside className="sidebar">
      <div className="brand"><img src="/opc-logo.jpeg" alt="One Place Concepts"/><span><strong>One Place</strong><small>Concepts</small></span></div>
      <nav aria-label="Main navigation">
        {user.role === "manager" && <button className={view === "overview" ? "active" : ""} onClick={() => setView("overview")}><Icon>⌁</Icon>Overview</button>}
        <button className={view === "timesheet" ? "active" : ""} onClick={() => setView("timesheet")}><Icon>▦</Icon>Timesheet</button>
        {user.role === "manager" && <button className={view === "clients" ? "active" : ""} onClick={() => setView("clients")}><Icon>◎</Icon>Clients & rates</button>}
      </nav>
      <div className="sidebar-note"><span className="pulse" /><div><strong>Forecast is live</strong><small>Updated from every entry</small></div></div>
      <div className="profile"><span className="avatar">{(user.name || "U").slice(0,2).toUpperCase()}</span><div><strong>{user.name || "Signed-in user"}</strong><small>{user.role === "manager" ? "Manager" : "Team member"}</small></div><button aria-label="Profile options" aria-expanded={profileOpen} onClick={() => setProfileOpen(value => !value)}>•••</button>{profileOpen && <div className="profile-menu"><div><strong>{user.name || "Signed-in user"}</strong><span>{user.email}</span></div><span className="role-pill">{user.role === "manager" ? "Manager access" : "Team member"}</span><a href="/signout-with-chatgpt?return_to=/">Sign out</a></div>}</div>
    </aside>

    <section className="workspace">
      <header><div><p className="eyebrow">AUGUST 2026</p><h1>{view === "overview" ? "Good morning, Jason." : view === "timesheet" ? "Your timesheet" : "Clients & rates"}</h1><p>{view === "overview" ? "Here’s how your month is shaping up." : view === "timesheet" ? "Review and manage every hour in one place." : "Know what every hour is worth."}</p></div><button className="primary" onClick={openNewEntry}><span>＋</span> Log time</button></header>

      {view === "overview" && <>
        <div className="metrics four">
          <article><div className="metric-top"><span>Revenue earned</span><span className="trend">↗ 8.2%</span></div><strong>{money.format(metrics.earned)}</strong><small>From {metrics.billableHours.toFixed(1)} billable hours</small></article>
          <article className="hero-metric"><div className="metric-top"><span>Month forecast</span><span className="live">● LIVE</span></div><strong>{money.format(metrics.forecast)}</strong><div className="forecast-track"><i style={{ width: `${metrics.forecast ? Math.min(100, metrics.earned / metrics.forecast * 100) : 0}%` }} /></div><small>{money.format(metrics.earned)} earned · {metrics.remaining} workdays left</small></article>
          <article><div className="metric-top"><span>Billable utilization</span><span className="target">Target 80%</span></div><strong>{metrics.utilization}%</strong><small>{metrics.billableHours.toFixed(1)} of {metrics.totalHours.toFixed(1)} hours</small></article>
          <article className="tax-metric"><div className="metric-top"><span>Estimated federal tax</span><label className="tax-rate"><input aria-label="Estimated federal tax rate" type="number" min="0" max="100" step="1" value={federalTaxRate} onChange={e => saveTaxRate(Number(e.target.value))}/>%</label></div><strong>{money.format(metrics.estimatedFederalTax)}</strong><small>{federalTaxRate}% of {money.format(metrics.earned)} billable revenue · planning estimate only</small></article>
        </div>

        <div className="grid">
          <article className="panel forecast-panel"><div className="panel-title"><div><h2>Revenue pace</h2><p>Earned vs. projected this month</p></div><span className="legend"><i /> Earned <i /> Forecast</span></div>
            <div className="chart"><div className="y-axis"><span>$16k</span><span>$12k</span><span>$8k</span><span>$4k</span><span>$0</span></div><div className="plot"><div className="gridlines"/><svg viewBox="0 0 700 240" preserveAspectRatio="none" aria-label="Revenue forecast chart"><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1c6b55" stopOpacity=".18"/><stop offset="1" stopColor="#1c6b55" stopOpacity="0"/></linearGradient></defs><path className="area" d="M0,225 L72,213 L145,194 L218,180 L290,157 L363,142 L435,119 L435,240 L0,240Z"/><path className="earned-line" d="M0,225 L72,213 L145,194 L218,180 L290,157 L363,142 L435,119"/><path className="forecast-line" d="M435,119 L510,90 L585,60 L700,20"/><circle cx="435" cy="119" r="5"/></svg><div className="x-axis"><span>Aug 1</span><span>Aug 8</span><span>Today</span><span>Aug 22</span><span>Aug 31</span></div></div></div>
            <div className="insight"><span>✦</span><p><strong>You’re pacing 6% ahead of last month.</strong><br/>At your current rate, you’ll finish near {money.format(metrics.forecast)}.</p></div>
          </article>

          <article className="panel recent"><div className="panel-title"><div><h2>Recent time</h2><p>Your latest entries</p></div><button onClick={() => setView("timesheet")}>View all →</button></div>
            <div className="entries">{entries.slice(0, 5).map(e => <div className="entry" key={e.id}><div className="client-dot" data-client={e.client[0]}>{e.client[0]}</div><div className="entry-main"><strong>{e.client}</strong><span>{e.description}</span></div><div className="entry-value"><strong>{e.hours}h</strong><span>{e.billable ? money.format(e.hours * e.rate) : "Non-billable"}</span></div></div>)}</div>
          </article>
        </div>

        <article className="panel client-snapshot"><div className="panel-title"><div><h2>Client snapshot</h2><p>Revenue contribution this month</p></div><button onClick={() => setView("clients")}>Manage clients →</button></div><div className="client-bars">{byClient.map((c, i) => <div className="client-bar" key={c.name}><span className={`client-badge c${i}`}>{c.name[0]}</span><strong>{c.name}</strong><div className="bar"><i style={{ width: `${c.revenue / byClient[0].revenue * 100}%` }}/></div><span>{c.hours}h</span><b>{money.format(c.revenue)}</b></div>)}</div></article>
      </>}

      {view === "timesheet" && <><article className="panel file-tools"><div><p className="eyebrow">DATA & REPORTS</p><h2>Timesheet files</h2><p>Move entries in or out of Excel, or prepare a client-ready Word detail report.</p></div><div className="file-actions"><button onClick={exportExcel} disabled={!entries.length}>⇩ Export Excel</button><button onClick={() => importInput.current?.click()}>⇧ Import Excel</button><input ref={importInput} className="sr-only" type="file" accept=".xlsx,.xls" onChange={e => e.target.files?.[0] && importExcel(e.target.files[0])}/><div className="word-export"><select aria-label="Client for Word report" value={reportClient} onChange={e => setReportClient(e.target.value)}><option value="">Select client…</option>{Array.from(new Set(entries.map(e => e.client))).sort().map(name => <option key={name}>{name}</option>)}</select><button onClick={exportWord}>⇩ Export Word</button></div></div>{fileMessage && <div className="file-message" role="status">{fileMessage}</div>}</article><article className="panel table-panel"><div className="panel-title"><div><h2>August entries</h2><p>{metrics.totalHours.toFixed(1)} total hours · {metrics.billableHours.toFixed(1)} billable</p></div><button onClick={openNewEntry}>＋ Add entry</button></div><div className="table-wrap"><table><thead><tr><th>Date</th><th>Client / project</th><th>Description</th><th>Hours</th><th>Value</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{entries.length ? entries.map(e => <tr key={e.id}><td>{new Date(`${e.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td><td><strong>{e.client}</strong><small>{e.project}</small></td><td>{e.description}</td><td>{e.hours.toFixed(1)}</td><td>{e.billable ? money.format(e.hours * e.rate) : <span className="muted">Internal</span>}</td><td><div className="row-actions"><button onClick={() => openEditEntry(e)}>Edit</button><button className="danger" onClick={() => deleteEntry(e)}>Delete</button></div></td></tr>) : <tr><td colSpan={6} className="empty-state"><strong>No time entries yet</strong><span>Log your first entry to start tracking hours and revenue.</span></td></tr>}</tbody></table></div></article></>}

      {view === "clients" && user.role === "manager" && <><article className="panel ninja-panel"><div><span className="ninja-mark">N</span><div><h2>NinjaOne client sync</h2><p>{ninjaConfigured ? "Connected securely · Organizations become One Place Concepts clients" : "Ready to connect · API credentials are still required"}</p></div></div><button className="primary" disabled={!ninjaConfigured || syncing} onClick={syncNinjaOne}>{syncing ? "Syncing…" : "↻ Sync clients"}</button>{syncMessage && <small className="sync-message">{syncMessage}</small>}</article><article className="panel mrr-summary"><div><p className="eyebrow">MONTHLY RECURRING REVENUE</p><h2>{money.format(metrics.monthlyRecurringRevenue)} MRR</h2><p>Fixed recurring revenue across {clients.filter(c => c.monthlyRecurringRevenue > 0).length} clients.</p></div><span>Annualized: <strong>{money.format(metrics.monthlyRecurringRevenue * 12)}</strong></span></article><div className="client-cards">{(clients.length ? clients : byClient.map((c, i) => ({ id: -i-1, ninjaOneId: null, name: c.name, description: "", hourlyRate: c.rate, monthlyRecurringRevenue: 0, active: true, syncedAt: null }))).map((c, i) => { const activity = byClient.find(b => b.name === c.name); return <article className="panel client-card" key={c.id}><div className={`big-badge c${i%3}`}>{c.name[0]}</div><div><h2>{c.name}</h2><p>{c.ninjaOneId ? `NinjaOne organization #${c.ninjaOneId}` : c.description || "Client"}</p></div><div className="rate"><span>Hourly rate</span><label className="inline-rate">$ <input type="number" min="0" value={c.hourlyRate} disabled={c.id < 0} onChange={e => changeRate(c.id, Number(e.target.value))}/></label></div><div className="rate"><span>Monthly recurring revenue</span><label className="inline-rate">$ <input type="number" min="0" value={c.monthlyRecurringRevenue ?? 0} disabled={c.id < 0} onChange={e => changeMrr(c.id, Number(e.target.value))}/></label></div><div className="rate"><span>Billable revenue this month</span><strong>{money.format(activity?.revenue ?? 0)}</strong></div><div className="rate"><span>Hours logged</span><strong>{activity?.hours ?? 0}h</strong></div></article>})}</div><article className="panel team-access"><div className="panel-title"><div><h2>Team access</h2><p>Choose who can see business-wide revenue, forecasts, clients, and rates.</p></div></div><div className="members">{members.map(m => <div className="member" key={m.id}><span className="avatar">{m.name.slice(0,2).toUpperCase()}</span><div><strong>{m.name}</strong><small>{m.email}</small></div><select aria-label={`Role for ${m.name}`} value={m.role} disabled={m.id === user.id} onChange={e => changeRole(m.id, e.target.value as "manager" | "member")}><option value="member">Team member — timesheet only</option><option value="manager">Manager — full access</option></select></div>)}</div></article></>}
    </section>

    {open && <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setOpen(false)}><form className="modal" onSubmit={saveEntry}><div className="modal-head"><div><p className="eyebrow">{editingEntry ? "EDIT ENTRY" : "NEW ENTRY"}</p><h2>{editingEntry ? "Update your time" : "Log your time"}</h2></div><button type="button" onClick={() => setOpen(false)} aria-label="Close">×</button></div><label>Date<input type="date" required value={form.date} onChange={e => setForm({...form, date: e.target.value})}/></label><div className="form-row"><label>Client<select value={form.client} onChange={e => { const selected = clients.find(c => c.name === e.target.value); setForm({...form, client:e.target.value, rate:String(selected?.hourlyRate ?? 0)})}}>{clients.map(c => <option key={c.id}>{c.name}</option>)}<option>Internal</option></select></label><label>Project<input required value={form.project} onChange={e => setForm({...form, project:e.target.value})}/></label></div><label>What did you work on?<input autoFocus required placeholder="e.g. Client workshop and notes" value={form.description} onChange={e => setForm({...form, description:e.target.value})}/></label><div className="form-row"><label>Hours<input type="number" step="0.25" min="0.25" required placeholder="0.0" value={form.hours} onChange={e => setForm({...form, hours:e.target.value})}/></label><label>Hourly rate<input type="number" min="0" required value={form.rate} onChange={e => setForm({...form, rate:e.target.value})}/></label></div><label className="check"><input type="checkbox" checked={form.billable} onChange={e => setForm({...form, billable:e.target.checked})}/><span>Billable time</span><small>Counts toward revenue and forecast</small></label><button className="primary submit" type="submit">{editingEntry ? "Update time entry" : "Save time entry"}</button></form></div>}
    {saved && <div className="toast">✓ Time entry saved</div>}
  </main>;
}
