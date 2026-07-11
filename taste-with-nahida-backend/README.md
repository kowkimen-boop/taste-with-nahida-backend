# Taste with Nahida — Backend

A Node.js + Express backend for the Taste with Nahida website, built on **Turso** (a free, hosted, persistent SQLite-compatible database) and **Cloudinary** (free image hosting) — so your content and photos survive redeploys on free hosting like Render, instead of disappearing when the server restarts.

It gives you:

- 🔐 Admin login (JWT-based)
- 🍛 Recipes, 🍽 Reviews, ✈️ Travel Blog posts — full create/edit/delete
- 📸 Image uploads (stored on Cloudinary, so they persist)
- 📞 A real, working contact form (saves to the database + optional email notification)
- 📧 Newsletter sign-ups (saved to the database, exportable as CSV)
- 🖥 A simple admin dashboard at `/admin` to manage all of the above without touching code

---

## 1. Create your free Turso database

1. Go to [turso.tech](https://turso.tech) and sign up (free, no credit card).
2. Create a database (any name, e.g. `taste-with-nahida`).
3. Open its "Connect" tab — copy the **Database URL** (starts with `libsql://...`) and generate an **Auth Token**.

You'll paste both into `.env` in step 3 below. If you skip this step entirely, the backend automatically falls back to a local SQLite file (`local.db`) so you can still develop locally — it just won't be the persistent version yet.

## 2. Create your free Cloudinary account (for photos)

1. Go to [cloudinary.com](https://cloudinary.com) and sign up (free tier: 25GB storage).
2. On your Dashboard, copy the **Cloud name**, **API Key**, and **API Secret**.

If you skip this step, uploaded images fall back to being saved on local disk — fine for testing, but not persistent on most free hosts.

## 3. Local setup

**Requirements:** Node.js 18 or newer.

```bash
cd taste-with-nahida-backend
npm install
cp .env.example .env
```

Open `.env` and fill in:
- `JWT_SECRET` — any long random string
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — your login for `/admin`
- `ALLOWED_ORIGINS` — the URL(s) your frontend runs on
- `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` — from step 1
- `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` — from step 2

Then start the server:

```bash
npm start
```

You should see:
```
🍛 Taste with Nahida API running on http://localhost:4000
   Admin dashboard:  http://localhost:4000/admin
   Health check:     http://localhost:4000/api/health
```

Optional — load some starter content (matches what's on the current frontend):
```bash
npm run seed
```

## 4. Log in to the admin dashboard

Visit `http://localhost:4000/admin`, log in with your `ADMIN_EMAIL` / `ADMIN_PASSWORD`, and you can immediately:
- Add/edit/delete recipes, reviews, and travel posts
- Upload images (they go straight to Cloudinary if configured)
- Read contact form submissions
- View and export newsletter subscribers to CSV

## 5. Connect your frontend

Open `js/script.js` in the frontend project and set `API_BASE` near the top:

- **While developing locally:** `API_BASE = 'http://localhost:4000/api'`
- **Once deployed:** `API_BASE = 'https://your-backend-url.onrender.com/api'`

## 6. Email notifications for the contact form (optional)

The contact form works and saves messages to the database even without email configured. To also get an email when someone writes in:

1. Fill in `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `CONTACT_TO_EMAIL` in `.env`.
2. For Gmail: turn on 2-Step Verification, then create an "App Password" and use that as `SMTP_PASS`.
3. Restart the server.

## 7. Deploying for free

1. Push this folder to its own GitHub repo.
2. On [render.com](https://render.com), create a new **Web Service**, connect that repo, and set:
   - Build command: `npm install`
   - Start command: `npm start`
3. Add all the same variables from your `.env` file under Render's **Environment** tab (don't upload `.env` itself — it's gitignored).
4. Deploy. Because your data now lives in Turso and your images in Cloudinary, Render's free tier sleeping/redeploying won't wipe anything — only the server process restarts, not your content.

**Note:** Render's free web services sleep after 15 minutes of inactivity and take 30–60 seconds to wake up on the next request. That's normal and fine for a personal site; it just means the very first visitor after a quiet period waits a bit.

## 8. API reference (quick summary)

All write endpoints (`POST`/`PUT`/`DELETE`) require a header: `Authorization: Bearer <token>` from `/api/auth/login`.

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | — | Get a JWT token |
| GET | `/api/recipes` | — | List published recipes (`?category=`) |
| POST/PUT/DELETE | `/api/recipes` | ✅ | Manage recipes |
| GET | `/api/reviews` | — | List published reviews (`?country=`) |
| POST/PUT/DELETE | `/api/reviews` | ✅ | Manage reviews |
| GET | `/api/blog` | — | List published travel posts |
| POST/PUT/DELETE | `/api/blog` | ✅ | Manage travel posts |
| GET | `/api/gallery` | — | List gallery images |
| POST | `/api/uploads` | ✅ | Upload an image (`multipart/form-data`, field `image`) |
| POST | `/api/contact` | — | Submit the contact form |
| GET | `/api/contact` | ✅ | View messages |
| POST | `/api/newsletter` | — | Subscribe an email |
| GET | `/api/newsletter` | ✅ | View subscribers |
| GET | `/api/newsletter/export.csv` | ✅ | Download subscribers as CSV |

## 9. What's next (not built yet)

- Online ordering / payments
- Customer accounts
- Full-text recipe search
- Comments and star ratings from visitors

These are bigger features involving payment processors and/or user accounts — happy to help design and build any of them when you're ready.

