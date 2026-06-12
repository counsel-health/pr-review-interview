import { query } from "./db";
import { ApiUser } from "@/types/dto";
import { PhysicianRow } from "./dbTypes";

export const toUser = (r: PhysicianRow): ApiUser => ({
  id: r.id,
  name: r.name,
  is_physician: true,
});

export async function listPhysicians(): Promise<ApiUser[]> {
  const { rows } = await query<PhysicianRow>("SELECT id, name FROM physicians");
  return rows.map(toUser);
}

export async function getPhysicianById(id: string): Promise<ApiUser | null> {
  const { rows } = await query<PhysicianRow>(
    "SELECT id, name FROM physicians WHERE id = $1",
    [id]
  );
  return rows[0] ? toUser(rows[0]) : null;
}
