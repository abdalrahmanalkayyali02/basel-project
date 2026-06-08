# MomsMed Guide

A pharmacist-curated, QR-friendly Single Page Application that lists pregnancy-safe medications and herbs across Jordan, Europe/UK and US markets — plus a doctor's CRUD portal that persists every change to a single flat file (`file.json`).

Built per the **Pharmacy Practice — Practical Pharmacists** project spec.

## Stack

- **Backend:** Node.js + Express (single file: `server.js`)
- **Frontend:** Vanilla JavaScript (ES6+), Tailwind CSS via CDN, Plus Jakarta Sans (Google Fonts)
- **Storage:** `file.json` (JSON). No SQL/NoSQL.
- **Auth:** Hardcoded admin (`basel` / `basel2004`) with a short-lived session token.

## Run locally

```bash
npm install
npm start
```

Open <http://localhost:3000>.

The server seeds `file.json` automatically on first launch if it doesn't exist.

## API surface

| Method | Path          | Purpose                                                   |
| ------ | ------------- | --------------------------------------------------------- |
| GET    | `/api/data`   | Read the entire catalog from `file.json`                   |
| POST   | `/api/login`  | Validate admin credentials, return a session token        |
| POST   | `/api/save`   | Overwrite `file.json` with the new catalog (auth required) |
| POST   | `/api/logout` | Invalidate the active session token                       |

## Features

- 🟢 / 🟡 / 🔴 traffic-light category navigation with theme-aware accents.
- Sticky regional brand filter (Jordan, Europe/UK, US) — hides irrelevant local brands.
  Red entries always remain visible (globally dangerous).
- Interactive true/false quiz with color-coded feedback boxes.
- Doctor-only CRUD portal: add / edit / delete medications, herbs and quiz cards;
  one click persists to `file.json`.
- Mobile-first responsive layout — optimized for QR-code phone access in pharmacies.
