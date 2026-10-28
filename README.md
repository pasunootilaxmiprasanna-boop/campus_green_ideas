# Campus Green Ideas Board

A beginner-friendly, full-stack campus sustainability idea board. Students can suggest improvements, browse and filter ideas, vote, and comment. An administrator can update the progress status of ideas.

## 1. Problem and objectives

Campus sustainability improvements often begin as informal suggestions and are easy to lose track of. This application gives students one shared place to post ideas about recycling, energy, water, green spaces, and transport. Its objectives are to encourage participation, make popular suggestions visible, and show whether an idea is submitted, under review, planned, in progress, implemented, or declined.

## 2. Users and features

- **Visitor:** browse, search, filter, sort, and view public ideas.
- **Student account:** register/sign in, post an idea, vote or remove a vote, comment, view their own ideas, and delete their own ideas.
- **Administrator:** all student capabilities plus changing idea status and deleting any idea.
- Dashboard statistics: ideas shared, community votes, and implemented ideas.
- Input validation, escaped user content, API rate limits, security headers, and database constraints.

## 3. Technology and architecture

- HTML5, CSS3, Vanilla JavaScript
- Node.js and Express.js
- Supabase Auth for identity and Supabase PostgreSQL for persistent application data
- Git and GitHub for version control

The browser calls `/api/...` using `fetch()`. Express validates input and verifies the Supabase access token. The backend uses a server-only service-role key for database operations and enforces ownership and administrator permissions. PostgreSQL Row Level Security (RLS) is enabled with no direct public table policies; application data access goes through the backend.

## 4. Folder structure

```text
campus-green-ideas-board/
├── frontend/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── backend/
│   ├── server.js
│   ├── supabase.js
│   ├── routes/
│   │   ├── auth.js
│   │   └── ideas.js
│   ├── middleware/
│   │   └── auth.js
│   ├── package.json
│   ├── .env
│   ├── .env.example
│   └── .gitignore
├── database/
│   └── schema.sql
├── .gitignore
└── README.md
```

`package-lock.json` is generated locally by `npm install`; commit it for reproducible installs. Do not commit `.env` or credentials.

## 5. Prerequisites

Install:
- [Visual Studio Code](https://code.visualstudio.com/)
- [Node.js LTS](https://nodejs.org/)
- [Git](https://git-scm.com/)
- A free [Supabase](https://supabase.com/) account

In a new terminal, check `node --version`, `npm --version`, and `git --version`. Use Node.js 20 or newer.

## 6. Setup

### A. Create a Supabase project
1. Sign in to Supabase and create a new project.
2. Save the database password somewhere private; this app does not need that password directly.
3. Open **Project Settings → API** (the exact label can vary by dashboard version).
4. Copy the Project URL, publishable/anon key, and service-role/secret key. The service-role key is privileged and must remain on the server.

### B. Create the database tables
1. In Supabase, open **SQL Editor → New query**.
2. Paste the complete contents of `database/schema.sql`.
3. Run the script.
4. Open **Table Editor** and verify `profiles`, `ideas`, `votes`, and `comments` exist. Check that `ideas` includes title, description, category, status, user_id, created_at, and updated_at.

### C. Configure the backend
Open a terminal in the `backend` directory. Copy the template:
- Windows PowerShell: `Copy-Item .env.example .env`
- Windows Command Prompt: `copy .env.example .env`
- macOS/Linux: `cp .env.example .env`

Edit `backend/.env` and replace all three Supabase placeholders:
- `SUPABASE_URL`: Project URL
- `SUPABASE_ANON_KEY`: publishable/anon key used only for Auth sign-in/up
- `SUPABASE_SERVICE_ROLE_KEY`: privileged server-only key; never put it in frontend files or GitHub
- `PORT`: local server port, default 3000
- `NODE_ENV`: local environment label

The sample values do not connect to a database. Do not commit `.env`.

### D. Install and start
From the project root:

```bash
cd backend
npm install
npm run check
npm start
```

Open `http://localhost:3000`. The health endpoint is `http://localhost:3000/api/health` and should return JSON with `"status":"ok"`. Stop the server with Ctrl+C.

For development with Node's file watcher, run `npm run dev`.

## 7. Configure the administrator

1. In Supabase, open **Authentication → Users** and create a user with email `mrec@gmail.com`. Use the requested demo password `MREC@123` only for a private classroom demo, and change it to a strong unique password before deployment. If the dashboard requires email confirmation, confirm the account or configure confirmation settings for your demo.
2. After that account exists, open SQL Editor and run:

```sql
update public.profiles p
set role = 'admin'
from auth.users u
where p.id = u.id and lower(u.email) = lower('mrec@gmail.com');
```

3. Confirm one row was updated. Sign out and sign in again so the app loads the new role.
4. Never hard-code admin credentials in source files or publish them in a public repository. Any public demo should use a unique password and rotate it if exposed.

## 8. API reference

All responses are JSON. Protected routes require `Authorization: Bearer <Supabase access token>`. IDs are UUIDs.

| Method | Path | Purpose | Access |
|---|---|---|---|
| GET | `/api/health` | Health check | Public |
| POST | `/api/auth/signup` | Create account; body `{ "email", "password", "display_name" }` | Public |
| POST | `/api/auth/signin` | Sign in; body `{ "email", "password" }` | Public |
| GET | `/api/auth/me` | Current user profile | Signed in |
| GET | `/api/ideas` | List ideas; optional `search`, `category`, `status`, `sort=newest|votes`, `mine=true` | Public; `mine=true` requires sign-in |
| GET | `/api/ideas/stats` | Board counts | Public |
| POST | `/api/ideas` | Create idea; body `{ "title", "description", "category" }` | Signed in |
| GET | `/api/ideas/:id` | Idea details and comments | Public |
| POST | `/api/ideas/:id/vote` | Toggle current user's vote | Signed in |
| POST | `/api/ideas/:id/comments` | Add comment; body `{ "body" }` | Signed in |
| PATCH | `/api/ideas/:id/status` | Update status; body `{ "status" }` | Admin |
| DELETE | `/api/ideas/:id` | Delete own idea or any idea as admin | Owner or admin |

Common errors: `400` invalid input, `401` missing/invalid session, `403` insufficient permission, `404` missing record/route, and `500` server/database failure. API rate limits return `429`.

## 9. Use the app

1. Browse ideas and try the search, category, status, and sort filters.
2. Create an account using Sign in → Create an account. Email confirmation may be required by your Supabase Auth settings.
3. Sign in, choose **Share an idea**, complete the form, and post.
4. Click the heart to vote. Click Comments to open details and add a comment.
5. Open **My ideas** to view your posts. Delete your own idea from its detail view.
6. Sign in as the configured administrator to see the Admin tab. Open an idea, change its status, and save.

## 10. Testing checklist

- `GET /api/health` returns status `ok`.
- Signup with valid details creates a Supabase Auth user and profile; short passwords or invalid email are rejected.
- Sign in with correct credentials returns a session; incorrect credentials return 401.
- Visitors can browse but cannot post, vote, or comment.
- A student can create an idea with valid fields; invalid title/description/category is rejected.
- Search, category/status filters, newest/most-supported sort, and My ideas work.
- A student can vote and click again to remove the vote; the database unique constraint prevents duplicate votes.
- A student can comment; too-short or too-long comments are rejected.
- A student cannot change status or delete another student's idea.
- An admin can update statuses and delete ideas.
- Deleting an idea also deletes its votes and comments through foreign-key cascades.
- Refresh the page and confirm data remains in Supabase.
- Test mobile layout at a narrow browser width.
- Check that `.env` and service-role key are absent from Git status before pushing.

## 11. Troubleshooting

- **Missing environment variable:** confirm `backend/.env` exists and variable names match `.env.example`; restart the server after editing.
- **Invalid API key / fetch errors:** verify the project URL and keys belong to the same Supabase project.
- **Database relation does not exist:** run `database/schema.sql` in the correct project's SQL Editor.
- **Profile missing:** check that the `on_auth_user_created` trigger exists and the user was created after running the schema. For an older user, create their profile safely using SQL after checking their auth user ID.
- **Signup asks for email confirmation:** confirm the account through the email or adjust Supabase Auth confirmation settings for a local demonstration.
- **Admin tab missing:** run the role-update SQL after creating the admin user, then sign out and sign back in.
- **Port in use:** set another `PORT` value in `.env` and open the corresponding localhost port.
- **Cannot install dependencies:** verify internet connection and Node.js/npm versions; run `npm install` from `backend`.
- **401:** sign in again; sessions can expire.
- **500:** inspect the server terminal for a diagnostic message. Do not paste secret values into public chats or issue trackers.

## 12. Security and limitations

The service-role key bypasses RLS, so the backend must remain the only holder of that key and must enforce authentication, ownership, and roles. Never expose it in browser JavaScript. Keep dependencies updated and use HTTPS if deploying. For production, consider stricter email confirmation, CAPTCHA, audit logs, and monitoring. This MVP does not include image uploads, notifications, email delivery, or editing an idea after submission. Search uses a simple database text match and is suitable for a small student project.

## 13. GitHub upload

From the project root, make sure `.env` is excluded and no secret is staged:

```bash
git init
git status
git add .
git status
git commit -m "Build Campus Green Ideas Board"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

Create an empty repository on GitHub first, then replace `YOUR_GITHUB_REPOSITORY_URL` with its actual URL. Do not commit real credentials. `.gitignore` does not remove secrets already committed; if a key is exposed, rotate it immediately and clean repository history as needed.
