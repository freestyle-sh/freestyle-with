import "dotenv/config";
import { freestyle, VmSpec } from "freestyle-sandboxes";
import { VmPostgres } from "../src/index.ts";

const spec = new VmSpec({
  with: {
    postgres: new VmPostgres({
      password: "mypassword",
      database: "testdb",
    }),
  },
});

const { vm, vmId } = await freestyle.vms.create({ spec });

console.log("PostgreSQL VM created successfully!");

// Create a table
const createResult = await vm.postgres.exec(`
  CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(100)
  )
`);
console.log("Create table:", createResult);

// Insert some data
const insertResult = await vm.postgres.exec(`
  INSERT INTO users (name, email) VALUES 
    ('Alice', 'alice@example.com'),
    ('Bob', 'bob@example.com')
`);
console.log("Insert data:", insertResult);

// Query the data
const queryResult = await vm.postgres.query<{
  id: number;
  name: string;
  email: string;
}>(`
  SELECT * FROM users
`);
console.log("Query results:", queryResult);

await freestyle.vms.delete({ vmId });
