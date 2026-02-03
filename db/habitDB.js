import * as SQLite from 'expo-sqlite';

const DB_NAME = 'habituation.db';

let db = null;

async function initDatabase() {
  if (db) return db;
  db = await SQLite.openDatabaseAsync(DB_NAME);
  
  // Create habits table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS habits (
      id INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('positive', 'negative')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  // Create habit logs table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS habit_logs (
      id INTEGER PRIMARY KEY NOT NULL,
      habit_id INTEGER NOT NULL,
      log_date DATE NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      logged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (habit_id) REFERENCES habits (id) ON DELETE CASCADE,
      UNIQUE(habit_id, log_date)
    );
  `);
  
  return db;
}

export async function addHabit(name, type) {
  const database = await initDatabase();
  await database.runAsync(
    'INSERT INTO habits (name, type) VALUES (?, ?)',
    [name, type]
  );
}

export async function getHabits() {
  const database = await initDatabase();
  const habits = await database.getAllAsync(
    'SELECT * FROM habits ORDER BY type DESC, name ASC'
  );
  return habits;
}

export async function deleteHabit(id) {
  const database = await initDatabase();
  await database.runAsync('DELETE FROM habits WHERE id = ?', [id]);
}

export async function logHabit(habitId, date, completed) {
  const database = await initDatabase();
  await database.runAsync(
    `INSERT OR REPLACE INTO habit_logs (habit_id, log_date, completed, logged_at) 
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
    [habitId, date, completed ? 1 : 0]
  );
}

export async function getHabitLogs(habitId) {
  const database = await initDatabase();
  const logs = await database.getAllAsync(
    'SELECT * FROM habit_logs WHERE habit_id = ? ORDER BY log_date DESC',
    [habitId]
  );
  return logs;
}

export async function getHabitLogForDate(habitId, date) {
  const database = await initDatabase();
  const log = await database.getFirstAsync(
    'SELECT * FROM habit_logs WHERE habit_id = ? AND log_date = ?',
    [habitId, date]
  );
  return log;
}

export async function getAllHabitLogsForDate(date) {
  const database = await initDatabase();
  const logs = await database.getAllAsync(
    'SELECT * FROM habit_logs WHERE log_date = ?',
    [date]
  );
  return logs;
}

export async function getHabitStats(habitId, days = 30) {
  const database = await initDatabase();
  const stats = await database.getAllAsync(
    `SELECT log_date, completed 
     FROM habit_logs 
     WHERE habit_id = ? 
     AND log_date >= date('now', '-${days} days')
     ORDER BY log_date DESC`,
    [habitId]
  );
  return stats;
}

export async function getHabitLogsForRange(habitId, startDate, endDate) {
  const database = await initDatabase();
  const logs = await database.getAllAsync(
    `SELECT log_date, completed 
     FROM habit_logs 
     WHERE habit_id = ?
     AND log_date BETWEEN ? AND ?
     ORDER BY log_date ASC`,
    [habitId, startDate, endDate]
  );
  return logs;
}

// Function to create dummy data
export async function createDummyData() {
  const database = await initDatabase();
  
  // Check if we already have data
  const existingHabits = await getHabits();
  if (existingHabits.length > 0) {
    return; // Data already exists
  }
  
  // Add positive habits
  await addHabit('Morning Exercise', 'positive');
  await addHabit('Read for 30 mins', 'positive');
  await addHabit('Meditation', 'positive');
  
  // Add negative habits
  await addHabit('Smoking', 'negative');
  await addHabit('Junk Food', 'negative');
  await addHabit('Social Media Doom Scrolling', 'negative');
  
  // Get all habits
  const habits = await getHabits();
  
  // Create logs for the past 14 days
  for (let i = 0; i < 14; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    for (const habit of habits) {
      // Randomly log habits with different probabilities
      const random = Math.random();
      let completed = false;
      
      if (habit.type === 'positive') {
        // 70% success rate for positive habits
        completed = random > 0.3;
      } else {
        // 60% success rate for abstaining from negative habits
        completed = random > 0.4;
      }
      
      await logHabit(habit.id, dateStr, completed);
    }
  }
}
