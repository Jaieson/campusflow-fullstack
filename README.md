# CampusFlow

A locally runnable campus issue-management app built with React, Vite, Express, SQLite, Recharts, and Lucide.

## Run locally

1. Install Node.js 18 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and set a private `JWT_SECRET` (the app has a local-only fallback for a quick demo).
4. Run `npm run dev`.
5. Open the Vite URL printed in the terminal (usually `http://localhost:5173`).

The API runs at `http://localhost:3001`. For a production frontend build, run `npm run build`; `npm start` starts the API.

## Demo accounts

The first server start seeds these demo-only accounts. Both use the password `Campus123!`.

- Student: `student@campusflow.local`
- Administrator: `admin@campusflow.local`

Passwords are stored as bcrypt hashes. The SQLite database is created at `data/campusflow.sqlite` and is intentionally excluded from Git. Delete that file to reset demo data; the accounts and resource directory are re-seeded on the next server start.

## Included

- Student registration and sign-in with role-aware, signed bearer tokens.
- Issue submission with optional image upload, unique tracking IDs, and persistent status history.
- Public tracking by issue ID and searchable/filterable issue list.
- Administrator-only status, assignee, priority, and resolution-note updates enforced by the API.
- Dashboard totals and charts calculated from SQLite records, plus a seeded campus resource directory.

Image uploads accept JPG, PNG, WEBP, and GIF files up to 4 MB.
