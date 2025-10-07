# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/763f4040-31d7-4c5a-bcc4-2a0f36e2e948

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/763f4040-31d7-4c5a-bcc4-2a0f36e2e948) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/763f4040-31d7-4c5a-bcc4-2a0f36e2e948) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## Environment configuration

Copy `apps/web/.env.sample` to `.env` (or `.env.local`) before running the web app. Set:

- `VITE_SUPABASE_URL` — your Supabase project URL.
- `VITE_SUPABASE_ANON_KEY` — the rotated anon key issued for Payslip Companion.

The anon key shipped in previous revisions has been revoked; production and preview builds must load credentials from environment variables.

## Render Deploy

**Environment**

- `PYTHON_VERSION=3.12.3`
- `SUPABASE_URL=...`
- `SUPABASE_SERVICE_ROLE_KEY=...`
- `SUPABASE_STORAGE_BUCKET=payslips`
- `REDIS_URL=rediss://default:<token>@<host>:6379`
- `INTERNAL_TOKEN=<long random string>`
- `OPENAI_API_KEY=<optional, no trailing dot>`
- `LOG_LEVEL=INFO`

**Build Command (API & Worker services)**

```
pip install --upgrade pip && pip install --prefer-binary -r requirements.txt -c ../constraints.txt
```

**Start Command**

- Web: `uvicorn apps.api.main:app --host 0.0.0.0 --port 8000`
- Worker: `celery -A apps.worker.celery_app worker --loglevel=INFO --concurrency=2`

**Health**

- `/healthz` must return `{"supabase":"ok","redis":"ok"}`.

**Troubleshooting**

- If builds mention maturin/Cargo/Pillow sdist, confirm Python 3.12.3 is selected and that `--prefer-binary` with `-c ../constraints.txt` is applied.
- Ensure `httpx==0.25.2` stays aligned with `supabase==2.3.4` so the resolver never pulls incompatible transports.

## CI safety checks

Run `npm run ci:verify` locally (and in CI) to confirm `AUDIT.md` remains GREEN and to block hard-coded Supabase URLs or anon keys from landing in the repository. The script chains the audit guard and the Supabase secret scan so deploys fail fast when compliance drifts.
