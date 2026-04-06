# Happy Hour App — Setup Guide
### From zero to live in ~30 minutes. No coding required.

---

## What you're setting up

| Piece | What it does | Cost |
|-------|-------------|------|
| **Supabase** | Stores your deals in a database | Free |
| **GitHub** | Holds your app code in the cloud | Free |
| **Vercel** | Puts your app on the internet | Free |

---

## PART 1 — Set up your database (Supabase)

### Step 1: Create a Supabase account
1. Go to **supabase.com**
2. Click **Start your project**
3. Sign up with GitHub or Google (either works)

### Step 2: Create a new project
1. Click **New project**
2. Fill in:
   - **Name:** happyhour (or anything you like)
   - **Database Password:** choose something strong, save it somewhere safe
   - **Region:** pick the one closest to you (US East or US West)
3. Click **Create new project** — wait about 60 seconds for it to spin up

### Step 3: Create the deals table
1. In the left sidebar, click **SQL Editor**
2. Click **New query**
3. Paste this entire block and click **Run**:

```sql
create table deals (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now(),
  bar text not null,
  neighborhood text,
  type text check (type in ('drink', 'food', 'both')),
  specials text,
  start_time time,
  end_time time,
  days text[]
);

alter table deals enable row level security;

create policy "Anyone can read deals"
  on deals for select using (true);

create policy "Anyone can insert deals"
  on deals for insert with check (true);

create policy "Anyone can delete deals"
  on deals for delete using (true);
```

You should see **Success. No rows returned.** — that means it worked.

### Step 4: Get your API keys
1. In the left sidebar, click **Settings** (gear icon at the bottom)
2. Click **API**
3. You'll see two values — keep this tab open, you'll need them soon:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **anon public** key — a long string of letters and numbers

---

## PART 2 — Put your code on GitHub

### Step 5: Create a GitHub account
1. Go to **github.com** and sign up for a free account if you don't have one

### Step 6: Create a new repository
1. Click the **+** in the top right → **New repository**
2. Name it `happyhour`
3. Leave everything else as default
4. Click **Create repository**

### Step 7: Upload your app files
1. On the repository page, click **uploading an existing file**
2. Drag and drop the entire `happyhour` folder contents (all the files inside it — not the folder itself)
3. Scroll down and click **Commit changes**

---

## PART 3 — Deploy on Vercel

### Step 8: Create a Vercel account
1. Go to **vercel.com**
2. Click **Sign Up** → choose **Continue with GitHub**
3. Authorize Vercel to access your GitHub

### Step 9: Import your project
1. On the Vercel dashboard, click **Add New → Project**
2. Find your `happyhour` repository and click **Import**
3. Leave all settings as default — Vercel will auto-detect it's a React app
4. **Don't click Deploy yet** — you need to add your Supabase keys first

### Step 10: Add your Supabase keys to Vercel
This is the "linking" step — you're telling Vercel where your database is.

1. On the configuration screen, find **Environment Variables**
2. Add the first variable:
   - **Name:** `REACT_APP_SUPABASE_URL`
   - **Value:** paste your Project URL from Supabase (Step 4)
   - Click **Add**
3. Add the second variable:
   - **Name:** `REACT_APP_SUPABASE_ANON_KEY`
   - **Value:** paste your anon public key from Supabase (Step 4)
   - Click **Add**
4. Now click **Deploy**

Wait about 60 seconds. Vercel will build your app and give you a live URL like:
**`https://happyhour-yourname.vercel.app`**

---

## You're live!

Open that URL and your app is on the internet. Any deals you add will be saved to your Supabase database permanently. Share the link with friends and they can add deals too.

---

## Troubleshooting

**"Could not connect to database" error**
→ Your Supabase keys are wrong or missing. Go to Vercel → Your Project → Settings → Environment Variables and double-check both values. Redeploy after fixing.

**App loads but deals don't save**
→ The SQL from Step 3 may not have run correctly. Go back to Supabase SQL Editor and run it again.

**I want a custom domain (like happyhourcinci.com)**
→ Buy a domain from Namecheap or Google Domains (~$12/year), then in Vercel go to your project → Settings → Domains and add it. Vercel walks you through the rest.

---

## What's next

When you're ready to grow the app, ask Claude to add:
- **User accounts** — so friends log in and deals are tied to who added them
- **Business portal** — a separate login for bar owners to manage their own listings
- **Map view** — see deals plotted on a Cincinnati map
- **"Open now" filter** — show only deals happening at the current time
