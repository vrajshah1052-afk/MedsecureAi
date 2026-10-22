// Seed data + helpers for the local (browser localStorage) backend.
import type { AuditEntry, BackendStore, Device, DeviceStatus, Doctor, Gender, Patient, RiskLevel } from "./types";

export const STORAGE_KEY = "poona_hospital_backend_v2";
export const SESSION_KEY = "poona_hospital_current_doctor";

/* ---------------- The 10 login-enabled POONA doctors ---------------- */
export const loginDoctors: Doctor[] = [
  doc("PH-DR-001", "Dr. Aditiya Rao", "Interventional Cardiology", "Cardiology", "MD, DM Cardiology", "Morning", "C-101"),
  doc("PH-DR-002", "Dr. Karan Mehta", "Neurology", "Neurosciences", "MD, DM Neurology", "Evening", "N-204"),
  doc("PH-DR-003", "Dr. Neha Iyer", "Pediatrics", "Child Care", "MD Pediatrics", "Morning", "P-118"),
  doc("PH-DR-004", "Dr. Sameer Khan", "Emergency Medicine", "Emergency", "MD Emergency Medicine", "Night", "ER-01"),
  doc("PH-DR-005", "Dr. Priya Nair", "Gynecology", "Women Health", "MS Obstetrics & Gynecology", "Morning", "W-310"),
  doc("PH-DR-006", "Dr. Vivek Singh", "Orthopedics", "Orthopedics", "MS Orthopedics", "Evening", "O-224"),
  doc("PH-DR-007", "Dr. Meera Thomas", "Pulmonology", "Respiratory Care", "MD Pulmonary Medicine", "Morning", "R-407"),
  doc("PH-DR-008", "Dr. Arjun Patel", "Internal Medicine", "Medicine", "MD Internal Medicine", "Afternoon", "M-143"),
  doc("PH-DR-009", "Dr. Sara Dsouza", "Dermatology", "Skin Care", "MD Dermatology", "Evening", "D-210"),
  doc("PH-DR-010", "Dr. Rakesh Bansal", "Oncology", "Cancer Care", "MD, DM Oncology", "Morning", "ON-509"),
];

function doc(id: string, name: string, specialization: string, department: string, qualification: string, shift: string, room: string): Doctor {
  const handle = name.replace(/^Dr\.\s*/, "").toLowerCase().replace(/\s+/g, ".");
  const n = id.slice(-3);
  return {
    id, name, specialization, department, qualification, shift, room,
    licenseNo: `PH-MCI-24${n}`,
    phone: `+91 98765 ${"10".concat(n)}`,
    email: `${handle}@poonahospital.example`,
    loginEnabled: true,
  };
}

const firstNames = [
  "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Ayaan", "Krishna", "Ishaan",
  "Shaurya", "Atharv", "Advik", "Pranav", "Dhruv", "Kabir", "Ritvik", "Aryan", "Yuvan", "Darsh",
  "Rohan", "Nikhil", "Manav", "Sahil", "Kunal", "Dev", "Gaurav", "Harsh", "Karan", "Lakshya",
  "Mohit", "Naveen", "Omkar", "Parth", "Rahul", "Siddharth", "Tarun", "Varun", "Yash", "Anirudh",
  "Rishabh", "Vikram", "Sameer", "Imran", "Yusuf", "Irfan", "Faizan", "Zaid", "Aman", "Rehan",
  "Aanya", "Aadhya", "Ananya", "Diya", "Saanvi", "Myra", "Aarohi", "Anika", "Navya", "Riya",
  "Ira", "Kiara", "Prisha", "Avni", "Sara", "Nisha", "Pooja", "Ritika", "Tara", "Leena",
  "Maya", "Kavya", "Meera", "Neha", "Priya", "Aditi", "Isha", "Sneha", "Tanvi", "Shreya",
  "Divya", "Pallavi", "Swara", "Rhea", "Naina", "Mahira", "Zoya", "Fatima", "Ayesha", "Sana",
  "Nida", "Reema", "Tina", "Lata", "Asha", "Geeta", "Sunita", "Rekha", "Mina", "Farah",
];
const lastNames = [
  "Sharma", "Verma", "Gupta", "Patel", "Reddy", "Nair", "Menon", "Iyer", "Rao", "Khan",
  "Sheikh", "Bose", "Das", "Sen", "Roy", "Ghosh", "Banerjee", "Mukherjee", "Chatterjee", "Joshi",
  "Kulkarni", "Deshpande", "Patil", "Gokhale", "Kapoor", "Malhotra", "Chopra", "Bhatia", "Saxena", "Aggarwal",
  "Bansal", "Mittal", "Jain", "Shah", "Mehta", "Desai", "Pillai", "Kurup", "Naidu", "Chowdhury",
  "Pandey", "Mishra", "Tiwari", "Singh", "Gill",
];

/** Deterministic permutation over first×last name space → globally unique full names. */
function fullNameAt(k: number): string {
  const F = firstNames.length;
  const L = lastNames.length;
  const idx = (k * 137) % (F * L); // 137 is coprime with F*L → a clean permutation
  return `${firstNames[idx % F]} ${lastNames[Math.floor(idx / F) % L]}`;
}

/** Tiny deterministic LCG → stable per-patient pseudo-randomness. */
function rng(seed: number) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/* Department-appropriate diagnosis pools, each entry paired with its earned acuity. */
const diagnosisByDept: Record<string, [string, RiskLevel][]> = {
  Cardiology: [
    ["Acute MI", "Critical"], ["Unstable angina", "Critical"], ["NSTEMI", "Critical"],
    ["Heart failure exacerbation", "Critical"], ["Ventricular arrhythmia", "Critical"],
    ["Atrial fibrillation", "Watch"], ["Post-PCI observation", "Watch"], ["Hypertensive urgency", "Watch"],
    ["Post-CABG recovery", "Watch"], ["Valvular heart disease", "Watch"], ["Cardiomyopathy review", "Watch"],
    ["Stable angina follow-up", "Stable"], ["Hypertension follow-up", "Stable"], ["Pacemaker check", "Stable"],
  ],
  Neurosciences: [
    ["Acute ischemic stroke", "Critical"], ["Intracerebral hemorrhage", "Critical"], ["Status epilepticus", "Critical"],
    ["Meningitis", "Critical"], ["Guillain-Barré syndrome", "Critical"],
    ["Seizure disorder review", "Watch"], ["Multiple sclerosis relapse", "Watch"], ["Post-stroke rehab", "Watch"],
    ["TIA observation", "Watch"],
    ["Migraine management", "Stable"], ["Parkinson's follow-up", "Stable"], ["Peripheral neuropathy", "Stable"],
  ],
  "Child Care": [
    ["Febrile seizure", "Critical"], ["Pediatric pneumonia", "Critical"], ["Dengue fever", "Critical"],
    ["Kawasaki disease", "Critical"],
    ["Neonatal jaundice", "Watch"], ["Bronchiolitis", "Watch"], ["Acute gastroenteritis", "Watch"], ["Asthma exacerbation", "Watch"],
    ["Routine immunization", "Stable"], ["Growth monitoring", "Stable"], ["Viral fever", "Stable"], ["Otitis media", "Stable"],
  ],
  Emergency: [
    ["Polytrauma", "Critical"], ["Sepsis", "Critical"], ["Acute abdomen", "Critical"], ["Stroke alert", "Critical"],
    ["Road traffic accident", "Critical"], ["Acute MI alert", "Critical"], ["Anaphylaxis", "Critical"],
    ["Diabetic ketoacidosis", "Critical"], ["Drug overdose", "Critical"], ["Burns — 20% TBSA", "Critical"],
    ["Severe dehydration", "Watch"], ["Head injury observation", "Watch"], ["Fracture — awaiting ortho", "Watch"],
    ["Chest pain triage", "Watch"],
  ],
  "Women Health": [
    ["Pre-eclampsia", "Critical"], ["Ectopic pregnancy", "Critical"],
    ["Post-partum recovery", "Watch"], ["Ovarian cyst review", "Watch"], ["High-risk pregnancy", "Watch"],
    ["Post C-section observation", "Watch"], ["Gestational diabetes", "Watch"],
    ["Antenatal monitoring", "Stable"], ["PCOS follow-up", "Stable"], ["Menorrhagia workup", "Stable"], ["Fibroid management", "Stable"],
  ],
  Orthopedics: [
    ["Femur fracture", "Critical"], ["Compound fracture — tibia", "Critical"], ["Osteomyelitis", "Critical"],
    ["Hip fracture — post-op", "Watch"], ["Total knee replacement", "Watch"], ["Spinal fusion recovery", "Watch"],
    ["Vertebral compression fracture", "Watch"],
    ["ACL reconstruction", "Stable"], ["Osteoarthritis review", "Stable"], ["Shoulder dislocation", "Stable"], ["Post-arthroscopy", "Stable"],
  ],
  "Respiratory Care": [
    ["Acute respiratory failure", "Critical"], ["COPD exacerbation", "Critical"], ["Severe pneumonia", "Critical"],
    ["Pulmonary embolism", "Critical"], ["ARDS", "Critical"],
    ["Asthma — acute", "Watch"], ["Pleural effusion", "Watch"], ["Tuberculosis treatment", "Watch"],
    ["Post-ventilator weaning", "Watch"], ["Interstitial lung disease", "Watch"],
    ["Bronchiectasis review", "Stable"],
  ],
  Medicine: [
    ["Acute kidney injury", "Critical"], ["Sepsis — medical", "Critical"],
    ["Hepatitis workup", "Watch"], ["Anemia evaluation", "Watch"], ["Electrolyte imbalance", "Watch"],
    ["Pyrexia of unknown origin", "Watch"], ["Cellulitis", "Watch"],
    ["Diabetes management", "Stable"], ["Hypertension follow-up", "Stable"], ["Thyroid disorder review", "Stable"],
    ["Gastritis", "Stable"], ["Routine inpatient monitoring", "Stable"],
  ],
  "Skin Care": [
    ["Stevens-Johnson syndrome", "Critical"], ["Pemphigus vulgaris", "Critical"],
    ["Psoriasis flare", "Watch"], ["Severe eczema", "Watch"], ["Cellulitis — skin", "Watch"],
    ["Melanoma evaluation", "Watch"], ["Drug rash observation", "Watch"],
    ["Acne — severe", "Stable"], ["Urticaria workup", "Stable"], ["Fungal infection", "Stable"], ["Vitiligo follow-up", "Stable"],
  ],
  "Cancer Care": [
    ["Lymphoma — on chemo", "Critical"], ["Post-chemo neutropenia", "Critical"], ["Lung carcinoma", "Critical"],
    ["Leukemia induction", "Critical"], ["Febrile neutropenia", "Critical"],
    ["Stage II breast Ca", "Watch"], ["Colorectal Ca — staging", "Watch"], ["Palliative care review", "Watch"],
    ["Ovarian Ca — cycle 3", "Watch"], ["Multiple myeloma", "Watch"],
    ["Post-radiation follow-up", "Stable"], ["Prostate Ca monitoring", "Stable"],
  ],
};
const defaultDiagnoses: [string, RiskLevel][] = diagnosisByDept.Medicine;
const departments: [string, string, string][] = [
  ["Cardiology", "Clinical Cardiology", "MD Cardiology"],
  ["Neurosciences", "Neurophysiology", "MD Neurology"],
  ["Pediatrics", "Neonatal Care", "MD Pediatrics"],
  ["Emergency", "Trauma Care", "MD Emergency Medicine"],
  ["Women Health", "Fetal Medicine", "MS Obstetrics & Gynecology"],
  ["Orthopedics", "Joint Replacement", "MS Orthopedics"],
  ["Respiratory Care", "Critical Pulmonology", "MD Pulmonary Medicine"],
  ["Medicine", "Internal Medicine", "MD Internal Medicine"],
  ["Radiology", "Diagnostic Imaging", "MD Radiology"],
  ["Gastroenterology", "Hepatology", "DM Gastroenterology"],
  ["Nephrology", "Renal Medicine", "DM Nephrology"],
  ["ENT", "Head & Neck", "MS ENT"],
];
const ecgOptions = ["Normal sinus rhythm", "Sinus tachycardia, monitor", "Mild ST observation", "Atrial rhythm under review", "Post treatment baseline stable"];

/** Departments surfaced on the landing page, each paired with an icon name. */
export const departmentDirectory: { name: string; icon: string; beds: number }[] = [
  { name: "Cardiology", icon: "heart", beds: 48 },
  { name: "Neurosciences", icon: "pulse", beds: 36 },
  { name: "Emergency", icon: "activity", beds: 24 },
  { name: "Oncology", icon: "microscope", beds: 40 },
  { name: "Pediatrics", icon: "bed", beds: 30 },
  { name: "Orthopedics", icon: "bone", beds: 28 },
  { name: "Pulmonology", icon: "droplet", beds: 22 },
  { name: "Women Health", icon: "users", beds: 34 },
];

/* ---------------- Small utilities ---------------- */
export function pad(value: number, size = 3) { return String(value).padStart(size, "0"); }

export function today(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export function nowStamp() {
  return new Date().toLocaleString([], { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function normalize(value: string) { return value.trim().replace(/\s+/g, " ").toLowerCase(); }

/** Tone keyword used by medallions / badges keyed to clinical risk. */
export function riskTone(risk: RiskLevel): "green" | "amber" | "red" {
  return risk === "Critical" ? "red" : risk === "Watch" ? "amber" : "green";
}

export function riskClass(risk: RiskLevel) {
  if (risk === "Critical") return "border border-rose-200 bg-rose-50 text-rose-600";
  if (risk === "Watch") return "border border-amber-200 bg-amber-50 text-amber-600";
  return "border border-emerald-200 bg-emerald-50 text-emerald-600";
}

/** Last 6 calendar months of admission counts → for the area chart. */
export function monthlyAdmissions(patients: Patient[]) {
  const out: { label: string; value: number }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i -= 1) {
    const ref = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${ref.getFullYear()}-${pad(ref.getMonth() + 1, 2)}`;
    const value = patients.filter((p) => p.admissionDate.slice(0, 7) === key).length;
    out.push({ label: ref.toLocaleString([], { month: "short" }), value });
  }
  return out;
}

/** Admissions grouped by hospital shift → horizontal bar on the dashboard. */
export function admissionsByShift(patients: Patient[], doctors: Doctor[]) {
  const shiftOf = new Map(doctors.map((d) => [d.id, d.shift]));
  const order = ["Morning", "Afternoon", "Evening", "Night"];
  return order.map((shift) => ({
    label: shift,
    value: patients.filter((p) => shiftOf.get(p.doctorId) === shift).length,
  }));
}

/** Deterministic mini reading trend for a device sparkline. */
export function deviceTrend(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) % 997;
  return Array.from({ length: 12 }, (_, i) => {
    h = (h * 17 + 7) % 997;
    return { i, v: 40 + (h % 55) };
  });
}

export function toCsv<T extends Record<string, unknown>>(rows: T[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return [headers.join(","), ...rows.map((row) => headers.map((key) => escape(row[key])).join(","))].join("\n");
}

export function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/* ---------------- Seed generators ---------------- */
function createDoctorDirectory(): Doctor[] {
  const doctors = [...loginDoctors];
  for (let index = loginDoctors.length + 1; index <= 500; index += 1) {
    const first = firstNames[index % firstNames.length];
    const last = lastNames[(index * 5) % lastNames.length];
    const dept = departments[index % departments.length];
    doctors.push({
      id: `PH-DR-${pad(index)}`,
      name: `Dr. ${first} ${last}`,
      specialization: dept[1],
      department: dept[0],
      qualification: dept[2],
      licenseNo: `PH-MCI-${24000 + index}`,
      phone: `+91 98765 ${String(10000 + index).slice(-5)}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}${index}@poonahospital.example`,
      shift: ["Morning", "Afternoon", "Evening", "Night"][index % 4],
      room: `${dept[0].slice(0, 2).toUpperCase()}-${100 + index}`,
      loginEnabled: false,
    });
  }
  return doctors;
}

/** Vitals biased to the patient's acuity so risk levels look earned, not random. */
function vitalsForRisk(risk: RiskLevel, r: () => number) {
  if (risk === "Critical") {
    const lowBp = r() < 0.4; // sepsis/shock run hypotensive; others hypertensive
    return {
      systolic: lowBp ? 82 + Math.floor(r() * 16) : 152 + Math.floor(r() * 32),
      diastolic: lowBp ? 48 + Math.floor(r() * 12) : 96 + Math.floor(r() * 18),
      spo2: 86 + Math.floor(r() * 6),
      pulse: 108 + Math.floor(r() * 30),
      temp: (100.4 + r() * 3).toFixed(1),
      resp: 24 + Math.floor(r() * 11),
      glucose: r() < 0.5 ? 64 + Math.floor(r() * 26) : 188 + Math.floor(r() * 140),
    };
  }
  if (risk === "Watch") {
    return {
      systolic: 132 + Math.floor(r() * 16),
      diastolic: 84 + Math.floor(r() * 11),
      spo2: 93 + Math.floor(r() * 3),
      pulse: 90 + Math.floor(r() * 16),
      temp: (99.1 + r() * 1.6).toFixed(1),
      resp: 18 + Math.floor(r() * 7),
      glucose: 122 + Math.floor(r() * 64),
    };
  }
  return {
    systolic: 110 + Math.floor(r() * 18),
    diastolic: 70 + Math.floor(r() * 12),
    spo2: 97 + Math.floor(r() * 3),
    pulse: 62 + Math.floor(r() * 20),
    temp: (97.6 + r() * 1.4).toFixed(1),
    resp: 14 + Math.floor(r() * 5),
    glucose: 86 + Math.floor(r() * 34),
  };
}

function createPatients(): Patient[] {
  const bloodGroups = ["A+", "B+", "O+", "AB+", "A-", "O-", "B-", "AB-"];
  const allergyPool = ["None recorded", "Penicillin", "Sulfa drugs", "Dust allergy", "None recorded", "Iodine contrast", "Aspirin"];
  const out: Patient[] = [];
  let nameCursor = 0;

  loginDoctors.forEach((doctor, doctorIndex) => {
    const count = 24 + ((doctorIndex * 7 + 5) % 14); // 24–37 distinct patients per doctor
    const pool = diagnosisByDept[doctor.department] ?? defaultDiagnoses;
    const isPediatric = doctor.department === "Child Care";
    const isWomen = doctor.department === "Women Health";

    for (let patientIndex = 0; patientIndex < count; patientIndex += 1) {
      const seq = doctorIndex * 1000 + patientIndex;
      const r = rng((seq + 1) * 2654435761);
      const [diagnosis, risk] = pool[Math.floor(r() * pool.length)];
      const v = vitalsForRisk(risk, r);
      const ward = risk === "Critical" ? "ICU" : risk === "Watch" ? "HDU" : ["A", "B", "Day Care"][patientIndex % 3];
      const gender: Gender = isWomen ? "Female" : r() < 0.5 ? "Female" : r() < 0.96 ? "Male" : "Other";
      const age = isPediatric ? 1 + Math.floor(r() * 15) : 18 + Math.floor(r() * 70);
      const daysAgo = patientIndex < 3 ? 0 : 1 + Math.floor(r() * 150);

      out.push({
        id: `PAT-${pad(doctorIndex + 1)}-${pad(patientIndex + 1)}`,
        doctorId: doctor.id,
        name: fullNameAt(nameCursor++),
        age,
        gender,
        bloodGroup: bloodGroups[Math.floor(r() * bloodGroups.length)],
        contact: `+91 90000 ${String(20000 + seq).slice(-5)}`,
        emergencyContact: `+91 90000 ${String(60000 + seq).slice(-5)}`,
        diagnosis,
        allergies: allergyPool[Math.floor(r() * allergyPool.length)],
        medication: risk === "Critical" ? "IV protocol per attending" : risk === "Watch" ? "Oral regimen, twice daily" : "Maintenance dose as charted",
        bp: `${v.systolic}/${v.diastolic}`,
        ecg: ecgOptions[Math.floor(r() * ecgOptions.length)],
        temp: `${v.temp} F`,
        spo2: `${v.spo2}%`,
        pulse: `${v.pulse} bpm`,
        respiratoryRate: `${v.resp} /min`,
        glucose: `${v.glucose} mg/dL`,
        weight: `${(isPediatric ? 10 : 48) + Math.floor(r() * 40)} kg`,
        height: `${(isPediatric ? 80 : 150) + Math.floor(r() * 42)} cm`,
        admissionDate: today(-daysAgo),
        nextVisit: today(1 + Math.floor(r() * 6)),
        ward,
        bed: pad(patientIndex + 1, 2),
        risk,
        notes: `${diagnosis}. ${risk === "Critical" ? "Continuous monitoring; review every round." : risk === "Watch" ? "Monitor vitals q4h." : "Stable on current plan."}`,
        lastUpdated: nowStamp(),
      });
    }
  });

  return out;
}

/** Physical bay each department's bedside fleet lives in. */
const deptLocation: Record<string, string> = {
  Cardiology: "Cardiac ICU", Neurosciences: "Neuro HDU", "Child Care": "Pediatric Ward",
  Emergency: "ER Bay", "Women Health": "Maternity Ward", Orthopedics: "Ortho Ward",
  "Respiratory Care": "Respiratory ICU", Medicine: "Medical Ward", "Skin Care": "Day Clinic",
  "Cancer Care": "Oncology Ward",
};

function createDevices(patients: Patient[]): Device[] {
  const deviceTypes: [string, string][] = [
    ["BP Monitor", "Vital Monitor"],
    ["Cardiac Monitor", "Cardiology"],
    ["Pulse Oximeter", "Vital Monitor"],
    ["Infusion Pump", "Medication"],
    ["Ventilator", "Respiratory"],
    ["ECG Workstation", "Cardiology"],
    ["Temperature Sensor", "Vital Monitor"],
    ["Glucometer", "Lab Support"],
    ["Syringe Pump", "Medication"],
  ];
  const devices: Device[] = [];
  let index = 0;

  loginDoctors.forEach((doctor, doctorIndex) => {
    const docPatients = patients.filter((p) => p.doctorId === doctor.id);
    const perDoc = 6 + (doctorIndex % 4); // 6–9 devices per doctor → ~75 across the fleet
    const location = deptLocation[doctor.department] ?? "General Ward";
    for (let i = 0; i < perDoc; i += 1) {
      const type = deviceTypes[(doctorIndex + i) % deviceTypes.length];
      const patient = docPatients.length ? docPatients[i % docPatients.length] : null;
      const status: DeviceStatus = index % 13 === 0 ? "Offline" : index % 8 === 0 ? "Maintenance" : "Online";
      devices.push({
        id: `DEV-${pad(index + 1)}`,
        name: `${type[0]} ${pad(index + 1)}`,
        category: type[1],
        location,
        assignedDoctorId: doctor.id,
        assignedPatientId: patient?.id ?? "",
        status,
        reading:
          status === "Offline" ? "No signal"
            : type[0] === "BP Monitor" && patient ? patient.bp
            : type[0] === "ECG Workstation" && patient ? patient.ecg
            : type[0] === "Pulse Oximeter" && patient ? patient.spo2
            : "Within expected range",
        battery: `${42 + ((index * 9) % 57)}%`,
        lastService: today(-(index % 45)),
        lastUpdated: nowStamp(),
        notes: status === "Maintenance" ? "Biomedical team inspection pending" : "Manual override allowed by logged-in doctor",
      });
      index += 1;
    }
  });

  return devices;
}

export function createSeedBackend(): BackendStore {
  const patients = createPatients();
  const seed: AuditEntry = {
    id: "AUD-001",
    doctorId: "system",
    doctorName: "System",
    action: "Seeded doctor directory, patient records and monitored devices.",
    timestamp: nowStamp(),
  };
  return { version: "POONA-HMS-2026.1", doctors: createDoctorDirectory(), patients, devices: createDevices(patients), auditLog: [seed] };
}

export function loadBackend(): BackendStore {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return createSeedBackend();
    const parsed = JSON.parse(saved) as BackendStore;
    if (!Array.isArray(parsed.doctors) || !Array.isArray(parsed.patients) || !Array.isArray(parsed.devices)) return createSeedBackend();
    return parsed;
  } catch {
    return createSeedBackend();
  }
}

export function emptyPatient(doctorId: string): Patient {
  return {
    id: "", doctorId, name: "", age: 30, gender: "Female", bloodGroup: "O+",
    contact: "+91 ", emergencyContact: "+91 ", diagnosis: "", allergies: "None recorded", medication: "",
    bp: "120/80", ecg: "Normal sinus rhythm", temp: "98.4 F", spo2: "98%", pulse: "76 bpm",
    respiratoryRate: "16 /min", glucose: "100 mg/dL", weight: "65 kg", height: "165 cm",
    admissionDate: today(), nextVisit: today(7), ward: "A", bed: "New", risk: "Stable", notes: "", lastUpdated: nowStamp(),
  };
}
