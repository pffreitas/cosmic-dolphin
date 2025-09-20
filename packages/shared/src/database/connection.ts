import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { Database } from './schema';

export interface DatabaseConfig {
  connectionString: string;
  maxConnections?: number;
  idleTimeout?: number;
  connectionTimeout?: number;
}

class DatabaseConnection {
  private static instance: Kysely<Database> | null = null;
  private static config: DatabaseConfig | null = null;

  static configure(config: DatabaseConfig): void {
    this.config = config;
    this.instance = null; // Reset instance to force recreation with new config
  }

  static getInstance(): Kysely<Database> {
    if (!this.instance) {
      if (!this.config) {
        throw new Error('Database not configured. Call DatabaseConnection.configure() first.');
      }
      this.instance = this.createInstance(this.config);
    }
    return this.instance;
  }

  private static createInstance(config: DatabaseConfig): Kysely<Database> {
    const pool = new Pool({
      connectionString: config.connectionString,
      max: config.maxConnections || 20,
      idleTimeoutMillis: config.idleTimeout || 30000,
      connectionTimeoutMillis: config.connectionTimeout || 10000,
    });

    const dialect = new PostgresDialect({
      pool,
    });

    return new Kysely<Database>({
      dialect,
    });
  }

  static async destroy(): Promise<void> {
    if (this.instance) {
      await this.instance.destroy();
      this.instance = null;
    }
  }
}

export function createDatabase(connectionString: string): Kysely<Database> {
  DatabaseConnection.configure({
    connectionString,
  });
  return DatabaseConnection.getInstance();
}

export function getDatabase(): Kysely<Database> {
  return DatabaseConnection.getInstance();
}

export { DatabaseConnection };