import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { db, createIssueCode } from './db.js';

const app = express();
const port = Number(process.env.PORT || 3001);
const jwtSecret = process.env.JWT_SECRET || 'campusflow-local-demo-secret-change-me';
const root = path.dirname(fileURLToPath(import.meta.url));
const uploadDirectory = path.resolve(root, '../uploads');
fs.mkdirSync(uploadDirectory, { recursive: true });

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(uploadDirectory));

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDirectory),
  filename: (_req, file, callback) => callback(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${path.extname(file.originalname).toLowerCase()}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) return callback(new Error('Upload a JPG, PNG, WEBP, or GIF image.'));
    callback(null, true);
  },
});

function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Sign in to continue.' });
  try {
    req.user = jwt.verify(token, jwtSecret);
    next();
  } catch {
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Administrator access is required.' });
  next();
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

const issueSelect = 'SELECT i.* FROM issues i';

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body || {};
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) return res.status(400).json({ error: 'Name must be between 2 and 80 characters.' });
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (typeof password !== 'string' || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  try {
    const result = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)').run(name.trim(), email.trim().toLowerCase(), bcrypt.hashSync(password, 10), 'student');
    const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(result.lastInsertRowid);
    const token = jwt.sign(publicUser(user), jwtSecret, { expiresIn: '12h' });
    res.status(201).json({ token, user: publicUser(user) });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'An account with that email already exists.' });
    throw error;
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string') return res.status(400).json({ error: 'Email and password are required.' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'Email or password is incorrect.' });
  const safeUser = publicUser(user);
  const token = jwt.sign(safeUser, jwtSecret, { expiresIn: '12h' });
  res.json({ token, user: safeUser });
});

app.get('/api/auth/me', authenticate, (req, res) => {
  const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(401).json({ error: 'Account no longer exists.' });
  res.json({ user });
});

app.get('/api/dashboard', (_req, res) => {
  const counts = db.prepare(`
    SELECT COUNT(*) AS total,
      SUM(status = 'Pending') AS pending,
      SUM(status = 'Assigned') AS assigned,
      SUM(status = 'In Progress') AS inProgress,
      SUM(status = 'Resolved') AS resolved,
      ROUND(AVG(CASE WHEN resolved_at IS NOT NULL THEN (julianday(resolved_at) - julianday(created_at)) * 24 END), 1) AS avgResolutionHours
    FROM issues
  `).get();
  const byCategory = db.prepare('SELECT category AS name, COUNT(*) AS value FROM issues GROUP BY category ORDER BY value DESC').all();
  const byStatus = db.prepare('SELECT status AS name, COUNT(*) AS value FROM issues GROUP BY status ORDER BY value DESC').all();
  const recent = db.prepare(`${issueSelect} ORDER BY i.created_at DESC LIMIT 5`).all();
  const important = db.prepare(`${issueSelect} WHERE i.priority IN ('High', 'Urgent') AND i.status != 'Resolved' ORDER BY CASE i.priority WHEN 'Urgent' THEN 0 ELSE 1 END, i.created_at DESC LIMIT 5`).all();
  res.json({ counts: Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, value || 0])), byCategory, byStatus, recent, important });
});

app.get('/api/issues', (req, res) => {
  const filters = [];
  const values = [];
  for (const field of ['category', 'priority', 'location', 'status']) {
    if (typeof req.query[field] === 'string' && req.query[field]) {
      filters.push(`i.${field} = ?`);
      values.push(req.query[field]);
    }
  }
  if (typeof req.query.search === 'string' && req.query.search.trim()) {
    filters.push('(i.issue_code LIKE ? OR i.title LIKE ? OR i.location LIKE ?)');
    const search = `%${req.query.search.trim()}%`;
    values.push(search, search, search);
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const issues = db.prepare(`${issueSelect} ${where} ORDER BY i.created_at DESC LIMIT 200`).all(...values);
  res.json({ issues });
});

app.post('/api/issues', authenticate, upload.single('image'), (req, res) => {
  const { title, description, category, location, priority } = req.body || {};
  const fields = { title, description, category, location, priority };
  for (const [field, value] of Object.entries(fields)) {
    if (typeof value !== 'string' || !value.trim()) return res.status(400).json({ error: `${field[0].toUpperCase()}${field.slice(1)} is required.` });
    if (value.trim().length > (field === 'description' ? 2000 : 120)) return res.status(400).json({ error: `${field[0].toUpperCase()}${field.slice(1)} is too long.` });
  }
  if (!['Low', 'Medium', 'High', 'Urgent'].includes(priority)) return res.status(400).json({ error: 'Choose a valid priority.' });
  const categories = ['Electrical', 'Furniture', 'Water & Plumbing', 'Wi-Fi & Network', 'Classroom Equipment', 'Laboratory', 'Cleanliness', 'Other'];
  if (!categories.includes(category)) return res.status(400).json({ error: 'Choose a valid category.' });
  const transaction = db.transaction(() => {
    let issueCode;
    do { issueCode = createIssueCode(); } while (db.prepare('SELECT 1 FROM issues WHERE issue_code = ?').get(issueCode));
    const result = db.prepare(`
      INSERT INTO issues (issue_code, title, description, category, location, priority, reporter_id, image_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(issueCode, title.trim(), description.trim(), category, location.trim(), priority, req.user.id, req.file ? `/uploads/${req.file.filename}` : null);
    db.prepare('INSERT INTO issue_history (issue_id, status, note, changed_by) VALUES (?, ?, ?, ?)').run(result.lastInsertRowid, 'Pending', 'Issue submitted', req.user.id);
    return db.prepare(`${issueSelect} WHERE i.id = ?`).get(result.lastInsertRowid);
  });
  const issue = transaction();
  res.status(201).json({ issue });
});

app.get('/api/issues/:code', (req, res) => {
  const issue = db.prepare(`${issueSelect} WHERE i.issue_code = ?`).get(req.params.code.toUpperCase());
  if (!issue) return res.status(404).json({ error: 'No issue found with that tracking ID.' });
  const history = db.prepare(`
    SELECT h.status, h.note, h.created_at, u.name AS changed_by_name
    FROM issue_history h LEFT JOIN users u ON u.id = h.changed_by
    WHERE h.issue_id = ? ORDER BY h.created_at ASC, h.id ASC
  `).all(issue.id);
  res.json({ issue, history });
});

app.patch('/api/issues/:code', authenticate, requireAdmin, (req, res) => {
  const issue = db.prepare('SELECT * FROM issues WHERE issue_code = ?').get(req.params.code.toUpperCase());
  if (!issue) return res.status(404).json({ error: 'Issue not found.' });
  const { status, assignee, priority, resolutionNotes } = req.body || {};
  const nextStatus = status ?? issue.status;
  const nextPriority = priority ?? issue.priority;
  if (!['Pending', 'Assigned', 'In Progress', 'Resolved'].includes(nextStatus)) return res.status(400).json({ error: 'Choose a valid status.' });
  if (!['Low', 'Medium', 'High', 'Urgent'].includes(nextPriority)) return res.status(400).json({ error: 'Choose a valid priority.' });
  if (assignee !== undefined && (typeof assignee !== 'string' || assignee.trim().length > 100)) return res.status(400).json({ error: 'Assignee must be 100 characters or fewer.' });
  if (resolutionNotes !== undefined && (typeof resolutionNotes !== 'string' || resolutionNotes.length > 2000)) return res.status(400).json({ error: 'Resolution notes must be 2000 characters or fewer.' });
  const changed = [];
  if (nextStatus !== issue.status) changed.push(`Status changed to ${nextStatus}`);
  if ((assignee ?? '') !== (issue.assignee ?? '')) changed.push(assignee ? `Assigned to ${assignee.trim()}` : 'Assignee cleared');
  if (resolutionNotes !== undefined && resolutionNotes !== issue.resolution_notes && resolutionNotes.trim()) changed.push(resolutionNotes.trim());
  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE issues SET status = ?, priority = ?, assignee = ?, resolution_notes = ?,
        updated_at = datetime('now'), resolved_at = CASE WHEN ? = 'Resolved' THEN COALESCE(resolved_at, datetime('now')) ELSE NULL END
      WHERE id = ?
    `).run(nextStatus, nextPriority, assignee === undefined ? issue.assignee : (assignee.trim() || null), resolutionNotes === undefined ? issue.resolution_notes : (resolutionNotes.trim() || null), nextStatus, issue.id);
    for (const note of changed) db.prepare('INSERT INTO issue_history (issue_id, status, note, changed_by) VALUES (?, ?, ?, ?)').run(issue.id, nextStatus, note, req.user.id);
    if (!changed.length && nextPriority !== issue.priority) db.prepare('INSERT INTO issue_history (issue_id, status, note, changed_by) VALUES (?, ?, ?, ?)').run(issue.id, nextStatus, `Priority changed to ${nextPriority}`, req.user.id);
  });
  transaction();
  const updated = db.prepare(`${issueSelect} WHERE i.id = ?`).get(issue.id);
  res.json({ issue: updated });
});

app.get('/api/resources', (_req, res) => res.json({ resources: db.prepare('SELECT * FROM resources ORDER BY category, name').all() }));

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Image must be 4 MB or smaller.' : 'The image could not be uploaded.' });
  if (error.message?.startsWith('Upload a ')) return res.status(400).json({ error: error.message });
  console.error(error);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

app.listen(port, () => console.log(`CampusFlow API running at http://localhost:${port}`));
