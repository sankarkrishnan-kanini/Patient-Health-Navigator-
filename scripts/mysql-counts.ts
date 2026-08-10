import { config } from "dotenv";
import mysql from "mysql2/promise";

config();

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

async function main(): Promise<void> {
  const mysqlUrlRaw = process.env.MYSQL_URL;
  if (!mysqlUrlRaw) {
    throw new Error("MYSQL_URL is missing");
  }

  const mysqlUrl = normalizeUrl(mysqlUrlRaw);
  const pool = mysql.createPool({ uri: mysqlUrl });

  const [sessionsRows] = await pool.query("SELECT COUNT(*) AS count FROM chat_sessions");
  const [turnsRows] = await pool.query("SELECT COUNT(*) AS count FROM chat_turns");
  const [auditRows] = await pool.query("SELECT COUNT(*) AS count FROM conversation_turn_audit");
  const [guardrailRows] = await pool.query("SELECT COUNT(*) AS count FROM guardrail_events");

  const result = {
    sessions: (sessionsRows as Array<{ count: number }>)[0]?.count ?? 0,
    turns: (turnsRows as Array<{ count: number }>)[0]?.count ?? 0,
    conversationTurnAudit: (auditRows as Array<{ count: number }>)[0]?.count ?? 0,
    guardrailEvents: (guardrailRows as Array<{ count: number }>)[0]?.count ?? 0
  };

  console.log(JSON.stringify(result));
  await pool.end();
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`mysql-counts failed: ${message}`);
  process.exitCode = 1;
});
