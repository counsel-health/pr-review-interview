/**
 * REST endpoint for users.
 *
 * - GET → list every patient and physician as a flat ApiUser[].
 *
 * Thin wrapper around the repo layer in src/server/.
 */
import { jsonResponse, errorResponse } from "@/server/http";
import { listAllUsers } from "@/server/users";

export async function GET() {
  try {
    const users = await listAllUsers();
    return jsonResponse(users);
  } catch (e) {
    return errorResponse(
      "users_failed",
      e instanceof Error ? e.message : String(e),
      500
    );
  }
}
