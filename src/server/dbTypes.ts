/**
 * Database row types — what the repo layer reads/writes against Postgres.
 * Kept distinct from the DTO types in src/types/dto.ts.
 */

export interface PatientRow {
  id: string;
  name: string;
  created_at: string;
}

export interface PhysicianRow {
  id: string;
  name: string;
  created_at: string;
}

export interface ThreadRow {
  id: string;
  title: string;
  patient_id: string;
  date_created: number | string;
}

export interface MessageRow {
  id: number | string;
  thread_id: string;
  author_patient_id: string | null;
  author_physician_id: string | null;
  message: string;
  timestamp: number | string;
  msg_index: number;
}
