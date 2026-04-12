# @freestyle-sh/with-postgres

PostgreSQL runtime extension for Freestyle VMs. Declaratively configure a PostgreSQL server, databases, and schema/seed scripts that run during VM snapshot setup.

## Installation

```bash
npm install @freestyle-sh/with-postgres freestyle
```

## Usage

```typescript
import { freestyle, VmSpec } from "freestyle";
import { VmPostgres } from "@freestyle-sh/with-postgres";

const pg = new VmPostgres({ password: "secret" });

const db = pg.database({ name: "myapp", create: true });

const schema = db.script("schema", {
  sql: `
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100)
    );
  `,
});

const seed = db.script("seed", {
  sql: `INSERT INTO users (name) VALUES ('Alice'), ('Bob');`,
  after: [schema],
});

const spec = new VmSpec()
  .with("postgres", pg)
  .with("db", db)
  .with("schema", schema)
  .with("seed", seed)
  .snapshot();

const { vm } = await freestyle.vms.create({ spec });

const result = await vm.db.query<{ id: number; name: string }>(
  `SELECT * FROM users`
);
console.log(result.rows); // [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]
```

The install, database creation, and each script run as ordered systemd oneshot services during snapshot setup, so everything is baked into the snapshot.

## API

### `new VmPostgres(options?)`

Configures the PostgreSQL server. Pure config — has no runtime methods.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `version` | `string` | `"18"` | PostgreSQL major version (installed from the official PGDG apt repo) |
| `password` | `string` | `"postgres"` | Password for the postgres superuser |
| `user` | `string` | `"postgres"` | PostgreSQL superuser name |

### `pg.database({ name, create? })`

Declares a database. Returns a `Database` you can attach scripts to and query at runtime.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | `string` | — | Database name |
| `create` | `boolean` | `false` | If true, idempotently creates the database during snapshot setup |

#### `vm.<name>.query<T>(sql)`

Run a SQL query against this database. Returns `{ rows: T[], rowCount, error? }`. Results are returned as a JSON array (psql wraps the query in `json_agg(row_to_json(...))`).

#### `vm.<name>.exec(sql)`

Run a SQL command without returning rows. Returns `{ success, error? }`.

### `db.script(name, { sql, after? })`

Declares a SQL script that runs once during snapshot setup against this database.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sql` | `string` | — | Inline SQL to execute |
| `after` | `DatabaseScript[]` | `[]` | Scripts that must run before this one |

Each script becomes a systemd oneshot with `ON_ERROR_STOP=1`, so the snapshot fails fast if any SQL errors. Scripts depend automatically on the database's create service (or on `install-postgres` if `create: false`), and on every script listed in `after`.

#### `vm.<name>.logs()`

Returns the journalctl output for the script's systemd service as `string[]`.

## How it works

1. `VmPostgres` adds the official PGDG apt repository and installs the requested PostgreSQL version (see https://www.postgresql.org/download/linux/debian/), then sets the superuser password and enables md5 password auth on TCP and the local socket.
2. Each `database({ create: true })` adds a oneshot that creates the database if it doesn't exist.
3. Each `script(...)` writes its SQL to `/opt/pg-scripts/<db>/<name>.sql` and adds a oneshot that runs `psql -f` against the right database, in the order you declared via `after`.
4. All setup oneshots use `deleteAfterSuccess: true`, so they don't re-run on reboot from the snapshot.
