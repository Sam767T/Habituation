import * as SQLite from 'expo-sqlite';

const DB_NAME = 'habituation.db';

let db = null;

async function initDatabase() {
  if (db) return db;
  db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS stopwatch_records (
      id INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      duration_ms INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  return db;
}

export async function addStopwatchRecord(name, durationMs) {
  const database = await initDatabase();
  await database.runAsync(
    "INSERT INTO stopwatch_records (name, duration_ms, created_at) VALUES (?, ?, datetime('now','localtime'))",
    [name || 'Unnamed', durationMs]
  );
}

export async function getStopwatchRecords() {
  const database = await initDatabase();
  const records = await database.getAllAsync(
    'SELECT id, name, duration_ms, created_at FROM stopwatch_records ORDER BY created_at DESC'
  );
  return records;
}

export async function deleteStopwatchRecord(id) {
  const database = await initDatabase();
  await database.runAsync('DELETE FROM stopwatch_records WHERE id = ?', [id]);
}

export async function resetAllData() {
  const database = await initDatabase();
  await database.runAsync('DELETE FROM stopwatch_records');
}
