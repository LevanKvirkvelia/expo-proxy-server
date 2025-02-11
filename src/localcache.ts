import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";
import { promises as fs, mkdirSync } from "fs";
import { join, dirname } from "path";

export const DEFAULT_CACHE_TIME = 60 * 60 * 1000;

async function safeWriteFile(
  path: string,
  data: Buffer | string
): Promise<void> {
  await fs.mkdir(dirname(path), { recursive: true });
  const randName = `${path}.${Math.random().toString(36).slice(2)}.tmp`;
  await fs.writeFile(randName, data);
  await fs.rename(randName, path);
}

export class LocalCache {
  private db: Promise<Database<sqlite3.Database, sqlite3.Statement>>;
  private cleanupInterval: ReturnType<typeof setInterval>;
  private fileStoragePath: string | null;
  defaultTTL: number = DEFAULT_CACHE_TIME;

  constructor(
    cachePath: string,
    filesInFs: boolean = true,
    cleanupIntervalMs: number = 60000,
    defaultTTL: number = DEFAULT_CACHE_TIME
  ) {
    this.defaultTTL = defaultTTL;
    mkdirSync(cachePath, { recursive: true });

    this.db = this.initializeDatabase(join(cachePath, "cache.db"));

    this.cleanupInterval = setInterval(
      () => this.deleteExpiredEntries(),
      cleanupIntervalMs
    );

    this.fileStoragePath = filesInFs ? join(cachePath, "files") : null;
    if (this.fileStoragePath)
      mkdirSync(this.fileStoragePath, { recursive: true });
  }

  private async initializeDatabase(
    dbPath: string
  ): Promise<Database<sqlite3.Database, sqlite3.Statement>> {
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    await db.exec(`
      CREATE TABLE IF NOT EXISTS cache (
        key TEXT PRIMARY KEY,
        value TEXT,
        ttl INTEGER,
        created_at INTEGER,
        last_used_at INTEGER
      )
    `);

    await db.exec(`
      CREATE TABLE IF NOT EXISTS files (
        key TEXT PRIMARY KEY,
        mime TEXT,
        path TEXT,
        data BLOB,
        ttl INTEGER,
        created_at INTEGER,
        last_used_at INTEGER
      )
    `);

    return db;
  }

  async set(
    key: string,
    value: any,
    ttl: number = this.defaultTTL
  ): Promise<void> {
    const now = Date.now();
    const valueString = JSON.stringify(value);
    const db = await this.db;

    await db.run(
      `INSERT OR REPLACE INTO cache (key, value, ttl, created_at, last_used_at) VALUES (?, ?, ?, ?, ?)`,
      key,
      valueString,
      ttl,
      now,
      now
    );
  }

  async get(key: string): Promise<any | null> {
    const db = await this.db;
    const now = Date.now();
    const result = await db.get(
      `UPDATE cache SET last_used_at = ? WHERE key = ? RETURNING *`,
      now,
      key
    );

    if (result) {
      return JSON.parse(result.value);
    }

    return null;
  }

  async setFile(
    key: string,
    data: Buffer | string,
    mime: string,
    ttl: number = this.defaultTTL
  ): Promise<void> {
    const now = Date.now();
    const db = await this.db;

    const filePath = this.fileStoragePath
      ? join(this.fileStoragePath, key)
      : null;
    const fileData = filePath ? null : data;

    if (filePath) await safeWriteFile(filePath, data);

    await db.run(
      `INSERT OR REPLACE INTO files (key, mime, path, data, ttl, created_at, last_used_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      key,
      mime,
      filePath,
      fileData,
      ttl,
      now,
      now
    );
  }

  async getFile(key: string): Promise<{ mime: string; data: Buffer } | null> {
    const db = await this.db;
    const now = Date.now();
    const result = await db.get(
      `UPDATE files SET last_used_at = ? WHERE key = ? RETURNING *`,
      now,
      key
    );

    if (!result) return null;

    try {
      return {
        mime: result.mime,
        data: result.path ? await fs.readFile(result.path) : result.data,
      };
    } catch (err) {
      await this.deleteFileEntry(key, result.path);
      return null;
    }
  }

  private async deleteFileEntry(
    key: string,
    path: string | null
  ): Promise<void> {
    const db = await this.db;
    await db.run(`DELETE FROM files WHERE key = ?`, key);
    if (path) {
      await fs.unlink(path).catch(() => {
        // Ignore errors if file does not exist
      });
    }
  }

  private async deleteExpiredEntries(): Promise<void> {
    const now = Date.now();
    const db = await this.db;

    const expiredCacheEntries = await db.all(
      `SELECT key FROM cache WHERE ? - last_used_at >= ttl`,
      now
    );
    const expiredFileEntries = await db.all(
      `SELECT key, path FROM files WHERE ? - last_used_at >= ttl`,
      now
    );

    for (const entry of expiredCacheEntries) {
      await db.run(`DELETE FROM cache WHERE key = ?`, entry.key);
    }

    for (const entry of expiredFileEntries) {
      await db.run(`DELETE FROM files WHERE key = ?`, entry.key);
      if (entry.path) {
        await fs.unlink(entry.path).catch(() => {
          // Ignore errors if file does not exist
        });
      }
    }
  }

  stopCleanup() {
    clearInterval(this.cleanupInterval);
  }
}

export const cache = new LocalCache("./_cache", false);
