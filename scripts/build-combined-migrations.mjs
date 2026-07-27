import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const migrationsDirectory = join(root, "supabase", "migrations");
const outputPath = join(root, "supabase", "deploy", "combined_migrations.sql");
const files = readdirSync(migrationsDirectory)
  .filter((name) => name.endsWith(".sql"))
  .sort();
const header = `-- Combined MOTOR.OS migrations for one-shot setup via the Supabase SQL Editor.
-- Generated from supabase/migrations/. If new migration files are added later,
-- apply those individually instead of re-running this.
`;
const sections = files.map((name) => {
  const body = readFileSync(join(migrationsDirectory, name), "utf8")
    .replaceAll("\r\n", "\n")
    .trim();
  return `-- ===== ${name} =====\n\n${body}`;
});

writeFileSync(outputPath, `${header}\n${sections.join("\n\n")}\n`);
console.log(`Combined ${files.length} migrations into ${outputPath}`);
