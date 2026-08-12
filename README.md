# Office system — trial build

A single-page office and field app. The application lives at [`app/`](app/);
the page at the root only redirects there.

**This repository contains the application only — no customer data.**
Any names, addresses and phone numbers in it are invented for testing.
Signing in is required for all data; the data itself lives in a separate
database protected by row-level security, never in this repository.

- **Never commit a backup, an export, or a customer list here.**
- On an iPad: open the published page in Safari, then **Share → Add to Home
  Screen** for an icon that opens full-screen.
