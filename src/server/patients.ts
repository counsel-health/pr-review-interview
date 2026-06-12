import { query } from "./db";
import { ApiUser } from "@/types/dto";
import { PatientRow } from "./dbTypes";

export const toUser = (r: PatientRow): ApiUser => ({
  id: r.id,
  name: r.name,
  is_physician: false,
});

export async function listPatients(): Promise<ApiUser[]> {
  const { rows } = await query<PatientRow>("SELECT id, name FROM patients");
  return rows.map(toUser);
}

export async function getPatientById(id: string): Promise<ApiUser | null> {
  const { rows } = await query<PatientRow>(
    "SELECT id, name FROM patients WHERE id = $1",
    [id]
  );
  return rows[0] ? toUser(rows[0]) : null;
}
