import {
  VmSpec,
  type CreateVmOptions,
  VmWith,
  VmWithInstance,
} from "freestyle-sandboxes";

export interface PostgresOptions {
  version?: string;
  password?: string;
  database?: string;
  user?: string;
}

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
  error?: string;
}

export class VmPostgresInstance extends VmWithInstance {
  private password: string;
  private database: string;
  private user: string;

  constructor(options: Required<PostgresOptions>) {
    super();
    this.password = options.password;
    this.database = options.database;
    this.user = options.user;
  }

  /**
   * Execute a SQL query and return the results
   */
  async query<T = any>(sql: string): Promise<QueryResult<T>> {
    // Escape single quotes in SQL
    const escapedSql = sql.replace(/'/g, "'\\''");

    const command = `PGPASSWORD='${this.password}' psql -U ${this.user} -d ${this.database} -t -A -F',' -c '${escapedSql}' --json`;

    const result = await this.vm.exec({
      command,
    });

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
   * Execute a SQL command without returning results (e.g., CREATE, INSERT, UPDATE, DELETE)
   */
  async exec(sql: string): Promise<{ success: boolean; error?: string }> {
    const escapedSql = sql.replace(/'/g, "'\\''");

    const command = `PGPASSWORD='${this.password}' psql -U ${this.user} -d ${this.database} -c '${escapedSql}'`;

    const result = await this.vm.exec({
      command,
    });

    if (result.statusCode !== 0) {
      return {
        success: false,
        error: result.stderr || "Command execution failed",
      };
    }

    return { success: true };
  }

  /**
   * Create a new database
   */
  async createDatabase(
    dbName: string
  ): Promise<{ success: boolean; error?: string }> {
    const command = `PGPASSWORD='${this.password}' psql -U ${this.user} -d postgres -c 'CREATE DATABASE ${dbName}'`;

    const result = await this.vm.exec({
      command,
    });

    if (result.statusCode !== 0) {
      return {
        success: false,
        error: result.stderr || "Database creation failed",
      };
    }

    return { success: true };
  }

  /**
   * Drop a database
   */
  async dropDatabase(
    dbName: string
  ): Promise<{ success: boolean; error?: string }> {
    const command = `PGPASSWORD='${this.password}' psql -U ${this.user} -d postgres -c 'DROP DATABASE IF EXISTS ${dbName}'`;

    const result = await this.vm.exec({
      command,
    });

    if (result.statusCode !== 0) {
      return {
        success: false,
        error: result.stderr || "Database drop failed",
      };
    }

    return { success: true };
  }
}

export class VmPostgres extends VmWith<VmPostgresInstance> {
  private options: Required<PostgresOptions>;

  constructor(options: PostgresOptions = {}) {
    super();
    this.options = {
      version: options.version || "16",
      password: options.password || "postgres",
      database: options.database || "postgres",
      user: options.user || "postgres",
    };
  }

  override configureSnapshotSpec(spec: VmSpec): VmSpec {
    const installScript = `#!/bin/bash
set -e

# Install PostgreSQL
sudo apt-get update
sudo apt-get install -y postgresql-${this.options.version} postgresql-client-${this.options.version}

# Start PostgreSQL
sudo systemctl start postgresql

# Set password for postgres user
sudo -u postgres psql -c "ALTER USER postgres PASSWORD '${this.options.password}';"

# Create default database if not postgres
if [ "${this.options.database}" != "postgres" ]; then
  sudo -u postgres psql -c "CREATE DATABASE ${this.options.database};"
fi

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
          "/opt/install-postgres.sh": {
            content: installScript,
          },
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

  createInstance(): VmPostgresInstance {
    return new VmPostgresInstance(this.options);
  }

  installServiceName(): string {
    return "install-postgres.service";
  }
}
