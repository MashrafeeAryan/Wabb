# Wabb 🍓

A strawberry-themed habit calendar with private accounts and cross-device syncing.

## Features

- Monthly calendar with pink day circles and green completed days
- Recurring daily habits and separate per-day additions, edits, and removals
- Email/password accounts through Supabase Authentication
- Private saved progress synced between phone and laptop when signed in
- Guest mode saved locally to this browser
- Optional first-login import of existing habits saved on the device
- Automatic cloud updates and periodic refresh while signed in

## Hosting

The static website is published through GitHub Actions on GitHub Pages:
https://mashrafeearyan.github.io/Wabb/

The backend is a managed Supabase project named **Wabb**. Its `public.habit_states` table uses row-level security so every signed-in user can access only their own row. The website contains **only the public Supabase publishable key**, never a database password or service-role key.

## One-time Supabase authentication setting

To ensure that new-account confirmation emails return to Wabb, configure this in the Supabase dashboard for project **Wabb**:

**Authentication → URL Configuration**
- **Site URL:** `https://mashrafeearyan.github.io/Wabb/`
- **Redirect URLs:** add `https://mashrafeearyan.github.io/Wabb/`

This is a Supabase Auth setting, **not** a database operation. The connected integration currently cannot change Auth URL Configuration.

Email/password sign-up may require email confirmation before first sign-in. Supabase's built-in email delivery has rate limits; production-scale public sign-ups may need a custom SMTP provider.

## Using Wabb

1. Open the website and select **Sign in / Sign up**.
2. Create an account with an email and password; confirm the email if prompted.
3. Sign in using the same account on your phone and laptop.
4. Your recurring habits, day-specific edits and checkmarks are saved to your account.

If your browser already has old Wabb habits, the first login to a *new, empty* Wabb cloud account offers to import them. Import only habits that belong to you. An existing account's cloud data is loaded rather than overwritten by this device's guest data.

When signed out, Wabb stays usable in local guest mode, but guest changes don't sync. Cloud saving requires a connection; the account bar indicates pending sync.

## Development

Wabb is plain HTML, CSS, and JavaScript. There is no local build step. To run locally, serve the directory with `python3 -m http.server 8000` (email confirmation redirects require an allowlisted local URL if testing sign-up locally).

- `index.html`: calendar, editors, and account interface
- `styles.css`: strawberry-themed design
- `app.js`: habits, account management, and Supabase sync
- `.github/workflows/deploy.yml`: GitHub Pages deployment
