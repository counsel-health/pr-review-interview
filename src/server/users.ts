import { query } from "./db";
import { ApiUser } from "@/types/dto";
import { getPatientById } from "./patients";
import { getPhysicianById } from "./physicians";

/**
 * Returns every patient and physician unioned as ApiUser[]. The UI consumes
 * a single flat list keyed by id; the role split lives in the DB.
 */
export async function listAllUsers(): Promise<ApiUser[]> {
  const { rows } = await query<{
    id: string;
    name: string;
    is_physician: boolean;
  }>(`
    SELECT id, name, FALSE AS is_physician FROM patients
    UNION ALL
    SELECT id, name, TRUE  AS is_physician FROM physicians
  `);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    is_physician: !!r.is_physician,
  }));
}

/**
 * Resolve a user id to its role by checking the patients then physicians
 * tables. Throws if the id belongs to neither.
 */
export async function resolveRole(
  userId: string
): Promise<"patient" | "physician"> {
  if (await getPatientById(userId)) return "patient";
  if (await getPhysicianById(userId)) return "physician";
  throw new Error(`unknown user id: ${userId}`);
}
