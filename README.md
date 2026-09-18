# Rousscuts booking system — Node.js

A full Express port of the PHP app: customer calendar/booking flow, admin
login, availability management, and the bookings list. Same MySQL database
and tables as before — nothing on the data side changes.

## What's here

```
server.js                 entry point
src/db.js                 MySQL connection pool (mysql2)
src/mailer.js             Nodemailer (replaces PHPMailer)
src/utils/timeslots.js    port of the PHP timeslots() generator
src/middleware/requireAuth.js
src/routes/public.js      /calendar (single-page booking flow), /book (POST),
                           plus /partials/calendar-grid and /partials/slots
                           (JSON+HTML fragments the booking page fetches)
src/routes/admin.js       /login, /booking-settings, /add-availability,
                           /edit-availability, /edit, /view-bookings,
                           /delete-availability, /delete-booking
views/                    EJS templates (one per page), plus views/partials/
                           for the shared head/topbar and the two fragments
public/                   same CSS/JS design system as the redesign, plus
                           index.html (served statically at "/") and
                           js/booking.js (the calendar/slot interaction)
schema-reference.sql      documents the expected table shapes — reference
                           only, don't run it against your live data
```

## The booking page

`/calendar` is now one page: a month calendar and the selected day's time
slots, grouped into Morning/Afternoon/Evening. Clicking a day or a month
arrow doesn't reload the page — `public/js/booking.js` fetches
`/partials/calendar-grid` or `/partials/slots` (each returns rendered HTML
plus a bit of JSON) and swaps the relevant section in place. Selecting a date
updates the URL via `history.pushState` so the page is still linkable and the
back/forward buttons work.

If a day has no open slots, it shows "No availability until \<date\>" with a
button that jumps straight to the next open day — also without a reload.

Booking submission itself is still a normal form POST (redirects back to
`/calendar?date=...` with a success/error message) — only the *browsing*
part of the flow is AJAX-driven.

## Setup

1. `npm install`
2. `cp .env.example .env` and fill in your real DB and SMTP credentials —
   the same ones the PHP app used. Nothing is hardcoded in the source this
   time, which also fixes the "password committed to a PHP file" issue from
   before.
3. Drop your actual site images (`Rousscuts_logo.png`, `pfp.png`,
   `instalogo.png`) into `public/images/`.
4. `npm start` — runs on `PORT` from `.env` (default 3000). Your hosting
   provider's Node.js setup will tell you how it expects the app to bind
   (usually just respecting `process.env.PORT`, which this already does).

## Behavioral notes / what's identical to the PHP version

- Same routes' worth of functionality: calendar → book → email confirmation;
  admin login → add/edit/delete availability → view/delete bookings.
- Booking conflict check, timeslot generation, and cancellation-policy email
  copy are unchanged.
- `users.password` is still compared as plaintext (`===`), matching the
  original — if you ever change how passwords are stored, this line in
  `src/routes/admin.js` needs to move to `bcrypt.compare()`.

## What's better, incidentally

- No secrets in source control — everything sensitive lives in `.env`
  (gitignored).
- HTML output in the bookings table is escaped by default (EJS's `<%= %>`),
  same protection as the old `htmlspecialchars()` calls.
- Sessions expire automatically after 4 hours instead of persisting
  indefinitely.

## Still worth doing at some point

- Session store: this uses `express-session`'s default in-memory store,
  which is fine for a single-process app but forgets everyone's login if
  the process restarts. If your host runs multiple instances or restarts
  often, look at `connect-mysql-session` (keeps sessions in the same DB).
- CSRF protection: the delete/edit forms only check that you're logged in,
  same as before — no CSRF token. Low risk for a single-admin site, but
  worth adding (`csurf` or similar) if that ever changes.
