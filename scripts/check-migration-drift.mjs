import { Client } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const client = new Client({ connectionString });

const expected = {
  "20260617000001": {
    columns: [["bookmarks", "read_at"]],
    relations: ["idx_bookmarks_read_at", "idx_bookmarks_user_unread"],
    constraints: [],
    triggers: [],
  },
  "20260621000001": {
    columns: [
      ...[
        "id",
        "bookmark_id",
        "user_id",
        "status",
        "started_at",
        "ended_at",
        "duration_ms",
        "input_tokens",
        "output_tokens",
        "total_tokens",
        "reasoning_tokens",
        "cached_input_tokens",
        "cost_usd",
        "error",
        "created_at",
        "updated_at",
      ].map((column) => ["bookmark_processing_runs", column]),
      ...[
        "id",
        "run_id",
        "parent_event_id",
        "kind",
        "phase",
        "name",
        "status",
        "sequence",
        "started_at",
        "ended_at",
        "duration_ms",
        "model_id",
        "input_tokens",
        "output_tokens",
        "total_tokens",
        "reasoning_tokens",
        "cached_input_tokens",
        "cost_usd",
        "provider_metadata",
        "metadata",
        "error",
        "created_at",
        "updated_at",
      ].map((column) => ["bookmark_processing_events", column]),
    ],
    relations: [
      "bookmark_processing_runs",
      "bookmark_processing_events",
      "idx_bookmark_processing_runs_bookmark_user",
      "idx_bookmark_processing_events_run_sequence",
      "idx_bookmark_processing_events_parent",
    ],
    constraints: [
      "bookmark_processing_runs_pkey",
      "bookmark_processing_runs_bookmark_id_fkey",
      "bookmark_processing_runs_status_check",
      "bookmark_processing_events_pkey",
      "bookmark_processing_events_run_id_fkey",
      "bookmark_processing_events_parent_event_id_fkey",
      "bookmark_processing_events_kind_check",
      "bookmark_processing_events_status_check",
      "bookmark_processing_events_run_id_sequence_key",
    ],
    triggers: [
      "update_bookmark_processing_runs_updated_at",
      "update_bookmark_processing_events_updated_at",
    ],
  },
};

async function exists(sql, values) {
  return (await client.query(sql, values)).rows[0].present;
}

await client.connect();
try {
  for (const [version, objects] of Object.entries(expected)) {
    const history = await exists(
      `select exists (
         select 1
         from supabase_migrations.schema_migrations
         where version = $1
       ) as present`,
      [version],
    );

    const missing = [];
    for (const [table, column] of objects.columns) {
      const present = await exists(
        `select exists (
           select 1 from information_schema.columns
           where table_schema = 'public' and table_name = $1 and column_name = $2
         ) as present`,
        [table, column],
      );
      if (!present) missing.push(`column public.${table}.${column}`);
    }

    for (const relation of objects.relations) {
      const present = await exists(
        "select to_regclass($1) is not null as present",
        [`public.${relation}`],
      );
      if (!present) missing.push(`relation public.${relation}`);
    }

    for (const constraint of objects.constraints) {
      const present = await exists(
        `select exists (
           select 1 from pg_constraint where conname = $1
         ) as present`,
        [constraint],
      );
      if (!present) missing.push(`constraint ${constraint}`);
    }

    for (const trigger of objects.triggers) {
      const present = await exists(
        `select exists (
           select 1 from pg_trigger where tgname = $1 and not tgisinternal
         ) as present`,
        [trigger],
      );
      if (!present) missing.push(`trigger ${trigger}`);
    }

    console.log(`\nMigration ${version}`);
    console.log(`  history row: ${history ? "present" : "MISSING"}`);
    console.log(`  schema:      ${missing.length === 0 ? "complete" : "INCOMPLETE"}`);
    for (const item of missing) console.log(`    - missing ${item}`);
  }
} finally {
  await client.end();
}
