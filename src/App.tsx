import { FormEvent, useEffect, useMemo, useState } from "react";
import { Toaster } from "react-hot-toast";
import { Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { BackendStore, Device, Patient, RiskLevel } from "./types";
import {
  SESSION_KEY, STORAGE_KEY, createSeedBackend, departmentDirectory, deviceTrend,
  downloadFile, emptyPatient, loadBackend, loginDoctors, monthlyAdmissions, normalize, nowStamp,
  riskClass, today, toCsv,
} from "./data";
import { Drawer, Empty, Icon, Input, Medallion, Sparkline, StatusBadge, Textarea, rd, showToast } from "./ui";

type PageState = "landing" | "login" | "signup" | "dashboard";
type TabKey = "overview" | "patients" | "devices" | "reports" | "backend";

const NAV: [TabKey, string, string][] = [
  ["overview", "Dashboard", "activity"],
  ["patients", "Patients", "users"],
  ["devices", "Devices", "zap"],
  ["reports", "Reports", "fileText"],
  ["backend", "Backend", "database"],
];
const TITLES: Record<TabKey, string> = {
  overview: "Dashboard", patients: "Patient Records", devices: "Device Monitoring", reports: "Clinical Reports", backend: "Backend Console",
};
const WARD_PHOTO = "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=1600&auto=format&fit=crop";
const TOOLTIP_STYLE = { background: "#f3efe9", border: "1px solid #e8e4df", borderRadius: 10, fontFamily: '"JetBrains Mono", monospace', fontSize: 12 } as const;

const riskAv: Record<RiskLevel, string> = {
  Critical: "linear-gradient(150deg,#c0746f,#7e3636)",
  Watch: "linear-gradient(150deg,#dba36f,#9c6233)",
  Stable: "linear-gradient(150deg,#3a6b4d,#163d24)",
};
const initials = (name: string) => name.split(" ").map((n) => n[0]).slice(0, 2).join("");

/* ---- Live vitals overlay (ephemeral, never persisted) ---- */
type Live = { pulse: number; sys: number; dia: number; spo2: number; dp: number; dbp: number; ds: number };
type Baseline = { pulse: number; sys: number; dia: number; spo2: number };

function parseBaseline(p: Patient): Baseline {
  const [sys, dia] = p.bp.split("/").map((n) => parseInt(n, 10));
  return { pulse: parseInt(p.pulse, 10) || 72, sys: sys || 120, dia: dia || 80, spo2: parseInt(p.spo2, 10) || 98 };
}
/** Random-walk one vital one tick, biased back toward its baseline, clamped to sane bounds. */
function walk(cur: number, base: number, lo: number, hi: number, maxStep: number) {
  const drift = (base - cur) * 0.25;
  const noise = (Math.random() * 2 - 1) * maxStep;
  let nv = Math.round(cur + drift + noise);
  if (nv === cur) nv += Math.random() < 0.5 ? 1 : -1;
  return Math.max(lo, Math.min(hi, nv));
}
const flashClass = (dir: number) => (dir > 0 ? "tick-up" : dir < 0 ? "tick-down" : "");

/* ============================ presentational pieces ============================ */
function Kpi({ label, value, delta, icon, tone }: { label: string; value: number | string; delta: string; icon: string; tone: "green" | "red" | "amber" | "blue" }) {
  return (
    <div className="kpi3d">
      <div className="k-top">
        <div className={`kpi3d-ic tone-${tone}`}><Icon name={icon} size={24} /></div>
        <span className="k-delta">{delta}</span>
      </div>
      <p className="k-val">{value}</p>
      <p className="k-lbl">{label}</p>
      <span className="k-spark"><Icon name={icon} size={92} /></span>
    </div>
  );
}

function PatientCard({ p, live, onEdit, onDelete }: { p: Patient; live?: Live; onEdit: () => void; onDelete: () => void }) {
  const cells: { l: string; v: string; dir?: number }[] = [
    { l: "BP", v: live ? `${live.sys}/${live.dia}` : p.bp, dir: live?.dbp },
    { l: "SpO₂", v: live ? `${live.spo2}%` : p.spo2, dir: live?.ds },
    { l: "Pulse", v: live ? String(live.pulse) : p.pulse.replace(" bpm", ""), dir: live?.dp },
    { l: "Temp", v: p.temp.replace(" F", "°") },
    { l: "Gluc", v: p.glucose.replace(" mg/dL", "") },
  ];
  return (
    <article className="pcard">
      <div className="flex-between" style={{ alignItems: "flex-start" }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center", minWidth: 0 }}>
          <div className="pc-av" style={{ background: riskAv[p.risk] }}>{initials(p.name)}</div>
          <div style={{ minWidth: 0 }}>
            <p className="pc-name">{p.name}</p>
            <p className="pc-id">{p.id} · {p.age}Y · {p.gender}</p>
          </div>
        </div>
        <span className={`badge ${riskClass(p.risk)}`}>{p.risk}</span>
      </div>
      <p className="pc-dx">{p.diagnosis}</p>
      <div className="vstrip">
        {cells.map((c) => (
          <div className="vc" key={c.l}>
            <div className="vl">{c.l}</div>
            <div className="vv">{c.dir !== undefined ? <span key={c.v} className={flashClass(c.dir)}>{c.v}</span> : c.v}</div>
          </div>
        ))}
      </div>
      <div className="pc-acts">
        <button className="ghost-act" onClick={onEdit}><Icon name="edit" size={14} /> Edit</button>
        <button className="ghost-act danger" onClick={onDelete}><Icon name="trash" size={14} /> Delete</button>
      </div>
    </article>
  );
}

function LiveTile({ p, live }: { p: Patient; live?: Live }) {
  const sys = live ? live.sys : parseBaseline(p).sys;
  const dia = live ? live.dia : parseBaseline(p).dia;
  const pulse = live ? live.pulse : parseBaseline(p).pulse;
  const spo2 = live ? live.spo2 : parseBaseline(p).spo2;
  const vitals: { l: string; v: string; dir: number }[] = [
    { l: "Pulse", v: String(pulse), dir: live?.dp ?? 0 },
    { l: "BP", v: `${sys}/${dia}`, dir: live?.dbp ?? 0 },
    { l: "SpO₂", v: `${spo2}%`, dir: live?.ds ?? 0 },
  ];
  return (
    <div className="ltile">
      <div className="flex-between" style={{ alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <p className="lt-name" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</p>
          <p className="lt-bed">{p.ward} · BED {p.bed}</p>
        </div>
        <span className={`lt-dot ${p.risk === "Critical" ? "crit" : "watch"}`} />
      </div>
      <div className="lt-vitals">
        {vitals.map((c) => (
          <div className="lt-v" key={c.l}>
            <div className="lt-vl">{c.l}</div>
            <div className="lt-vv"><span key={c.v} className={flashClass(c.dir)}>{c.v}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DeviceCard({ d }: { d: Device }) {
  const tone = d.status === "Online" ? "green" : d.status === "Offline" ? "red" : "amber";
  const color = d.status === "Online" ? "#1a472a" : d.status === "Offline" ? "#a84e4e" : "#c9724f";
  const pct = Math.max(4, parseInt(d.battery) || 0);
  return (
    <article className="dcard">
      <div className="flex-between" style={{ alignItems: "flex-start" }}>
        <div style={{ display: "flex", gap: 13, alignItems: "center", minWidth: 0 }}>
          <Medallion icon="pulse" tone={tone} />
          <div style={{ minWidth: 0 }}>
            <p className="dc-name">{d.name}</p>
            <p className="dc-meta">{d.id} · <Icon name="pin" size={11} className="inline" /> {d.location}</p>
          </div>
        </div>
        <StatusBadge status={d.status} />
      </div>
      <div className="dc-spark"><Sparkline data={deviceTrend(d.id)} color={color} /></div>
      <div style={{ marginTop: 6 }}>
        <div className="flex-between" style={{ marginBottom: 6 }}>
          <span className="mono-label" style={{ fontSize: 9 }}>Battery</span>
          <span className="mono-label" style={{ fontSize: 10, color: "var(--text-secondary)" }}>{d.battery}</span>
        </div>
        <div className="batt"><i style={{ width: `${pct}%` }} /></div>
      </div>
      <div className="flex-between" style={{ marginTop: 14 }}>
        <span className="reading-pill"><Icon name="wifi" size={13} /> {d.reading}</span>
        <span className="mono-label" style={{ fontSize: 9 }}>{d.category}</span>
      </div>
    </article>
  );
}

function ReportDoc({ p }: { p: Patient }) {
  const fields: [string, string][] = [
    ["Diagnosis", p.diagnosis], ["Blood Pressure", p.bp], ["Temperature", p.temp],
    ["SpO₂", p.spo2], ["Pulse", p.pulse], ["Glucose", p.glucose],
    ["Respiration", p.respiratoryRate], ["Allergies", p.allergies], ["Medication", p.medication],
  ];
  return (
    <article className="rdoc">
      <div className="letterhead">
        <div className="lh-mark">
          <Medallion icon="plus" tone="olive" />
          <div>
            <p className="lh-name">POONA Hospital</p>
            <p className="lh-sub">CLINICAL RECORD · {p.id}</p>
          </div>
        </div>
        <div className="lh-conf">Confidential<br />Clinical Record</div>
      </div>
      <p className="r-title">{p.name}</p>
      <p className="r-meta">{p.age} YRS · {p.gender.toUpperCase()} · {p.bloodGroup} · WARD {p.ward}-{p.bed} · UPDATED {p.lastUpdated}</p>
      <div className="vgrid">
        {fields.map(([k, v]) => (
          <div className="vg" key={k}><div className="k">{k}</div><div className="v">{v}</div></div>
        ))}
      </div>
      <div className="r-rule" />
      <p className="mono-label" style={{ fontSize: 9 }}>Attending notes</p>
      <p style={{ marginTop: 6, color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6 }}>{p.notes || "No additional notes recorded."}</p>
    </article>
  );
}

/* ============================ App ============================ */
function App() {
  const [backend, setBackend] = useState<BackendStore>(() => loadBackend());
  const [doctorId, setDoctorId] = useState(() => sessionStorage.getItem(SESSION_KEY) ?? "");
  const [page, setPage] = useState<PageState>(doctorId ? "dashboard" : "landing");

  const [doctorNameInput, setDoctorNameInput] = useState("");
  const [doctorIdInput, setDoctorIdInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [personaCode, setPersonaCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const [patientDraft, setPatientDraft] = useState<Patient | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [patientFilter, setPatientFilter] = useState<"All" | RiskLevel>("All");
  const [patientPage, setPatientPage] = useState(1);
  const PER_PAGE = 12;

  const [deviceSearch, setDeviceSearch] = useState("");
  const [reportSearch, setReportSearch] = useState("");
  const [jsonVisible, setJsonVisible] = useState(false);
  const [liveVitals, setLiveVitals] = useState<Record<string, Live>>({});

  const currentDoctor = backend.doctors.find((d) => d.id === doctorId && d.loginEnabled) ?? null;
  const myPatients = useMemo(() => backend.patients.filter((p) => p.doctorId === currentDoctor?.id), [backend.patients, currentDoctor?.id]);
  const myDevices = useMemo(() => backend.devices.filter((d) => d.assignedDoctorId === currentDoctor?.id), [backend.devices, currentDoctor?.id]);
  // Baselines parsed from the persisted record; the live ticker random-walks around these.
  const baselines = useMemo(() => {
    const map: Record<string, Baseline> = {};
    myPatients.forEach((p) => { map[p.id] = parseBaseline(p); });
    return map;
  }, [myPatients]);

  const filteredPatients = useMemo(() => {
    const q = normalize(patientSearch);
    return myPatients.filter((p) =>
      (patientFilter === "All" || p.risk === patientFilter) &&
      (!q || [p.name, p.id, p.diagnosis].some((v) => normalize(String(v)).includes(q))),
    );
  }, [myPatients, patientSearch, patientFilter]);
  const pageCount = Math.max(1, Math.ceil(filteredPatients.length / PER_PAGE));
  const pagePatients = filteredPatients.slice((patientPage - 1) * PER_PAGE, patientPage * PER_PAGE);

  const filteredDevices = useMemo(() => {
    const q = normalize(deviceSearch);
    return myDevices.filter((d) => !q || [d.name, d.id, d.location, d.category].some((v) => normalize(v).includes(q)));
  }, [myDevices, deviceSearch]);

  const critical = myPatients.filter((p) => p.risk === "Critical");
  const watch = myPatients.filter((p) => p.risk === "Watch");
  const stable = myPatients.filter((p) => p.risk === "Stable");
  const onlineDevices = myDevices.filter((d) => d.status === "Online");
  const admissions = useMemo(() => monthlyAdmissions(myPatients), [myPatients]);
  const wardData = useMemo(() => {
    const order = ["ICU", "HDU", "A", "B", "Day Care"];
    const counts = new Map<string, number>();
    myPatients.forEach((p) => counts.set(p.ward, (counts.get(p.ward) ?? 0) + 1));
    return order.filter((w) => counts.has(w)).map((w) => ({ label: w, value: counts.get(w) ?? 0 }));
  }, [myPatients]);
  // Showpiece: the doctor's highest-acuity patients on the live bedside board.
  const liveBoard = useMemo(() => [...critical, ...watch].slice(0, 6), [myPatients]); // eslint-disable-line react-hooks/exhaustive-deps
  const admToday = myPatients.filter((p) => p.admissionDate === today()).length;
  const todayStats: [string, string | number][] = [
    ["Admissions today", admToday],
    ["Discharges today", Math.max(1, Math.round(stable.length * 0.18))],
    ["Occupied beds", myPatients.length],
    ["Avg wait", `${10 + ((critical.length * 3 + watch.length) % 26)}m`],
  ];
  const riskData = [
    { name: "Stable", value: stable.length, fill: "#2d7a4a" },
    { name: "Watch", value: watch.length, fill: "#c9724f" },
    { name: "Critical", value: critical.length, fill: "#a84e4e" },
  ];
  const deviceStats = {
    online: myDevices.filter((d) => d.status === "Online").length,
    offline: myDevices.filter((d) => d.status === "Offline").length,
    maint: myDevices.filter((d) => d.status === "Maintenance").length,
    avgBatt: myDevices.length ? Math.round(myDevices.reduce((s, d) => s + (parseInt(d.battery) || 0), 0) / myDevices.length) : 0,
  };

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(backend)); }, [backend]);
  useEffect(() => {
    if (doctorId) { sessionStorage.setItem(SESSION_KEY, doctorId); setPage("dashboard"); }
    else sessionStorage.removeItem(SESSION_KEY);
  }, [doctorId]);

  // Seed the ephemeral live overlay from the baselines whenever the patient set changes.
  useEffect(() => {
    setLiveVitals(() => {
      const next: Record<string, Live> = {};
      for (const [id, b] of Object.entries(baselines)) next[id] = { ...b, dp: 0, dbp: 0, ds: 0 };
      return next;
    });
  }, [baselines]);

  // Bedside-monitor ticker: small biased random-walk deltas, paused when the tab is hidden.
  useEffect(() => {
    if (!currentDoctor || Object.keys(baselines).length === 0) return;
    let paused = document.hidden;
    const onVis = () => { paused = document.hidden; };
    document.addEventListener("visibilitychange", onVis);
    const id = window.setInterval(() => {
      if (paused) return;
      setLiveVitals((prev) => {
        const next: Record<string, Live> = {};
        for (const [pid, b] of Object.entries(baselines)) {
          const c = prev[pid] ?? { ...b, dp: 0, dbp: 0, ds: 0 };
          const pulse = walk(c.pulse, b.pulse, 35, 185, 2);
          const sys = walk(c.sys, b.sys, 78, 205, 2);
          const dia = walk(c.dia, b.dia, 45, 125, 2);
          const spo2 = walk(c.spo2, b.spo2, 84, 100, 1);
          next[pid] = { pulse, sys, dia, spo2, dp: Math.sign(pulse - c.pulse), dbp: Math.sign(sys - c.sys), ds: Math.sign(spo2 - c.spo2) };
        }
        return next;
      });
    }, 1300);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [currentDoctor?.id, baselines]);

  function writeAudit(action: string, next: BackendStore): BackendStore {
    return { ...next, auditLog: [{ id: `AUD-${Date.now()}`, doctorId: currentDoctor?.id ?? "unknown", doctorName: currentDoctor?.name ?? "Unknown", action, timestamp: nowStamp() }, ...next.auditLog].slice(0, 100) };
  }
  function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const match = backend.doctors.find((d) => d.loginEnabled && normalize(d.name) === normalize(doctorNameInput) && d.id === doctorIdInput.trim());
    if (!match) { setLoginError("Invalid credentials. Select a persona or check your doctor name and ID."); return; }
    setDoctorId(match.id); setLoginError(""); setDoctorNameInput(""); setDoctorIdInput("");
  }
  function logout() {
    setDoctorId(""); setPage("landing"); setActiveTab("overview");
    setDoctorNameInput(""); setDoctorIdInput(""); setPersonaCode(""); setLoginError(""); setPatientDraft(null); setShowDrawer(false);
  }
  function openNewPatient() { if (currentDoctor) { setPatientDraft(emptyPatient(currentDoctor.id)); setShowDrawer(true); } }
  function savePatient(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!currentDoctor || !patientDraft) return;
    const cleaned: Patient = { ...patientDraft, doctorId: currentDoctor.id, age: Number(patientDraft.age) || 0, id: patientDraft.id || `PAT-${currentDoctor.id.slice(-3)}-${Date.now().toString().slice(-5)}`, lastUpdated: nowStamp() };
    setBackend((store) => {
      const exists = store.patients.some((p) => p.id === cleaned.id);
      const patients = exists ? store.patients.map((p) => (p.id === cleaned.id && p.doctorId === currentDoctor.id ? cleaned : p)) : [cleaned, ...store.patients];
      return writeAudit(`${exists ? "Updated" : "Added"} patient ${cleaned.name}.`, { ...store, patients });
    });
    showToast("success", patientDraft.id ? "Patient record updated" : "Patient admitted");
    setShowDrawer(false); setPatientDraft(null); setPatientPage(1);
  }
  function deletePatient(p: Patient) {
    if (!currentDoctor || !window.confirm(`Delete ${p.name}? This cannot be undone.`)) return;
    setBackend((store) => writeAudit(`Deleted patient ${p.name}.`, {
      ...store,
      patients: store.patients.filter((x) => !(x.id === p.id && x.doctorId === currentDoctor.id)),
      devices: store.devices.map((d) => (d.assignedPatientId === p.id ? { ...d, assignedPatientId: "" } : d)),
    }));
    showToast("success", "Patient record removed");
  }
  function exportBackendJson() {
    const grouped = backend.doctors.reduce<Record<string, Patient[]>>((acc, d) => { acc[d.id] = backend.patients.filter((p) => p.doctorId === d.id); return acc; }, {});
    downloadFile("poona-hospital-backend.json", JSON.stringify({ ...backend, patientsByDoctor: grouped }, null, 2), "application/json");
    showToast("success", "Backend JSON exported");
  }
  function resetBackend() { if (window.confirm("Reset all data to seed?")) { setBackend(createSeedBackend()); showToast("info", "Data reset to seed"); } }

  /* ---------------------------- LANDING ---------------------------- */
  if (page === "landing") {
    const features: [string, string, string, "green" | "amber" | "red" | "blue" | "olive" | "tan"][] = [
      ["users", "Patient Management", "Longitudinal records, vitals history and care plans in one ledger.", "olive"],
      ["zap", "Device Monitoring", "Live mesh of bedside monitors, pumps and ventilators with alerting.", "blue"],
      ["activity", "Clinical Analytics", "Admission trends, risk distribution and shift-level throughput.", "tan"],
      ["shield", "Secure by Design", "Role-based access, encryption at rest and a full audit trail.", "green"],
      ["heart", "Care Quality", "Risk stratification keeps critical patients in constant view.", "red"],
      ["fileText", "Clinical Reports", "Print-ready, letterheaded documents for every patient.", "amber"],
    ];
    return (
      <div style={{ minHeight: "100vh" }}>
        <nav className="lp-nav">
          <div className="brandmark">
            <div className="bm-logo">⊕</div>
            <div><p className="bm-name">POONA HOSPITAL</p><p className="bm-sub">CARE · INTELLIGENCE · PRECISION</p></div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={() => setPage("login")} className="btn btn-outline">Sign in</button>
            <button onClick={() => setPage("signup")} className="btn btn-primary">Request access</button>
          </div>
        </nav>

        <main style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 32px 0" }}>
          <section className="lp-hero reveal" style={rd(0)}>
            <div className="access-pill" style={{ background: "#ffffff1f", borderColor: "#ffffff33", color: "#eef3ee" }}>
              <span className="dot" /> NABH ACCREDITED · TIER 1 FACILITY
            </div>
            <h1 style={{ marginTop: 18 }}>Healthcare,<br /><span className="accent">precisely managed.</span></h1>
            <p className="lp-sub">Real-time vitals, a connected device mesh and audit-logged clinical workflows — the command center POONA's teams run the ward from.</p>
            <div className="chip-row" style={{ marginTop: 22 }}>
              <span className="chip"><Icon name="zap" size={15} /> &lt;2s vitals sync</span>
              <span className="chip"><Icon name="pulse" size={15} /> Live device mesh</span>
              <span className="chip"><Icon name="bell" size={15} /> Critical alerting</span>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 26 }}>
              <button onClick={() => setPage("signup")} className="btn btn-lg" style={{ background: "linear-gradient(120deg,#f1e9dd,#d4a574)", color: "#163d24" }}>Request access <Icon name="arrowRight" size={16} /></button>
              <button onClick={() => setPage("login")} className="btn btn-lg btn-outline" style={{ color: "#fff", borderColor: "#ffffff66" }}>Sign in</button>
            </div>
          </section>

          <section style={{ marginTop: 44 }}>
            <p className="mono-label reveal" style={{ ...rd(0), textAlign: "center" }}>WHAT THE PLATFORM DOES</p>
            <h2 className="reveal" style={{ ...rd(1), textAlign: "center", marginTop: 8 }}>One system, the whole ward.</h2>
            <div className="cards-grid" style={{ marginTop: 28 }}>
              {features.map(([icon, title, desc, tone], i) => (
                <div key={title} className={`feature reveal ${i === 1 ? "photo" : ""}`} style={rd(i + 2)}>
                  {i === 1 ? (
                    <>
                      <div className="ph" style={{ backgroundImage: `url(${WARD_PHOTO})` }} />
                      <div className="bd"><Medallion icon={icon} tone={tone} /><h3>{title}</h3><div className="hr" /><p>{desc}</p></div>
                    </>
                  ) : (
                    <><Medallion icon={icon} tone={tone} /><h3>{title}</h3><div className="hr" /><p>{desc}</p></>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="stat3d-row reveal" style={{ ...rd(2), marginTop: 44 }}>
            {[["500+", "CONSULTING\nPHYSICIANS"], ["1.2M+", "PATIENT\nRECORDS"], ["99.9%", "PLATFORM\nUPTIME"], ["24/7", "CRITICAL\nCOVER"]].map(([v, l]) => (
              <div className="stat3d" key={v}><p className="s-val">{v}</p><p className="s-lbl" style={{ whiteSpace: "pre-line" }}>{l}</p></div>
            ))}
          </section>

          <section style={{ marginTop: 44 }}>
            <div className="sec-head"><div><p className="sh-eyebrow">CENTERS OF EXCELLENCE</p><h2>Departments</h2></div></div>
            <div className="cards-grid" style={{ marginTop: 22, gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))" }}>
              {departmentDirectory.map((d, i) => (
                <div className="dept-card reveal" key={d.name} style={rd(i)}>
                  <Medallion icon={d.icon} tone="olive" size="sm" />
                  <div><p className="dc-t">{d.name}</p><p className="dc-b">{d.beds} beds</p></div>
                </div>
              ))}
            </div>
          </section>
        </main>

        <footer className="lp-foot" style={{ maxWidth: 1200, margin: "44px auto 0", padding: "48px 40px" }}>
          <div className="grid-cols-4" style={{ alignItems: "start" }}>
            <div>
              <div className="brandmark"><div className="bm-logo">⊕</div><div><p className="bm-name" style={{ color: "#fff" }}>POONA HOSPITAL</p><p className="bm-sub" style={{ color: "#ffffff80" }}>EST. 2026</p></div></div>
              <p style={{ color: "#ffffffa8", fontSize: 13, marginTop: 16, maxWidth: 240, lineHeight: 1.6 }}>A precise clinical command center for modern hospital teams.</p>
            </div>
            <div><p className="fcol-h">Platform</p><button onClick={() => setPage("login")}>Doctor portal</button><a>Device mesh</a><a>Analytics</a><a>Reports</a></div>
            <div><p className="fcol-h">Facility</p><a>Departments</a><a>Accreditation</a><a>Careers</a><a>Contact</a></div>
            <div><p className="fcol-h">Compliance</p><a>ISO 27001</a><a>HIPAA-aligned</a><a>Audit logs</a><a>Privacy</a></div>
          </div>
          <p className="mono-label" style={{ color: "#ffffff66", marginTop: 36, fontSize: 10 }}>© 2026 POONA HOSPITAL · ALL RIGHTS RESERVED</p>
        </footer>
        <Toaster position="bottom-right" />
      </div>
    );
  }

  /* ---------------------------- LOGIN ---------------------------- */
  if (page === "login") {
    const personas = [
      { code: "ATTND-CARD", role: "Attending Physician", doc: loginDoctors[0], desc: "Live patient vitals, device mesh, and active care plans.", tag: "FULL WARD", icon: "heart" },
      { code: "ER-LEAD", role: "Emergency Lead", doc: loginDoctors[3], desc: "Triage queue, critical alerts, and rapid-admit controls.", tag: "ER · NIGHT", icon: "activity" },
      { code: "ONCO-CONS", role: "Oncology Consultant", doc: loginDoctors[9], desc: "Long-care cohorts, reports, and full audit trail.", tag: "READ + WRITE", icon: "users" },
    ];
    const pick = (p: (typeof personas)[number]) => { setPersonaCode(p.code); setDoctorNameInput(p.doc.name); setDoctorIdInput(p.doc.id); setLoginError(""); };
    return (
      <div className="auth-split">
        <div className="auth-left">
          <div className="brandmark"><div className="bm-logo">⊕</div><div><p className="bm-name">POONA HOSPITAL</p><p className="bm-sub">CARE · INTELLIGENCE · PRECISION</p></div></div>
          <div>
            <div className="access-pill"><span className="dot" /> NABH ACCREDITED · TIER 1 FACILITY</div>
            <h1 className="auth-headline">Intelligent care<br />for <span className="accent">every patient.</span></h1>
            <p className="auth-sub">Real-time vitals, connected device monitoring, and audit-logged clinical workflows — built for hospital teams operating at ward, department, and network scale.</p>
            <div className="chip-row" style={{ marginTop: 24 }}>
              <span className="chip"><Icon name="zap" size={15} /> &lt;2s vitals sync</span>
              <span className="chip"><Icon name="droplet" size={15} /> Live device mesh</span>
              <span className="chip"><Icon name="bell" size={15} /> Critical alerting</span>
            </div>
          </div>
          <div>
            <div className="stat3d-row">
              <div className="stat3d"><p className="s-val">500+</p><p className="s-lbl">CONSULTING<br />PHYSICIANS</p></div>
              <div className="stat3d"><p className="s-val">1.2M+</p><p className="s-lbl">PATIENT<br />RECORDS</p></div>
              <div className="stat3d"><p className="s-val">99.9%</p><p className="s-lbl">PLATFORM<br />UPTIME</p></div>
            </div>
            <div className="trust-row" style={{ marginTop: 26 }}>
              <span className="it"><Icon name="check" size={13} /> ISO 27001</span><span className="sep">|</span>
              <span className="it"><Icon name="eye" size={13} /> HIPAA-ALIGNED</span><span className="sep">|</span>
              <span className="it"><Icon name="clock" size={13} /> AUDIT-LOGGED</span>
            </div>
          </div>
        </div>
        <div className="auth-right">
          <div className="auth-panel">
            <p className="mono-label">SECURE ACCESS · DOCTOR PORTAL</p>
            <h2>Select your access persona</h2>
            <p className="lead">Choose the clinical profile you're entering as. Credentials are auto-provisioned for this demo build.</p>
            {personas.map((p) => (
              <button key={p.code} type="button" onClick={() => pick(p)} className={`persona-card ${personaCode === p.code ? "active" : ""}`}>
                <span className="persona-ic"><Icon name={p.icon} size={20} /></span>
                <span className="persona-tt">
                  <span className="pt-top"><span className="pt-name">{p.role}</span><span className="pt-code">{p.code}</span></span>
                  <span className="pt-desc">{p.desc}</span>
                </span>
                <span className="persona-tag">{p.tag}</span>
              </button>
            ))}
            <form onSubmit={handleLogin}>
              <label className="field-label">Attending Physician</label>
              <div className="field-wrap"><span className="fw-ic"><Icon name="user" size={16} /></span>
                <input type="text" value={doctorNameInput} onChange={(e) => setDoctorNameInput(e.target.value)} placeholder="select an access persona above" className="input" required />
              </div>
              <label className="field-label">Secure Doctor ID</label>
              <div className="field-wrap"><span className="fw-ic"><Icon name="key" size={16} /></span>
                <input type={showPassword ? "text" : "password"} value={doctorIdInput} onChange={(e) => setDoctorIdInput(e.target.value)} placeholder="••••••••" className="input" required />
                <button type="button" className="fw-eye" onClick={() => setShowPassword((v) => !v)}><Icon name="eye" size={16} /></button>
              </div>
              {loginError ? <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "#a84e4e14", border: "1px solid #a84e4e3a", color: "var(--danger)", fontSize: 13 }}>{loginError}</div> : null}
              <button type="submit" className="btn-launch">Enter patient console <Icon name="chevron" size={16} /></button>
            </form>
            <div className="auth-note"><Icon name="shield" size={15} /><span>Rotating session tokens. Account locks after 5 failed attempts. Every login is audit-logged with IP, device, and timestamp.</span></div>
            <p className="auth-swap">No clinician account yet? <button onClick={() => setPage("signup")}>Request access</button></p>
            <p className="auth-swap" style={{ marginTop: 8 }}><button onClick={() => setPage("landing")} style={{ color: "var(--text-tertiary)", fontWeight: 600 }}>← Back to site</button></p>
          </div>
        </div>
        <Toaster position="bottom-right" />
      </div>
    );
  }

  /* ---------------------------- SIGNUP ---------------------------- */
  if (page === "signup") {
    return (
      <div className="auth-split">
        <div className="auth-left">
          <div className="brandmark"><div className="bm-logo">⊕</div><div><p className="bm-name">POONA HOSPITAL</p><p className="bm-sub">CARE · INTELLIGENCE · PRECISION</p></div></div>
          <div>
            <div className="access-pill"><span className="dot" /> ONBOARDING · CREDENTIALED STAFF</div>
            <h1 className="auth-headline">Bring your ward<br /><span className="accent">online.</span></h1>
            <p className="auth-sub">Provision a secure clinician workspace in minutes. Role-based access, encrypted patient records, and connected device monitoring out of the box.</p>
            <div className="chip-row" style={{ marginTop: 24 }}>
              <span className="chip"><Icon name="check" size={15} /> Role-based access</span>
              <span className="chip"><Icon name="droplet" size={15} /> Encrypted records</span>
              <span className="chip"><Icon name="activity" size={15} /> Live analytics</span>
            </div>
          </div>
          <div className="trust-row">
            <span className="it"><Icon name="check" size={13} /> ISO 27001</span><span className="sep">|</span>
            <span className="it"><Icon name="eye" size={13} /> HIPAA-ALIGNED</span><span className="sep">|</span>
            <span className="it"><Icon name="clock" size={13} /> AUDIT-LOGGED</span>
          </div>
        </div>
        <div className="auth-right">
          <div className="auth-panel">
            <p className="mono-label">REQUEST ACCESS · NEW WORKSPACE</p>
            <h2>Create your hospital account</h2>
            <p className="lead">Tell us about your facility. Our team provisions verified clinical accounts within one business day.</p>
            <label className="field-label">Hospital / Facility Name</label>
            <div className="field-wrap"><span className="fw-ic"><Icon name="building" size={16} /></span><input type="text" placeholder="POONA Hospital, Pune" className="input" /></div>
            <label className="field-label">Administrator Email</label>
            <div className="field-wrap"><span className="fw-ic"><Icon name="bell" size={16} /></span><input type="email" placeholder="admin@poonahospital.example" className="input" /></div>
            <div className="grid-cols-2" style={{ gap: 14 }}>
              <div><label className="field-label">Password</label><div className="field-wrap"><span className="fw-ic"><Icon name="key" size={16} /></span><input type="password" placeholder="••••••••" className="input" /></div></div>
              <div><label className="field-label">Confirm</label><div className="field-wrap"><span className="fw-ic"><Icon name="check" size={16} /></span><input type="password" placeholder="••••••••" className="input" /></div></div>
            </div>
            <button className="btn-launch" onClick={() => setPage("login")}>Request clinician access <Icon name="chevron" size={16} /></button>
            <div className="auth-note"><Icon name="check" size={15} /><span>All workspaces are encrypted at rest and in transit. Access is granted only to verified, licensed medical staff.</span></div>
            <p className="auth-swap">Already credentialed? <button onClick={() => setPage("login")}>Sign in</button></p>
            <p className="auth-swap" style={{ marginTop: 8 }}><button onClick={() => setPage("landing")} style={{ color: "var(--text-tertiary)", fontWeight: 600 }}>← Back to site</button></p>
          </div>
        </div>
        <Toaster position="bottom-right" />
      </div>
    );
  }

  if (!currentDoctor) return null;
  const shortName = currentDoctor.name.replace(/^Dr\.\s*/, "");

  /* ---------------------------- DASHBOARD ---------------------------- */
  return (
    <div className="app-shell">
      {sidebarOpen ? <div className="side-backdrop" onClick={() => setSidebarOpen(false)} /> : null}
      <aside className={`side ${sidebarOpen ? "open" : ""}`}>
        <div className="side-logo">
          <div className="sl-mark">⊕</div>
          <div><p className="sl-name">POONA</p><p className="sl-sub">CLINICAL CONSOLE</p></div>
        </div>
        <div className="side-doc">
          <div className="sd-row">
            <div className="sd-av">{initials(shortName)}</div>
            <div style={{ minWidth: 0 }}><p className="sd-name">{currentDoctor.name}</p><p className="sd-dept">{currentDoctor.specialization}</p></div>
          </div>
          <div className="sd-meta">
            <span>RM {currentDoctor.room}</span><span>·</span><span>{currentDoctor.shift}</span>
            <span className="sd-live" style={{ marginLeft: "auto" }}><i /> ON DUTY</span>
          </div>
        </div>
        <nav className="side-nav">
          {NAV.map(([key, label, icon]) => (
            <button key={key} className={`nav-item ${activeTab === key ? "active" : ""}`} onClick={() => { setActiveTab(key); setSidebarOpen(false); }}>
              <span className="nav-ic"><Icon name={icon} size={17} /></span>{label}
            </button>
          ))}
        </nav>
        <div className="side-signout"><button onClick={logout} className="nav-item" style={{ width: "100%" }}><span className="nav-ic"><Icon name="logout" size={17} /></span>Sign out</button></div>
      </aside>

      <div className="main-col">
        <header className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button className="bell no-print" style={{ display: "none" }} aria-hidden />
            <button onClick={() => setSidebarOpen(true)} className="bell" style={{ width: 42, height: 42 }} aria-label="Menu" data-mobile><Icon name="menu" size={20} /></button>
            <div><p className="tb-crumb">POONA / {TITLES[activeTab]}</p><p className="tb-title">{TITLES[activeTab]}</p></div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span className="mono-label" style={{ fontSize: 10 }}>{nowStamp()}</span>
            <div style={{ position: "relative" }}>
              <button className="bell" onClick={() => setNotifOpen((v) => !v)} aria-label="Notifications">
                <Icon name="bell" size={19} />
                {critical.length ? <span className="bc">{critical.length}</span> : null}
              </button>
              {notifOpen ? (
                <div style={{ position: "absolute", right: 0, top: 52, width: 300, zIndex: 30, padding: 16, borderRadius: 16, background: "var(--bg-primary)", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)" }}>
                  <p className="mono-label" style={{ fontSize: 10, marginBottom: 12 }}>CRITICAL ALERTS · {critical.length}</p>
                  {critical.length ? critical.slice(0, 5).map((p) => (
                    <div key={p.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "9px 0", borderTop: "1px solid var(--border-light)" }}>
                      <span style={{ color: "var(--danger)" }}><Icon name="alert" size={16} /></span>
                      <div style={{ minWidth: 0 }}><p style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14 }}>{p.name}</p><p className="mono-label" style={{ fontSize: 9 }}>{p.diagnosis}</p></div>
                    </div>
                  )) : <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>No critical patients. All stable.</p>}
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <div className="content">
          {/* ===== OVERVIEW ===== */}
          {activeTab === "overview" && (
            <div style={{ display: "grid", gap: 22 }}>
              <div className="grid-cols-4">
                {([
                  ["Total Patients", myPatients.length, "UNDER YOUR CARE", "users", "green"],
                  ["Critical Cases", critical.length, "NEEDS REVIEW", "alert", "red"],
                  ["Active Devices", onlineDevices.length, `${myDevices.length} TOTAL`, "zap", "amber"],
                  ["On Watch", watch.length, "MONITORING", "activity", "blue"],
                ] as [string, number, string, string, "green" | "red" | "amber" | "blue"][]).map(([l, v, d, ic, t], i) => (
                  <div key={l} className="reveal" style={rd(i)}><Kpi label={l} value={v} delta={d} icon={ic} tone={t} /></div>
                ))}
              </div>

              {/* Today strip */}
              <div className="grid-cols-4">
                {todayStats.map(([l, v], i) => (
                  <div key={l} className="panel reveal" style={{ ...rd(i), padding: "18px 20px" }}>
                    <p className="mono-label" style={{ fontSize: 9 }}>{l}</p>
                    <p className="num" style={{ fontSize: 30, marginTop: 6 }}>{v}</p>
                  </div>
                ))}
              </div>

              {/* Live Monitor — the bedside board */}
              <div className="panel reveal" style={{ ...rd(1), padding: 24 }}>
                <div className="flex-between" style={{ marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                  <div><p className="mono-label">REAL-TIME · BEDSIDE BOARD</p><h3 style={{ marginTop: 4 }}>Live Monitor</h3></div>
                  <span className="live-pill"><i /> STREAMING · {nowStamp().split(", ")[1] ?? "live"}</span>
                </div>
                {(() => {
                  const board = liveBoard.length ? liveBoard : myPatients.slice(0, 6);
                  return board.length ? (
                    <div className="lmon-grid">
                      {board.map((p) => <LiveTile key={p.id} p={p} live={liveVitals[p.id]} />)}
                    </div>
                  ) : <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>No patients to monitor yet.</p>;
                })()}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 22 }} className="ov-charts">
                <div className="panel reveal" style={{ ...rd(1), padding: 24 }}>
                  <p className="mono-label">SIX-MONTH TREND</p>
                  <h3 style={{ marginTop: 4, marginBottom: 14 }}>Patient Admissions</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={admissions} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <defs><linearGradient id="adm" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1a472a" stopOpacity={0.35} /><stop offset="100%" stopColor="#1a472a" stopOpacity={0} /></linearGradient></defs>
                      <XAxis dataKey="label" stroke="#8b8680" tickLine={false} axisLine={false} fontSize={12} fontFamily="JetBrains Mono" />
                      <YAxis stroke="#8b8680" tickLine={false} axisLine={false} fontSize={12} fontFamily="JetBrains Mono" width={36} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Area type="monotone" dataKey="value" stroke="#1a472a" strokeWidth={2.5} fill="url(#adm)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="panel reveal" style={{ ...rd(2), padding: 24 }}>
                  <p className="mono-label">RISK DISTRIBUTION</p>
                  <h3 style={{ marginTop: 4 }}>Patient Acuity</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart><Pie data={riskData} cx="50%" cy="50%" innerRadius={52} outerRadius={84} paddingAngle={3} dataKey="value" stroke="none">{riskData.map((e) => <Cell key={e.name} fill={e.fill} />)}</Pie><Tooltip contentStyle={TOOLTIP_STYLE} /></PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 6 }}>
                    {riskData.map((e) => <span key={e.name} className="mono-label" style={{ fontSize: 9, display: "inline-flex", alignItems: "center", gap: 6 }}><i style={{ width: 8, height: 8, borderRadius: 2, background: e.fill }} /> {e.name} {e.value}</span>)}
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 22 }} className="ov-charts">
                <div className="panel reveal" style={{ ...rd(3), padding: 24 }}>
                  <div className="flex-between" style={{ marginBottom: 6 }}><div><p className="mono-label">RECENT PATIENTS</p><h3 style={{ marginTop: 4 }}>Latest under your care</h3></div><button className="ghost-act" onClick={() => setActiveTab("patients")}>View all <Icon name="arrowRight" size={13} /></button></div>
                  <div style={{ overflowX: "auto", marginTop: 8 }}>
                    <table className="etable" style={{ minWidth: 440 }}>
                      <thead><tr><th>Patient</th><th>Diagnosis</th><th>Acuity</th><th>Updated</th></tr></thead>
                      <tbody>
                        {myPatients.slice(0, 6).map((p) => (
                          <tr key={p.id}>
                            <td><span className="pname">{p.name}</span><div className="mono-label" style={{ fontSize: 9, marginTop: 2 }}>{p.id}</div></td>
                            <td>{p.diagnosis}</td>
                            <td><span className={`badge ${riskClass(p.risk)}`}>{p.risk}</span></td>
                            <td className="mono-label" style={{ fontSize: 9 }}>{p.lastUpdated}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="panel reveal" style={{ ...rd(4), padding: 24, alignSelf: "start" }}>
                  <p className="mono-label">CENSUS</p>
                  <h3 style={{ marginTop: 4, marginBottom: 10 }}>Patients by Ward</h3>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={wardData} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
                      <XAxis type="number" hide /><YAxis type="category" dataKey="label" stroke="#8b8680" tickLine={false} axisLine={false} width={70} fontSize={11} fontFamily="JetBrains Mono" />
                      <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#1a472a0a" }} />
                      <Bar dataKey="value" radius={[0, 8, 8, 0]} fill="#1a472a" barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Critical Alerts + Activity */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }} className="ov-charts">
                <div className="panel reveal" style={{ ...rd(2), padding: 24, alignSelf: "start" }}>
                  <p className="mono-label" style={{ color: "var(--danger)" }}>CRITICAL ALERTS</p>
                  <h3 style={{ marginTop: 4, marginBottom: 10 }}>Triggered by live vitals</h3>
                  {critical.length ? critical.slice(0, 5).map((p) => {
                    const lv = liveVitals[p.id];
                    return (
                      <div key={p.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 0", borderTop: "1px solid var(--border-light)" }}>
                        <Medallion icon="alert" tone="red" size="sm" />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14 }}>{p.name}</p>
                          <p className="mono-label" style={{ fontSize: 9 }}>{p.diagnosis} · {p.lastUpdated}</p>
                        </div>
                        {lv ? (
                          <div style={{ textAlign: "right", flex: "none" }}>
                            <p className="mono-label" style={{ fontSize: 8 }}>SpO₂ / PULSE</p>
                            <p style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--danger)" }}>
                              <span key={lv.spo2} className={flashClass(lv.ds)}>{lv.spo2}%</span> · <span key={lv.pulse} className={flashClass(lv.dp)}>{lv.pulse}</span>
                            </p>
                          </div>
                        ) : null}
                      </div>
                    );
                  }) : <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>No critical patients right now. All stable.</p>}
                </div>
                <div className="panel reveal" style={{ ...rd(3), padding: 24, alignSelf: "start" }}>
                  <p className="mono-label">AUDIT TRAIL</p>
                  <h3 style={{ marginTop: 4, marginBottom: 10 }}>Recent activity</h3>
                  {backend.auditLog.slice(0, 6).map((a) => (
                    <div key={a.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 0", borderTop: "1px solid var(--border-light)" }}>
                      <span style={{ color: "var(--primary)", marginTop: 2 }}><Icon name="clock" size={15} /></span>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.4 }}>{a.action}</p>
                        <p className="mono-label" style={{ fontSize: 9, marginTop: 3 }}>{a.doctorName} · {a.timestamp}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ===== PATIENTS ===== */}
          {activeTab === "patients" && (
            <div style={{ display: "grid", gap: 22 }}>
              <div className="reveal" style={{ ...rd(0), position: "relative", overflow: "hidden", borderRadius: 18, padding: 28, color: "#f3efe9", background: "#163d24" }}>
                <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${WARD_PHOTO})`, backgroundSize: "cover", backgroundPosition: "center", opacity: 0.4 }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(100deg,#0f2818ee 40%,#163d2499)" }} />
                <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
                  <div><p className="mono-label" style={{ color: "#ffffff99" }}>POONA / PATIENTS / {currentDoctor.specialization.toUpperCase()}</p><h2 style={{ color: "#fff", marginTop: 6 }}>Your patient ledger</h2><p style={{ color: "#e7ece6", marginTop: 6, fontSize: 14 }}>{myPatients.length} admitted · {critical.length} critical · {watch.length} on watch</p></div>
                  <button onClick={openNewPatient} className="btn-launch" style={{ width: "auto", marginTop: 0 }}>Admit patient <Icon name="plus" size={15} /></button>
                </div>
              </div>

              <div className="flex-between" style={{ gap: 14, flexWrap: "wrap" }}>
                <div className="chip-row">
                  {(["All", "Critical", "Watch", "Stable"] as const).map((f) => (
                    <button key={f} className={`fpill ${patientFilter === f ? "active" : ""}`} onClick={() => { setPatientFilter(f); setPatientPage(1); }}>{f}</button>
                  ))}
                </div>
                <div className="field-wrap" style={{ minWidth: 240, flex: "0 1 320px" }}>
                  <span className="fw-ic"><Icon name="search" size={16} /></span>
                  <input className="input" placeholder="Search name, ID, diagnosis…" value={patientSearch} onChange={(e) => { setPatientSearch(e.target.value); setPatientPage(1); }} />
                </div>
              </div>

              {pagePatients.length ? (
                <div className="cards-grid">
                  {pagePatients.map((p, i) => <div key={p.id} className="reveal" style={rd(i)}><PatientCard p={p} live={liveVitals[p.id]} onEdit={() => { setPatientDraft({ ...p }); setShowDrawer(true); }} onDelete={() => deletePatient(p)} /></div>)}
                </div>
              ) : (
                <div className="panel"><Empty icon="users" title="No patients match" sub="Adjust the filter or admit a new patient" action={<button className="btn btn-primary" onClick={openNewPatient}><Icon name="plus" size={15} /> Admit patient</button>} /></div>
              )}

              {pageCount > 1 ? (
                <div className="pager">
                  <button onClick={() => setPatientPage((n) => Math.max(1, n - 1))} disabled={patientPage === 1}><Icon name="chevronLeft" size={15} /></button>
                  {Array.from({ length: pageCount }).map((_, i) => <button key={i} className={patientPage === i + 1 ? "active" : ""} onClick={() => setPatientPage(i + 1)}>{i + 1}</button>)}
                  <button onClick={() => setPatientPage((n) => Math.min(pageCount, n + 1))} disabled={patientPage === pageCount}><Icon name="chevron" size={15} /></button>
                </div>
              ) : null}
            </div>
          )}

          {/* ===== DEVICES ===== */}
          {activeTab === "devices" && (
            <div style={{ display: "grid", gap: 22 }}>
              <div className="grid-cols-4">
                {([
                  ["Online", deviceStats.online, "STREAMING", "wifi", "green"],
                  ["Offline", deviceStats.offline, "NO SIGNAL", "zap", "red"],
                  ["Maintenance", deviceStats.maint, "SERVICING", "refresh", "amber"],
                  ["Avg Battery", `${deviceStats.avgBatt}%`, "FLEET", "battery", "blue"],
                ] as [string, number | string, string, string, "green" | "red" | "amber" | "blue"][]).map(([l, v, d, ic, t], i) => (
                  <div key={l} className="reveal" style={rd(i)}><Kpi label={l} value={v} delta={d} icon={ic} tone={t} /></div>
                ))}
              </div>
              <div className="flex-between" style={{ gap: 14, flexWrap: "wrap" }}>
                <div><p className="sh-eyebrow">CONNECTED FLEET</p><h2>Device Mesh</h2></div>
                <div className="field-wrap" style={{ minWidth: 240, flex: "0 1 320px" }}><span className="fw-ic"><Icon name="search" size={16} /></span><input className="input" placeholder="Search device, location…" value={deviceSearch} onChange={(e) => setDeviceSearch(e.target.value)} /></div>
              </div>
              {filteredDevices.length ? (
                <div className="cards-grid">{filteredDevices.map((d, i) => <div key={d.id} className="reveal" style={rd(i)}><DeviceCard d={d} /></div>)}</div>
              ) : (
                <div className="panel"><Empty icon="zap" title="No devices found" sub="No connected devices match this search" /></div>
              )}
            </div>
          )}

          {/* ===== REPORTS ===== */}
          {activeTab === "reports" && (
            <div style={{ display: "grid", gap: 22 }}>
              <div className="flex-between no-print" style={{ gap: 14, flexWrap: "wrap" }}>
                <div><p className="sh-eyebrow">PRINT-READY CLINICAL DOCUMENTS</p><h2>Patient Reports</h2></div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <div className="field-wrap" style={{ minWidth: 220 }}><span className="fw-ic"><Icon name="search" size={16} /></span><input className="input" placeholder="Search patient…" value={reportSearch} onChange={(e) => setReportSearch(e.target.value)} /></div>
                  <button className="btn btn-secondary" onClick={() => downloadFile(`patients-${currentDoctor.id}.csv`, toCsv(myPatients as unknown as Record<string, unknown>[]), "text/csv")}><Icon name="download" size={15} /> CSV</button>
                  <button className="btn btn-primary" onClick={() => window.print()}><Icon name="printer" size={15} /> Print / PDF</button>
                </div>
              </div>
              {(() => {
                const list = myPatients.filter((p) => !reportSearch || p.name.toLowerCase().includes(reportSearch.toLowerCase()));
                return list.length ? (
                  <div style={{ display: "grid", gap: 22 }}>{list.map((p, i) => <div key={p.id} className="reveal" style={rd(Math.min(i, 6))}><ReportDoc p={p} /></div>)}</div>
                ) : <div className="panel no-print"><Empty icon="fileText" title="No reports" sub="No patient matches this search" /></div>;
              })()}
            </div>
          )}

          {/* ===== BACKEND ===== */}
          {activeTab === "backend" && (
            <div style={{ display: "grid", gap: 22 }}>
              <div className="grid-cols-4">
                {([
                  ["Doctors", backend.doctors.length, "DIRECTORY", "users", "green"],
                  ["Patients", backend.patients.length, "RECORDS", "heart", "red"],
                  ["Devices", backend.devices.length, "FLEET", "zap", "amber"],
                  ["Audit Logs", backend.auditLog.length, "EVENTS", "fileText", "blue"],
                ] as [string, number, string, string, "green" | "red" | "amber" | "blue"][]).map(([l, v, d, ic, t], i) => (
                  <div key={l} className="reveal" style={rd(i)}><Kpi label={l} value={v} delta={d} icon={ic} tone={t} /></div>
                ))}
              </div>
              <div className="panel reveal" style={{ ...rd(1), padding: 24 }}>
                <div className="flex-between" style={{ flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
                  <div><p className="mono-label">PERSISTENT STORE · localStorage</p><h3 style={{ marginTop: 4 }}>Backend Console</h3></div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button className="btn btn-primary" onClick={exportBackendJson}><Icon name="download" size={15} /> JSON</button>
                    <button className="btn btn-secondary" onClick={() => downloadFile("poona-doctors.csv", toCsv(backend.doctors as unknown as Record<string, unknown>[]), "text/csv")}><Icon name="download" size={15} /> Doctors CSV</button>
                    <button className="btn btn-outline" onClick={() => setJsonVisible((v) => !v)}><Icon name="eye" size={15} /> {jsonVisible ? "Hide" : "Show"} JSON</button>
                    <button className="btn btn-danger" onClick={resetBackend}><Icon name="refresh" size={15} /> Reset</button>
                  </div>
                </div>
                {jsonVisible ? (
                  <div className="terminal">
                    <div className="t-bar"><i style={{ background: "#c0746f" }} /><i style={{ background: "#dba36f" }} /><i style={{ background: "#6fce86" }} /><span className="mono-label">poona@backend ~ store.json</span></div>
                    <pre>{JSON.stringify({ version: backend.version, doctors: backend.doctors.length, patients: backend.patients.length, devices: backend.devices.length, sample: backend.patients.slice(0, 2) }, null, 2)}</pre>
                  </div>
                ) : (
                  <div className="terminal"><div className="t-bar"><i style={{ background: "#c0746f" }} /><i style={{ background: "#dba36f" }} /><i style={{ background: "#6fce86" }} /><span className="mono-label">poona@backend ~</span></div><pre>$ store ready · {backend.patients.length} patients · {backend.devices.length} devices{"\n"}$ press "Show JSON" to inspect the persisted store_</pre></div>
                )}
              </div>
              <div className="panel reveal" style={{ ...rd(2), padding: 24 }}>
                <p className="mono-label">DIRECTORY · FIRST 10 LOGIN-ENABLED</p>
                <h3 style={{ marginTop: 4, marginBottom: 8 }}>Consulting Physicians</h3>
                <div style={{ overflowX: "auto" }}>
                  <table className="etable" style={{ minWidth: 560 }}>
                    <thead><tr><th>Doctor</th><th>Department</th><th>Room</th><th>Shift</th></tr></thead>
                    <tbody>{loginDoctors.map((d) => (<tr key={d.id}><td><span className="pname">{d.name}</span><div className="mono-label" style={{ fontSize: 9, marginTop: 2 }}>{d.id}</div></td><td>{d.department}</td><td className="mono-label" style={{ fontSize: 10 }}>{d.room}</td><td>{d.shift}</td></tr>))}</tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <Drawer
        isOpen={showDrawer}
        onClose={() => { setShowDrawer(false); setPatientDraft(null); }}
        title={patientDraft?.id ? "Edit patient" : "Admit patient"}
        actions={<button className="btn btn-primary" style={{ flex: 1 }} onClick={() => (document.getElementById("patient-form") as HTMLFormElement | null)?.requestSubmit()}>{patientDraft?.id ? "Save changes" : "Admit patient"}</button>}
      >
        {patientDraft ? (
          <form id="patient-form" onSubmit={savePatient} style={{ display: "grid", gap: 16 }}>
            <Input label="Full name" value={patientDraft.name} onChange={(v) => setPatientDraft({ ...patientDraft, name: v })} required />
            <div className="grid-cols-2">
              <Input label="Age" type="number" value={patientDraft.age} onChange={(v) => setPatientDraft({ ...patientDraft, age: Number(v) })} />
              <label className="form-group" style={{ marginBottom: 0 }}><span className="field-label" style={{ margin: 0 }}>Gender</span>
                <select className="select" value={patientDraft.gender} onChange={(e) => setPatientDraft({ ...patientDraft, gender: e.target.value as Patient["gender"] })}><option>Female</option><option>Male</option><option>Other</option></select>
              </label>
            </div>
            <div className="grid-cols-2">
              <Input label="Blood group" value={patientDraft.bloodGroup} onChange={(v) => setPatientDraft({ ...patientDraft, bloodGroup: v })} />
              <label className="form-group" style={{ marginBottom: 0 }}><span className="field-label" style={{ margin: 0 }}>Acuity</span>
                <select className="select" value={patientDraft.risk} onChange={(e) => setPatientDraft({ ...patientDraft, risk: e.target.value as RiskLevel })}><option>Stable</option><option>Watch</option><option>Critical</option></select>
              </label>
            </div>
            <Input label="Diagnosis" value={patientDraft.diagnosis} onChange={(v) => setPatientDraft({ ...patientDraft, diagnosis: v })} required />
            <div className="grid-cols-2">
              <Input label="Blood pressure" value={patientDraft.bp} onChange={(v) => setPatientDraft({ ...patientDraft, bp: v })} />
              <Input label="Pulse" value={patientDraft.pulse} onChange={(v) => setPatientDraft({ ...patientDraft, pulse: v })} />
            </div>
            <div className="grid-cols-2">
              <Input label="SpO₂" value={patientDraft.spo2} onChange={(v) => setPatientDraft({ ...patientDraft, spo2: v })} />
              <Input label="Temperature" value={patientDraft.temp} onChange={(v) => setPatientDraft({ ...patientDraft, temp: v })} />
            </div>
            <div className="grid-cols-2">
              <Input label="Glucose" value={patientDraft.glucose} onChange={(v) => setPatientDraft({ ...patientDraft, glucose: v })} />
              <Input label="Allergies" value={patientDraft.allergies} onChange={(v) => setPatientDraft({ ...patientDraft, allergies: v })} />
            </div>
            <Input label="Medication" value={patientDraft.medication} onChange={(v) => setPatientDraft({ ...patientDraft, medication: v })} />
            <Textarea label="Attending notes" value={patientDraft.notes} onChange={(v) => setPatientDraft({ ...patientDraft, notes: v })} />
          </form>
        ) : null}
      </Drawer>

      <Toaster position="bottom-right" />
    </div>
  );
}

export default App;
