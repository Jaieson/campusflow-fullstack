import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';

const databaseFile = process.env.DATABASE_FILE || './data/campusflow.sqlite';
if (databaseFile !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(databaseFile)), { recursive: true });

export const db = new Database(databaseFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('student', 'admin')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    location TEXT NOT NULL,
    priority TEXT NOT NULL CHECK(priority IN ('Low', 'Medium', 'High', 'Urgent')),
    status TEXT NOT NULL CHECK(status IN ('Pending', 'Assigned', 'In Progress', 'Resolved')) DEFAULT 'Pending',
    image_path TEXT,
    reporter_id INTEGER NOT NULL REFERENCES users(id),
    assignee TEXT,
    resolution_notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    resolved_at TEXT
  );
  CREATE TABLE IF NOT EXISTS issue_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    note TEXT,
    changed_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS resources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    location TEXT NOT NULL,
    details TEXT NOT NULL,
    availability TEXT NOT NULL
  );
`);

const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
if (userCount === 0) {
  const addUser = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)');
  addUser.run('Aarav Sharma', 'student@campusflow.local', bcrypt.hashSync('Campus123!', 10), 'student');
  addUser.run('Campus Administrator', 'admin@campusflow.local', bcrypt.hashSync('Campus123!', 10), 'admin');
}

if (db.prepare('SELECT COUNT(*) AS count FROM resources').get().count === 0) {
  const addResource = db.prepare('INSERT INTO resources (name, category, location, details, availability) VALUES (?, ?, ?, ?, ?)');
  const resources = [
    ['Innovation Lab', 'Laboratory', 'Block C · 2nd floor', 'Electronics prototyping benches, soldering stations, and shared testing equipment.', 'Open · 9:00 AM – 5:00 PM'],
    ['Seminar Hall A', 'Seminar hall', 'Main Block · Ground floor', '120-seat presentation space with a projector, audio system, and lecture capture.', 'Available today'],
    ['Media Projector Kit', 'Equipment', 'Library · Help desk', 'Portable HD projector with HDMI and USB-C adapters. Borrow with a campus ID.', '2 of 4 available'],
    ['Quiet Study Lounge', 'Study space', 'Library · 3rd floor', 'Silent study zone with individual desks, power outlets, and campus Wi-Fi.', 'Open · 24 seats free'],
    ['Engineering Workshop', 'Laboratory', 'Block B · Ground floor', 'Supervised workshop with shared tools and mechanical engineering equipment.', 'Open · 10:00 AM – 4:00 PM'],
    ['Collaboration Room 2', 'Study space', 'Learning Commons · 1st floor', 'Small-group room with a display screen and whiteboard for collaborative work.', 'Available today'],
  ];
  const seedResources = db.transaction((rows) => rows.forEach((row) => addResource.run(...row)));
  seedResources(resources);
}

export function createIssueCode() {
  return `CF-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}
