// Shared domain types for the POONA Hospital portal.

export type RiskLevel = "Stable" | "Watch" | "Critical";
export type DeviceStatus = "Online" | "Offline" | "Maintenance";
export type Gender = "Female" | "Male" | "Other";

export type Doctor = {
  id: string;
  name: string;
  specialization: string;
  department: string;
  qualification: string;
  shift: string;
  room: string;
  licenseNo: string;
  phone: string;
  email: string;
  loginEnabled: boolean;
};

export type Patient = {
  id: string;
  doctorId: string;
  name: string;
  age: number;
  gender: Gender;
  bloodGroup: string;
  contact: string;
  emergencyContact: string;
  diagnosis: string;
  allergies: string;
  medication: string;
  bp: string;
  ecg: string;
  temp: string;
  spo2: string;
  pulse: string;
  respiratoryRate: string;
  glucose: string;
  weight: string;
  height: string;
  admissionDate: string;
  nextVisit: string;
  ward: string;
  bed: string;
  risk: RiskLevel;
  notes: string;
  lastUpdated: string;
};

export type Device = {
  id: string;
  name: string;
  category: string;
  location: string;
  assignedDoctorId: string;
  assignedPatientId: string;
  status: DeviceStatus;
  reading: string;
  battery: string;
  lastService: string;
  lastUpdated: string;
  notes: string;
};

export type AuditEntry = {
  id: string;
  doctorId: string;
  doctorName: string;
  action: string;
  timestamp: string;
};

export type BackendStore = {
  version: string;
  doctors: Doctor[];
  patients: Patient[];
  devices: Device[];
  auditLog: AuditEntry[];
};
