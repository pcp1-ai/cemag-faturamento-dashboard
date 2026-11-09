import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { CemagAnalyticBase, CemagExternalSnapshot, CemagSharedFile, InsertCemagAnalyticBase, InsertCemagExternalSnapshot, InsertCemagSharedFile, InsertUser, cemagAnalyticBases, cemagAnalyticRows, cemagExternalSnapshots, cemagSharedFiles, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getSharedFile(kind: "base" | "metas"): Promise<CemagSharedFile | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(cemagSharedFiles).where(eq(cemagSharedFiles.kind, kind)).limit(1);
  return result[0];
}

export async function upsertSharedFile(file: InsertCemagSharedFile): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível para salvar o arquivo compartilhado.");
  const { kind, ...updateFields } = file;
  await db.insert(cemagSharedFiles).values(file).onDuplicateKeyUpdate({ set: updateFields });
}

export async function getCurrentAnalyticBase(): Promise<CemagAnalyticBase | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(cemagAnalyticBases).orderBy(desc(cemagAnalyticBases.updatedAt)).limit(1);
  return rows[0];
}

export async function replaceAnalyticBase(base: InsertCemagAnalyticBase, rows: Array<{ baseVersion: string; rowNumber: number; payload: string }>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível para salvar a base analítica.");
  await db.delete(cemagAnalyticRows);
  await db.delete(cemagAnalyticBases);
  await db.insert(cemagAnalyticBases).values(base);
  for (let offset = 0; offset < rows.length; offset += 250) {
    await db.insert(cemagAnalyticRows).values(rows.slice(offset, offset + 250));
  }
}

export async function getExternalSnapshot(cidade: string, uf?: string): Promise<CemagExternalSnapshot | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(cemagExternalSnapshots).where(eq(cemagExternalSnapshots.cidade, cidade)).limit(20);
  return rows.find((row) => (row.uf || "") === (uf || ""));
}

export async function listExternalSnapshots(): Promise<CemagExternalSnapshot[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(cemagExternalSnapshots);
}

export async function upsertExternalSnapshot(snapshot: InsertCemagExternalSnapshot): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível para salvar fatores externos.");
  await db.insert(cemagExternalSnapshots).values(snapshot).onDuplicateKeyUpdate({ set: { payload: snapshot.payload, updatedAt: new Date() } });
}
