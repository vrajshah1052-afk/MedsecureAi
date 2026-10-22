// Reusable UI primitives: icon set, embossed medallion, reveal motion,
// device sparkline, designed empty state, form fields, drawer and toasts.
import { type CSSProperties, type ReactNode } from "react";
import toast from "react-hot-toast";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

/* ----------------------------- Icons (24x24 stroke) ----------------------------- */
const ICONS: Record<string, ReactNode> = {
  menu: <path d="M3 6h18M3 12h18M3 18h18" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  search: (<><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>),
  plus: <path d="M12 5v14M5 12h14" />,
  trash: (<><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M10 11v6M14 11v6" /></>),
  edit: (<><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>),
  chevron: <path d="m9 18 6-6-6-6" />,
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  arrowRight: (<><path d="M5 12h14" /><path d="m13 5 7 7-7 7" /></>),
  check: <path d="M20 6 9 17l-5-5" />,
  alert: (<><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></>),
  bell: (<><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>),
  clock: (<><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>),
  heart: <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />,
  download: (<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /><path d="M12 15V3" /></>),
  logout: (<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></>),
  key: (<><circle cx="7.5" cy="15.5" r="4.5" /><path d="m21 2-9.6 9.6" /><path d="m15.5 7.5 3 3L22 7l-3-3" /></>),
  user: (<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>),
  users: (<><path d="M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1" /><circle cx="9" cy="7" r="4" /><path d="M22 19v-1a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>),
  activity: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  pulse: <path d="M3 12h4l2-7 4 14 2-7h6" />,
  droplet: <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />,
  thermometer: <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4 4 0 1 0 5 0z" />,
  zap: <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />,
  battery: (<><rect x="2" y="7" width="16" height="10" rx="2" /><path d="M22 11v2" /><path d="M6 11v2" /></>),
  printer: (<><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" rx="1" /></>),
  calendar: (<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>),
  filter: <path d="M22 3H2l8 9.46V19l4 2v-9.54L22 3z" />,
  eye: (<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>),
  map: (<><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>),
  database: (<><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14a9 3 0 0 0 18 0V5" /><path d="M3 12a9 3 0 0 0 18 0" /></>),
  stethoscope: (<><path d="M4 3v6a5 5 0 0 0 10 0V3" /><path d="M4 3H2M14 3h-2" /><path d="M9 18a4 4 0 0 0 8 0v-2" /><circle cx="20" cy="14" r="2" /></>),
  bed: (<><path d="M2 4v16" /><path d="M2 11h18a2 2 0 0 1 2 2v7" /><path d="M22 17H2" /><path d="M6 8h5a2 2 0 0 1 2 2v1H6z" /></>),
  bone: (<><path d="M17 10c.7-.7 1.69-.59 2.5-.59a2.5 2.5 0 1 0-2.91-2.91c0 .81.11 1.8-.59 2.5L7 17.5c-.7.7-1.69.59-2.5.59a2.5 2.5 0 1 0 2.91 2.91c0-.81-.11-1.8.59-2.5z" /></>),
  microscope: (<><path d="M6 18h8M3 22h18" /><path d="M14 22a7 7 0 1 0 0-14h-1" /><path d="M9 14h2" /><path d="M9 12a2 2 0 0 1 2-2V6a2 2 0 0 0-2-2" /><path d="M12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3" /></>),
  fileText: (<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M16 13H8M16 17H8M10 9H8" /></>),
  shield: (<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></>),
  refresh: (<><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /></>),
  wifi: (<><path d="M5 13a10 10 0 0 1 14 0" /><path d="M8.5 16.5a5 5 0 0 1 7 0" /><path d="M2 8.8a15 15 0 0 1 20 0" /><path d="M12 20h.01" /></>),
  pin: (<><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="2.5" /></>),
  building: (<><path d="M3 21h18" /><path d="M5 21V5l7-3 7 3v16" /><path d="M9 9h2M13 9h2M9 13h2M13 13h2M11 21v-4h2v4" /></>),
};

export function Icon({ name, size = 20, className }: { name: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {ICONS[name] ?? null}
    </svg>
  );
}

/* ----------------------------- Medallion (signature element) ----------------------------- */
export function Medallion({ icon, tone, size = "md" }: { icon: string; tone?: "green" | "amber" | "red" | "blue" | "olive" | "tan"; size?: "sm" | "md" | "lg" }) {
  return (
    <div className={`medallion ${size === "md" ? "" : size} ${tone ? `tone-${tone}` : ""}`}>
      <Icon name={icon} size={size === "lg" ? 26 : size === "sm" ? 17 : 22} />
    </div>
  );
}

/* ----------------------------- Reveal stagger ----------------------------- */
export function rd(i: number): CSSProperties {
  return { ["--d" as string]: `${i * 60}ms` } as CSSProperties;
}

/* ----------------------------- Device sparkline ----------------------------- */
export function Sparkline({ data, color = "#1a472a" }: { data: { i: number; v: number }[]; color?: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={color} fillOpacity={0.12} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ----------------------------- Empty state ----------------------------- */
export function Empty({ icon, title, sub, action }: { icon: string; title: string; sub: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <Medallion icon={icon} tone="olive" size="lg" />
      <h4>{title}</h4>
      <p>{sub}</p>
      {action ? <div style={{ marginTop: 12 }}>{action}</div> : null}
    </div>
  );
}

/* ----------------------------- Form fields ----------------------------- */
export function Input({ label, value, onChange, type = "text", placeholder, required = false }: {
  label?: string; value: string | number; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean;
}) {
  return (
    <label className="form-group" style={{ marginBottom: 0 }}>
      {label ? <span className="field-label" style={{ margin: 0 }}>{label}</span> : null}
      <input className="input" type={type} value={value} placeholder={placeholder} required={required} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function Textarea({ label, value, onChange }: { label?: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="form-group" style={{ marginBottom: 0 }}>
      {label ? <span className="field-label" style={{ margin: 0 }}>{label}</span> : null}
      <textarea className="textarea" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function StatusBadge({ status }: { status: "Online" | "Offline" | "Maintenance" }) {
  const k = status === "Online" ? "online" : status === "Offline" ? "offline" : "maintenance";
  return (
    <span className="statusline">
      <span className={`status-indicator ${k}`} /> {status}
    </span>
  );
}

/* ----------------------------- Drawer ----------------------------- */
export function Drawer({ isOpen, onClose, title, children, actions }: {
  isOpen: boolean; onClose: () => void; title: string; children: ReactNode; actions?: ReactNode;
}) {
  if (!isOpen) return null;
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        </div>
        <div className="drawer-body">{children}</div>
        {actions ? <div className="drawer-footer">{actions}</div> : null}
      </div>
    </>
  );
}

/* ----------------------------- Toast ----------------------------- */
export function showToast(type: "success" | "error" | "info", message: string) {
  const tone = type === "success" ? "var(--success)" : type === "error" ? "var(--danger)" : "var(--info)";
  const icon = type === "success" ? "check" : type === "error" ? "alert" : "bell";
  toast.custom((t) => (
    <div
      onClick={() => toast.dismiss(t.id)}
      style={{
        display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
        background: "var(--bg-primary)", border: "1px solid var(--border)",
        borderLeft: `3px solid ${tone}`, borderRadius: 12, padding: "12px 16px",
        boxShadow: "var(--shadow-md)", fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)",
      }}
    >
      <span style={{ color: tone, display: "grid", placeItems: "center" }}><Icon name={icon} size={18} /></span>
      {message}
    </div>
  ));
}
