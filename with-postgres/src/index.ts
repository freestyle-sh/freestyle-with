import { VmSpec, VmWith, VmWithInstance } from "freestyle";

export interface PostgresOptions {
  version?: string;
  password?: string;
  user?: string;
}

interface ResolvedPostgresOptions {
  version: string;
  password: string;
  user: string;
}

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
  error?: string;
}

export interface DatabaseOptions {
  name: string;
  create?: boolean;
}

export interface ScriptOptions {
  sql: string;
  after?: DatabaseScript[];
}

export class VmPostgres extends VmWith<VmPostgresInstance> {
  options: ResolvedPostgresOptions;

  constructor(options: PostgresOptions = {}) {
    super();
    this.options = {
      version: options.version || "18",
      password: options.password || "postgres",
      user: options.user || "postgres",
    };
  }

  database(options: DatabaseOptions): Database {
    return new Database(options, this);
  }

  installServiceName(): string {
    return "install-postgres.service";
  }

  override configureSnapshotSpec(spec: VmSpec): VmSpec {
    const installScript = `#!/bin/bash
set -e

# Add the official PostgreSQL apt repository (PGDG) so any
# PostgreSQL version is available on any Debian release.
# See https://www.postgresql.org/download/linux/debian/
sudo apt-get update
sudo apt-get install -y curl ca-certificates
sudo install -d /usr/share/postgresql-common/pgdg
sudo curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc --fail \
  https://www.postgresql.org/media/keys/ACCC4CF8.asc
. /etc/os-release
sudo sh -c "echo 'deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $VERSION_CODENAME-pgdg main' > /etc/apt/sources.list.d/pgdg.list"

# Install PostgreSQL
sudo apt-get update
sudo apt-get install -y postgresql-${this.options.version} postgresql-client-${this.options.version}

# Start PostgreSQL
sudo systemctl start postgresql

# Set password for postgres user
sudo -u postgres psql -c "ALTER USER postgres PASSWORD '${this.options.password}';"

# Configure PostgreSQL to accept password authentication
echo "host all all 0.0.0.0/0 md5" | sudo tee -a /etc/postgresql/${this.options.version}/main/pg_hba.conf
echo "local all all md5" | sudo tee -a /etc/postgresql/${this.options.version}/main/pg_hba.conf

# Allow connections from all addresses
sudo sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" /etc/postgresql/${this.options.version}/main/postgresql.conf

# Restart PostgreSQL to apply changes
sudo systemctl restart postgresql

# Enable PostgreSQL to start on boot
sudo systemctl enable postgresql
`;

    return this.composeSpecs(
      spec,
      new VmSpec({
        additionalFiles: {
          "/opt/install-postgres.sh": { content: installScript },
        },
        systemd: {
          services: [
            {
              name: "install-postgres",
              mode: "oneshot",
              deleteAfterSuccess: true,
              exec: ["bash /opt/install-postgres.sh"],
              timeoutSec: 600,
            },
          ],
        },
      })
    );
  }

  override createInstance(): VmPostgresInstance {
    return new VmPostgresInstance();
  }
}

export class VmPostgresInstance extends VmWithInstance {}

export class Database extends VmWith<DatabaseInstance> {
  options: DatabaseOptions;
  postgres: VmPostgres;

  constructor(options: DatabaseOptions, postgres: VmPostgres) {
    super();
    this.options = options;
    this.postgres = postgres;
  }

  script(name: string, options: ScriptOptions): DatabaseScript {
    return new DatabaseScript(name, this, options);
  }

  getCreateServiceName(): string {
    return `pg-create-${this.options.name}`;
  }

  override configureSnapshotSpec(spec: VmSpec): VmSpec {
    if (!this.options.create) return spec;

    const { password, user } = this.postgres.options;
    const dbName = this.options.name;

    // Idempotent: only CREATE DATABASE if it doesn't already exist.
    const psqlBase = `PGPASSWORD='${password}' psql -h 127.0.0.1 -U ${user} -d postgres`;
    const createCmd = `${psqlBase} -tAc "SELECT 1 FROM pg_database WHERE datname='${dbName}'" | grep -q 1 || ${psqlBase} -c 'CREATE DATABASE ${dbName}'`;

    return this.composeSpecs(
      spec,
      new VmSpec({
        systemd: {
          services: [
            {
              name: this.getCreateServiceName(),
              mode: "oneshot",
              deleteAfterSuccess: true,
              after: [this.postgres.installServiceName()],
              requires: [this.postgres.installServiceName()],
              bash: createCmd,
              timeoutSec: 60,
            },
          ],
        },
      })
    );
  }

  override createInstance(): DatabaseInstance {
    return new DatabaseInstance({
      database: this.options.name,
      user: this.postgres.options.user,
      password: this.postgres.options.password,
    });
  }
}

export class DatabaseInstance extends VmWithInstance {
  private database: string;
  private user: string;
  private password: string;

  constructor(opts: { database: string; user: string; password: string }) {
    super();
    this.database = opts.database;
    this.user = opts.user;
    this.password = opts.password;
  }

  /**
   * Execute a SQL query against this database and return the results.
   */
  async query<T = any>(sql: string): Promise<QueryResult<T>> {
    // Wrap the user's query so psql returns a single JSON array via
    // json_agg/row_to_json (psql has no native --json flag).
    const wrappedSql = `SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (${sql}) t`;
    const escapedSql = wrappedSql.replace(/'/g, "'\\''");

    // -h 127.0.0.1 forces TCP so psql uses md5 password auth (peer auth
    // would fail over the local socket).
    const command = `PGPASSWORD='${this.password}' psql -h 127.0.0.1 -U ${this.user} -d ${this.database} -t -A -c '${escapedSql}'`;

    const result = await this.vm.exec({ command });

    if (result.statusCode !== 0) {
      return {
        rows: [],
        rowCount: 0,
        error: result.stderr || "Query execution failed",
      };
    }

    try {
      const parsed = JSON.parse(result.stdout || "[]");
      return {
        rows: Array.isArray(parsed) ? parsed : [],
        rowCount: Array.isArray(parsed) ? parsed.length : 0,
      };
    } catch (e) {
      return {
        rows: [],
        rowCount: 0,
        error: `Failed to parse query results: ${e}`,
      };
    }
  }

  /**
   * Execute a SQL command without returning results (CREATE, INSERT, UPDATE, DELETE, etc.).
   */
  async exec(sql: string): Promise<{ success: boolean; error?: string }> {
    const escapedSql = sql.replace(/'/g, "'\\''");
    const command = `PGPASSWORD='${this.password}' psql -h 127.0.0.1 -U ${this.user} -d ${this.database} -c '${escapedSql}'`;

    const result = await this.vm.exec({ command });

    if (result.statusCode !== 0) {
      return {
        success: false,
        error: result.stderr || "Command execution failed",
      };
    }

    return { success: true };
  }
}

export class DatabaseScript extends VmWith<DatabaseScriptInstance> {
  name: string;
  database: Database;
  options: ScriptOptions;

  constructor(name: string, database: Database, options: ScriptOptions) {
    super();
    this.name = name;
    this.database = database;
    this.options = options;
  }

  getServiceName(): string {
    return `pg-script-${this.database.options.name}-${this.name}`;
  }

  getScriptPath(): string {
    return `/opt/pg-scripts/${this.database.options.name}/${this.name}.sql`;
  }

  override configureSnapshotSpec(spec: VmSpec): VmSpec {
    const { password, user } = this.database.postgres.options;
    const dbName = this.database.options.name;
    const scriptPath = this.getScriptPath();

    // Build dependency list: must wait for the database to exist (or for
    // postgres install if the db wasn't created here), plus any explicit
    // script dependencies.
    const deps: string[] = [];
    if (this.database.options.create) {
      deps.push(this.database.getCreateServiceName());
    } else {
      deps.push(this.database.postgres.installServiceName());
    }
    for (const dep of this.options.after ?? []) {
      deps.push(dep.getServiceName());
    }

    const command = `PGPASSWORD='${password}' psql -h 127.0.0.1 -U ${user} -d ${dbName} -v ON_ERROR_STOP=1 -f ${scriptPath}`;

    return this.composeSpecs(
      spec,
      new VmSpec({
        additionalFiles: {
          [scriptPath]: { content: this.options.sql },
        },
        systemd: {
          services: [
            {
              name: this.getServiceName(),
              mode: "oneshot",
              deleteAfterSuccess: true,
              after: deps,
              requires: deps,
              bash: command,
              timeoutSec: 300,
            },
          ],
        },
      })
    );
  }

  override createInstance(): DatabaseScriptInstance {
    return new DatabaseScriptInstance(this.getServiceName());
  }
}

export class DatabaseScriptInstance extends VmWithInstance {
  private serviceName: string;

  constructor(serviceName: string) {
    super();
    this.serviceName = serviceName;
  }

  logs() {
    return this.vm
      .exec({
        command: `journalctl -u ${this.serviceName} --no-pager -n 100`,
      })
      .then((result) => result.stdout?.trim().split("\n"));
  }
}
