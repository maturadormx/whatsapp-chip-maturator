import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..");
const migrationsFolder = path.join(projectRoot, "drizzle");
const migrationsTable = "__drizzle_migrations";
const schemaCheckTables = ["users", "activity_logs", "maturation_profiles", "scheduled_tasks", "whatsapp_chips"];

let bootstrapPromise = null;

async function ensureMigrationsFolder() {
  await access(migrationsFolder);
}

async function readJournal() {
  const journalPath = path.join(migrationsFolder, "meta", "_journal.json");
  const raw = await readFile(journalPath, "utf8");
  return JSON.parse(raw);
}

async function readLatestMigrationMeta() {
  const journal = await readJournal();
  const latestEntry = [...journal.entries].sort((a, b) => a.when - b.when).at(-1);

  if (!latestEntry) {
    throw new Error("Nenhuma migration encontrada em drizzle/meta/_journal.json.");
  }

  const migrationFile = path.join(migrationsFolder, `${latestEntry.tag}.sql`);
  const sqlText = await readFile(migrationFile, "utf8");

  return {
    ...latestEntry,
    hash: crypto.createHash("sha256").update(sqlText).digest("hex"),
  };
}

async function listExistingTables(pool) {
  const [rows] = await pool.query(`
    SELECT TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
  `);
  return new Set(rows.map((row) => row.TABLE_NAME));
}

async function hasTrackedMigrations(pool) {
  const [rows] = await pool.query(`
    SELECT COUNT(*) AS total
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
  `, [migrationsTable]);

  if (!rows[0]?.total) {
    return false;
  }

  const [migrationRows] = await pool.query(`SELECT COUNT(*) AS total FROM \`${migrationsTable}\``);
  return Number(migrationRows[0]?.total ?? 0) > 0;
}

async function stampBaselineAsApplied(pool) {
  const latestMigration = await readLatestMigrationMeta();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`${migrationsTable}\` (
      id serial primary key,
      hash text not null,
      created_at bigint
    )
  `);

  const [rows] = await pool.query(`
    SELECT created_at
    FROM \`${migrationsTable}\`
    ORDER BY created_at DESC
    LIMIT 1
  `);

  if (rows.length > 0 && Number(rows[0].created_at) >= Number(latestMigration.when)) {
    return false;
  }

  await pool.query(
    `INSERT INTO \`${migrationsTable}\` (\`hash\`, \`created_at\`) VALUES (?, ?)`,
    [latestMigration.hash, latestMigration.when],
  );
  return true;
}

export async function runDatabaseBootstrap() {
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    const databaseUrl = process.env.DATABASE_URL?.trim();

    if (!databaseUrl) {
      console.log("[DB Bootstrap] DATABASE_URL ausente. Bootstrap do banco ignorado.");
      return false;
    }

    await ensureMigrationsFolder();

    console.log("[DB Bootstrap] Aplicando migrations pendentes...");

    const pool = mysql.createPool(databaseUrl);

    try {
      const existingTables = await listExistingTables(pool);
      const trackedMigrations = await hasTrackedMigrations(pool);
      const hasLegacySchema = schemaCheckTables.some((tableName) => existingTables.has(tableName));

      if (!trackedMigrations && hasLegacySchema && existingTables.has("users")) {
        const stamped = await stampBaselineAsApplied(pool);
        if (stamped) {
          console.log("[DB Bootstrap] Banco existente detectado. Baseline marcada como aplicada.");
        }
      }

      const db = drizzle(pool);
      await migrate(db, { migrationsFolder });
      console.log("[DB Bootstrap] Banco pronto.");
      return true;
    } finally {
      await pool.end();
    }
  })().catch((error) => {
    bootstrapPromise = null;
    throw error;
  });

  return bootstrapPromise;
}

if (process.argv[1] === __filename) {
  runDatabaseBootstrap().catch((error) => {
    console.error("[DB Bootstrap] Falha ao preparar o banco:", error);
    process.exit(1);
  });
}
