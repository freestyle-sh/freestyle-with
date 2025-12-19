# @freestyle-sh/with-postgres

PostgreSQL runtime extension for Freestyle VMs. Provides a fully configured PostgreSQL database server in your Freestyle VM.

## Installation

```bash
npm install @freestyle-sh/with-postgres freestyle-sandboxes
```

## Usage

```typescript
import { freestyle } from "freestyle-sandboxes";
import { VmPostgres } from "@freestyle-sh/with-postgres";

const { vm } = await freestyle.vms.create({
  with: {
    postgres: new VmPostgres({
      password: "mypassword",
      database: "mydb",
      version: "16", // Optional, defaults to "16"
      user: "postgres", // Optional, defaults to "postgres"
    }),
  },
});

// Create a table
await vm.postgres.exec(`
  CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(100)
  )
`);

// Insert data
await vm.postgres.exec(`
  INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com')
`);

// Query data
const result = await vm.postgres.query<{ id: number; name: string; email: string }>(`
  SELECT * FROM users
`);

console.log(result.rows); // [{ id: 1, name: 'Alice', email: 'alice@example.com' }]
```

## API

### Constructor Options

- `version?: string` - PostgreSQL version to install (default: "16")
- `password?: string` - Password for the postgres user (default: "postgres")
- `database?: string` - Default database to create (default: "postgres")
- `user?: string` - PostgreSQL user (default: "postgres")

### Methods

#### `query<T>(sql: string): Promise<QueryResult<T>>`

Execute a SQL query and return results as JSON.

**Returns:** `{ rows: T[], rowCount: number, error?: string }`

```typescript
const result = await vm.postgres.query<{ id: number; name: string }>(`
  SELECT id, name FROM users WHERE id = 1
`);
```

#### `exec(sql: string): Promise<{ success: boolean, error?: string }>`

Execute a SQL command without returning results (for CREATE, INSERT, UPDATE, DELETE, etc.).

```typescript
const result = await vm.postgres.exec(`
  UPDATE users SET name = 'Bob' WHERE id = 1
`);
```

#### `createDatabase(dbName: string): Promise<{ success: boolean, error?: string }>`

Create a new database.

```typescript
await vm.postgres.createDatabase("newdb");
```

#### `dropDatabase(dbName: string): Promise<{ success: boolean, error?: string }>`

Drop a database.

```typescript
await vm.postgres.dropDatabase("olddb");
```

## How It Works

The package uses a systemd oneshot service to install and configure PostgreSQL during VM creation:

1. Installs PostgreSQL from apt repositories
2. Configures password authentication
3. Creates the default database (if specified)
4. Enables network connections
5. Starts PostgreSQL as a system service

The installation is fully automated and completes during VM initialization.
