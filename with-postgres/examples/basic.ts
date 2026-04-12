import "dotenv/config";
import { freestyle, VmSpec } from "freestyle";
import { VmPostgres } from "../src/index.ts";

const pg = new VmPostgres({ password: "mypassword" });

const db = pg.database({ name: "myapp", create: true });

const schema = db.script("schema", {
  sql: `
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100),
      email VARCHAR(100)
    );
  `,
});

const seed = db.script("seed", {
  sql: `
    INSERT INTO users (name, email) VALUES
      ('Alice', 'alice@example.com'),
      ('Bob', 'bob@example.com');
  `,
  after: [schema],
});

const spec = new VmSpec()
  .with("postgres", pg)
  .with("db", db)
  .with("schema", schema)
  .with("seed", seed)
  .snapshot();

const { vm, vmId } = await freestyle.vms.create({ spec });

console.log("PostgreSQL VM created with schema + seed applied!");

const result = await vm.db.query<{
  id: number;
  name: string;
  email: string;
}>(`SELECT * FROM users ORDER BY id`);

console.log("Users:", result.rows);

console.log("\nSeed service logs:");
console.log((await vm.seed.logs())?.join("\n"));

await freestyle.vms.delete({ vmId });
