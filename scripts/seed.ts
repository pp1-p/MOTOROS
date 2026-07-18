import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const seedFile = resolve(projectRoot, "supabase", "seed.sql");

if (!existsSync(seedFile)) {
  throw new Error(`Seed file not found: ${seedFile}`);
}

if (process.env.NODE_ENV === "production" || process.env.VERCEL === "1") {
  throw new Error("DealerOS seed data is development-only and cannot run in production.");
}

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    if ((result.error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        `${command} is not installed or is not on PATH. See docs/DATABASE.md.`,
      );
    }
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status ?? "unknown"}.`);
  }
}

const databaseUrl = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL;

if (databaseUrl) {
  const parsed = new URL(databaseUrl);
  const localHosts = new Set(["localhost", "127.0.0.1", "::1", "db"]);
  const isLocal = localHosts.has(parsed.hostname);

  if (!isLocal && process.env.ALLOW_REMOTE_SEED !== "true") {
    throw new Error(
      "Refusing to seed a remote database. Set ALLOW_REMOTE_SEED=true only for an intentional non-production test project.",
    );
  }

  run(process.platform === "win32" ? "psql.exe" : "psql", [
    databaseUrl,
    "--set",
    "ON_ERROR_STOP=1",
    "--file",
    seedFile,
  ]);
} else {
  console.log(
    "No database URL supplied; resetting the local Supabase database and applying migrations plus seed.sql.",
  );
  run(process.platform === "win32" ? "supabase.exe" : "supabase", [
    "db",
    "reset",
    "--local",
  ]);
}

console.log("DealerOS development data is ready.");
