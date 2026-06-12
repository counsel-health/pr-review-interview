import { query, tx } from "./db";
import { ApiThread, ThreadMetadata } from "@/types/dto";
import { resolveRole } from "./users";


interface ThreadJoinRow {
  id: string;
  title: string;
  patient_id: string;
  date_created: number | string;
  physician_ids: string[] | null;
  metadata: ThreadMetadata | string | null;
}

const DEFAULT_METADATA: ThreadMetadata = {
  unrespondedPatientMessagesCount: 0,
  lastSummaryGenerated: null,
  topicTags: [],
  priority: "normal",
};

/**
 * PGlite returns JSONB as a parsed object, but tolerate a string (or null) so
 * the repo never throws on an unexpected shape.
 */
const normalizeMetadata = (
  raw: ThreadMetadata | string | null
): ThreadMetadata => {
  if (!raw) return { ...DEFAULT_METADATA };
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  return { ...DEFAULT_METADATA, ...parsed };
};

const toApi = (r: ThreadJoinRow): ApiThread => ({
  id: r.id,
  title: r.title,
  users: [r.patient_id, ...(r.physician_ids ?? [])],
  date_created: Number(r.date_created),
  metadata: normalizeMetadata(r.metadata),
});

const SELECT_WITH_PHYSICIANS = `
  SELECT t.id,
         t.title,
         t.patient_id,
         t.date_created,
         t.metadata,
         COALESCE(
           array_agg(tp.physician_id) FILTER (WHERE tp.physician_id IS NOT NULL),
           ARRAY[]::text[]
         ) AS physician_ids
  FROM threads t
  LEFT JOIN threads_physicians tp ON tp.thread_id = t.id
`;

const THREAD_LIMIT = 100;

export async function listThreads(searchQuery?: string): Promise<ApiThread[]> {
  const trimmed = searchQuery?.trim();

  if (!trimmed) {
    const { rows } = await query<ThreadJoinRow>(
      `${SELECT_WITH_PHYSICIANS}
       GROUP BY t.id
       ORDER BY t.date_created DESC
       LIMIT ${THREAD_LIMIT}`
    );
    return rows.map(toApi);
  }

  // Escape LIKE wildcards so typed `%`/`_` match literally.
  const escaped = trimmed.replace(/[\\%_]/g, (c) => `\\${c}`);
  const pattern = `%${escaped}%`;

  const { rows } = await query<ThreadJoinRow>(
    `${SELECT_WITH_PHYSICIANS}
     WHERE t.title ILIKE $1 ESCAPE '\\'
        OR EXISTS (
          SELECT 1 FROM messages m
          WHERE m.thread_id = t.id AND m.message ILIKE $1 ESCAPE '\\'
        )
     GROUP BY t.id
     ORDER BY t.date_created DESC
     LIMIT ${THREAD_LIMIT}`,
    [pattern]
  );
  return rows.map(toApi);
}

export async function getThreadById(id: string): Promise<ApiThread | null> {
  const { rows } = await query<ThreadJoinRow>(
    `${SELECT_WITH_PHYSICIANS}
     WHERE t.id = $1
     GROUP BY t.id`,
    [id]
  );
  return rows[0] ? toApi(rows[0]) : null;
}

/**
 * Create a thread from a flat list of participant ids. Splits the ids into
 * exactly one patient and zero-or-more physicians (by resolving each id's
 * role) before persisting. This is the orchestration the UI calls into via
 * the REST layer; the low-level insert lives in `insertThread`.
 */
export async function createThread(
  title: string,
  userIds: string[]
): Promise<ApiThread> {
  let patientId: string | null = null;
  const physicianIds: string[] = [];

  for (const id of userIds) {
    const role = await resolveRole(id);
    if (role === "patient") {
      if (patientId && patientId !== id) {
        throw new Error("createThread: a thread can only have one patient");
      }
      patientId = id;
    } else {
      physicianIds.push(id);
    }
  }

  if (!patientId) {
    throw new Error("createThread: a thread must include exactly one patient");
  }

  return insertThread(title, patientId, physicianIds);
}

async function insertThread(
  title: string,
  patientId: string,
  physicianIds: string[]
): Promise<ApiThread> {
  const id = crypto.randomUUID();
  const dateCreated = Date.now();

  await tx(async (q) => {
    await q(
      `INSERT INTO threads (id, title, patient_id, date_created)
       VALUES ($1, $2, $3, $4)`,
      [id, title, patientId, dateCreated]
    );
    for (const physicianId of physicianIds) {
      await q(
        `INSERT INTO threads_physicians (thread_id, physician_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [id, physicianId]
      );
    }
  });

  const thread = await getThreadById(id);
  if (!thread) throw new Error(`insertThread: insert vanished (${id})`);
  return thread;
}

export async function getThreadMetadata(
  threadId: string
): Promise<ThreadMetadata> {
  const { rows } = await query<{ metadata: ThreadMetadata | string | null }>(
    `SELECT metadata FROM threads WHERE id = $1`,
    [threadId]
  );
  if (!rows[0]) throw new Error(`getThreadMetadata: unknown thread ${threadId}`);
  return normalizeMetadata(rows[0].metadata);
}

export async function setThreadMetadata(
  threadId: string,
  metadata: ThreadMetadata
): Promise<void> {
  await query(`UPDATE threads SET metadata = $1::jsonb WHERE id = $2`, [
    JSON.stringify(metadata),
    threadId,
  ]);
}
