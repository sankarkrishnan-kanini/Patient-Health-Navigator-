import { readFile } from "node:fs/promises";
import { join } from "node:path";
import mysql from "mysql2/promise";

type MigrationFile = {
  name: string;
  path: string;
};

async function loadEnvFromFileIfNeeded(): Promise<void> {
  if (process.env.MYSQL_URL) {
    return;
  }

  const envPath = join(process.cwd(), ".env");
  try {
    const envContent = await readFile(envPath, "utf8");
    const lines = envContent.split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex <= 0) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // Ignore missing .env and rely on process environment variables.
  }
}

async function ensureMigrationsTable(connection: mysql.Connection): Promise<void> {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      migration_name VARCHAR(191) NOT NULL PRIMARY KEY,
      applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

async function loadMigrations(): Promise<MigrationFile[]> {
  const migrationDir = join(process.cwd(), "database", "migrations");
  return [
    {
      name: "001_create_chat_tables.sql",
      path: join(migrationDir, "001_create_chat_tables.sql")
    }
  ];
}

async function hasMigration(connection: mysql.Connection, name: string): Promise<boolean> {
  const [rows] = await connection.execute<mysql.RowDataPacket[]>(
    "SELECT migration_name FROM schema_migrations WHERE migration_name = ? LIMIT 1",
    [name]
  );

  return rows.length > 0;
}

async function applyMigration(
  connection: mysql.Connection,
  migration: MigrationFile
): Promise<"applied" | "skipped"> {
  if (await hasMigration(connection, migration.name)) {
    return "skipped";
  }

  const sql = await readFile(migration.path, "utf8");
  await connection.beginTransaction();

  try {
    await connection.query(sql);
    await connection.execute(
      "INSERT INTO schema_migrations (migration_name) VALUES (?)",
      [migration.name]
    );
    await connection.commit();
    return "applied";
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

async function listTables(connection: mysql.Connection): Promise<string[]> {
  const [rows] = await connection.query<mysql.RowDataPacket[]>(
    "SHOW TABLES"
  );

  return rows.map((row) => String(Object.values(row)[0])).sort();
}

function resolveDatabaseName(mysqlUrl: string): string {
  const parsed = new URL(mysqlUrl);
  const databaseName = parsed.pathname.replace(/^\//, "").trim();
  if (!databaseName) {
    throw new Error("MYSQL_URL must include a database name in the path segment.");
  }

  return databaseName;
}

async function createDatabaseIfMissing(mysqlUrl: string, databaseName: string): Promise<void> {
  const adminUrl = new URL(mysqlUrl);
  adminUrl.pathname = "/";

  const adminConnection = await mysql.createConnection({
    uri: adminUrl.toString(),
    multipleStatements: true
  });
  try {
    await adminConnection.query(
      `CREATE DATABASE IF NOT EXISTS \`${databaseName.replace(/`/g, "``")}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    console.log(`Created database if missing: ${databaseName}`);
  } finally {
    await adminConnection.end();
  }
}

async function connectWithAutoCreate(mysqlUrl: string): Promise<mysql.Connection> {
  try {
    return await mysql.createConnection({ uri: mysqlUrl, multipleStatements: true });
  } catch (error) {
    const mysqlError = error as { code?: string };
    if (mysqlError.code !== "ER_BAD_DB_ERROR") {
      throw error;
    }

    const databaseName = resolveDatabaseName(mysqlUrl);
    await createDatabaseIfMissing(mysqlUrl, databaseName);
    return mysql.createConnection({ uri: mysqlUrl, multipleStatements: true });
  }
}

async function main(): Promise<void> {
  await loadEnvFromFileIfNeeded();

  const mysqlUrl = process.env.MYSQL_URL;
  if (!mysqlUrl) {
    throw new Error("MYSQL_URL is not set. Please configure MYSQL_URL and retry.");
  }

  const connection = await connectWithAutoCreate(mysqlUrl);

  try {
    const [databaseRows] = await connection.query<mysql.RowDataPacket[]>("SELECT DATABASE() AS db");
    const databaseName = String(databaseRows[0]?.db ?? "unknown");
    console.log(`Connected to MySQL database: ${databaseName}`);

    await ensureMigrationsTable(connection);

    const migrations = await loadMigrations();
    for (const migration of migrations) {
      const result = await applyMigration(connection, migration);
      console.log(`${migration.name}: ${result}`);
    }

    const tables = await listTables(connection);
    const requiredTables = [
      "chat_sessions",
      "chat_turns",
      "conversation_turn_audit",
      "guardrail_events",
      "schema_migrations"
    ];

    const missingTables = requiredTables.filter((table) => !tables.includes(table));
    if (missingTables.length > 0) {
      throw new Error(`Migration incomplete. Missing tables: ${missingTables.join(", ")}`);
    }

    console.log(`Verified required tables: ${requiredTables.join(", ")}`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
