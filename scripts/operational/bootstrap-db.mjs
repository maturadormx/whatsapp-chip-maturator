import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..");
const migrationsFolder = path.join(projectRoot, "drizzle");

let bootstrapPromise = null;

async function ensureMigrationsFolder() {
  await access(migrationsFolder);
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
