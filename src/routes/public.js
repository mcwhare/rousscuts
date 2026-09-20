const express = require('express');
const router = express.Router();
const pool = require('../db');
const { sendEmail } = require('../mailer');
const { timeslots } = require('../utils/timeslots');

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];
const DAY_LETTERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function pad2(n) {
  return n.toString().padStart(2, '0');
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Stored slot value looks like "09:00AM - 09:30AM" (24h hour + AM/PM, a
// quirk inherited from the original PHP formatting, kept so existing rows
// in `bookings` still match). The leading two digits are the true 24-hour
// hour, which is all we need for grouping and for a nicer display label.
function parseSlotStart(value) {
  const startPart = value.split(' - ')[0];
  return {
    hour24: parseInt(startPart.slice(0, 2), 10),
    minute: parseInt(startPart.slice(3, 5), 10),
  };
}

function displayLabel(hour24, minute) {
  const period = hour24 >= 12 ? 'pm' : 'am';
  let h12 = hour24 % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${pad2(minute)} ${period}`;
}

function bucketFor(hour24) {
  if (hour24 < 12) return 'morning';
  if (hour24 < 17) return 'afternoon';
  return 'evening';
}

function formatLongDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return `${WEEKDAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}

function melbourneTimezoneAbbrev() {
  try {
    const parts = new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Melbourne',
      timeZoneName: 'short',
    }).formatToParts(new Date());
    const tz = parts.find((p) => p.type === 'timeZoneName');
    return tz ? tz.value : 'AEST';
  } catch (err) {
    return 'AEST';
  }
}

/** All slots for one day, each annotated with display label, time-of-day bucket, and booked state. */
async function getDaySlots(dateStr) {
  const [settingsRows] = await pool.query('SELECT * FROM booking_settings WHERE date = ?', [dateStr]);
  const settings = settingsRows[0] || null;
  if (!settings) return { settings: null, slots: [] };

  const [bookingRows] = await pool.query('SELECT timeslot FROM bookings WHERE date = ?', [dateStr]);
  const bookedSet = new Set(bookingRows.map((r) => r.timeslot));

  const rawSlots = timeslots(settings.duration, 0, settings.timeStart, settings.timeEnd, dateStr);
  const slots = rawSlots.map((value) => {
    const { hour24, minute } = parseSlotStart(value);
    return {
      value,
      label: displayLabel(hour24, minute),
      bucket: bucketFor(hour24),
      booked: bookedSet.has(value),
    };
  });
  return { settings, slots };
}

/** Bookable-day set for a whole month, in two range queries instead of one per day. */
async function getMonthAvailability(month, year) {
  const monthStart = `${year}-${pad2(month)}-01`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${pad2(month)}-${pad2(daysInMonth)}`;

  const [settingsRows] = await pool.query(
    'SELECT * FROM booking_settings WHERE date BETWEEN ? AND ?',
    [monthStart, monthEnd],
  );
  const [bookingRows] = await pool.query(
    'SELECT date, timeslot FROM bookings WHERE date BETWEEN ? AND ?',
    [monthStart, monthEnd],
  );

  const bookedByDate = new Map();
  bookingRows.forEach((row) => {
    if (!bookedByDate.has(row.date)) bookedByDate.set(row.date, new Set());
    bookedByDate.get(row.date).add(row.timeslot);
  });

  const bookableDates = new Set();
  settingsRows.forEach((settings) => {
    const rawSlots = timeslots(settings.duration, 0, settings.timeStart, settings.timeEnd, settings.date);

    // CHANGE HERE: If there are ANY slots generated for the day, make it clickable, 
    // regardless of whether they are booked or not.
    if (rawSlots.length > 0) bookableDates.add(settings.date);
  });

  return bookableDates;
}

/** First date (>= fromDate) with at least one open slot, or null. */
async function nextAvailableDate(fromDate) {
  const [rows] = await pool.query(
    'SELECT date FROM booking_settings WHERE date >= ? ORDER BY date',
    [fromDate],
  );
  for (const row of rows) {
    const { slots } = await getDaySlots(row.date);
    if (slots.some((s) => !s.booked)) return row.date;
  }
  return null;
}

function buildCalendarGrid(month, year, selectedDate, bookableDates) {
  const firstOfMonth = new Date(year, month - 1, 1);
  const numDays = new Date(year, month, 0).getDate();
  const startWeekday = firstOfMonth.getDay();
  const today = todayStr();

  let prevMonth = month - 1;
  let prevYear = year;
  if (prevMonth < 1) { prevMonth = 12; prevYear -= 1; }
  let nextMonth = month + 1;
  let nextYear = year;
  if (nextMonth > 12) { nextMonth = 1; nextYear += 1; }

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push({ empty: true });

  for (let day = 1; day <= numDays; day++) {
    const dateStr = `${year}-${pad2(month)}-${pad2(day)}`;
    const bookable = dateStr >= today && bookableDates.has(dateStr);
    cells.push({
      empty: false,
      day,
      dateStr,
      bookable,
      isToday: dateStr === today,
      isSelected: dateStr === selectedDate,
    });
  }
  while (cells.length % 7 !== 0) cells.push({ empty: true });

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return {
    month,
    monthName: MONTH_NAMES[month - 1],
    year,
    dayLetters: DAY_LETTERS,
    weeks,
    prevMonth,
    prevYear,
    nextMonth,
    nextYear,
  };
}

async function buildSlotsView(dateStr) {
  const { slots } = await getDaySlots(dateStr);
  const hasOpenSlot = slots.some((s) => !s.booked);
  let nextAvailable = null;
  if (!hasOpenSlot) {
    nextAvailable = await nextAvailableDate(dateStr >= todayStr() ? dateStr : todayStr());
  }
  return {
    date: dateStr,
    dateLabel: formatLongDate(dateStr),
    isToday: dateStr === todayStr(),
    slots,
    hasOpenSlot,
    nextAvailable,
    nextAvailableLabel: nextAvailable ? formatLongDate(nextAvailable) : null,
    nextAvailableMonth: nextAvailable ? parseInt(nextAvailable.slice(5, 7), 10) : null,
    nextAvailableYear: nextAvailable ? parseInt(nextAvailable.slice(0, 4), 10) : null,
  };
}

// ---------- full page ----------

router.get('/', async (req, res, next) => {
  try {
    const now = new Date();
    const date = req.query.date || todayStr();
    const month = parseInt(req.query.month, 10) || parseInt(date.slice(5, 7), 10) || now.getMonth() + 1;
    const year = parseInt(req.query.year, 10) || parseInt(date.slice(0, 4), 10) || now.getFullYear();

    const bookableDates = await getMonthAvailability(month, year);
    const calendar = buildCalendarGrid(month, year, date, bookableDates);
    const slotsView = await buildSlotsView(date);

    // Fetch reviews from the database
    const [reviews] = await pool.query('SELECT * FROM reviews WHERE approved = 1 ORDER BY created_at DESC');
    const totalReviews = reviews.length;
    const avgRating = totalReviews > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1)
      : '0.0';

    const msg = req.session.msg;
    const reviewMsg = req.session.reviewMsg;
    delete req.session.msg;
    delete req.session.reviewMsg;

    res.render('index', {
      calendar,
      timezone: melbourneTimezoneAbbrev(),
      msg,
      reviewMsg,
      reviews,       // This sends the reviews array to EJS
      totalReviews,  // This sends the total count
      avgRating,     // This sends the average rating
      ...slotsView,
    });
  } catch (err) {
    next(err);
  }
});

// Old URL, kept working for anything that still links to it.
router.get('/1k', (req, res) => {
  const qs = new URLSearchParams(req.query).toString();
  res.redirect(`/${qs ? `?${qs}` : ''}`);
});

// ---------- AJAX fragments (no full page reload) ----------

router.get('/partials/calendar-grid', async (req, res, next) => {
  try {
    const month = parseInt(req.query.month, 10);
    const year = parseInt(req.query.year, 10);
    const selected = req.query.date || '';

    const bookableDates = await getMonthAvailability(month, year);
    const calendar = buildCalendarGrid(month, year, selected, bookableDates);

    res.render('partials/calendar-grid-inner', { calendar }, (err, html) => {
      if (err) return next(err);
      res.json({
        html,
        monthName: calendar.monthName,
        year: calendar.year,
        prevMonth: calendar.prevMonth,
        prevYear: calendar.prevYear,
        nextMonth: calendar.nextMonth,
        nextYear: calendar.nextYear,
      });
    });
  } catch (err) {
    next(err);
  }
});

router.get('/partials/slots', async (req, res, next) => {
  try {
    const date = req.query.date;
    if (!date) return res.status(400).json({ error: 'date is required' });

    const slotsView = await buildSlotsView(date);
    res.render('partials/slots-section-inner', { msg: null, ...slotsView }, (err, html) => {
      if (err) return next(err);
      res.json({
        html,
        date: slotsView.date,
        month: parseInt(date.slice(5, 7), 10),
        year: parseInt(date.slice(0, 4), 10),
      });
    });
  } catch (err) {
    next(err);
  }
});

// ---------- reviews ----------

router.post('/review', async (req, res, next) => {
  try {
    const { name, rating, review_text } = req.body;

    await pool.query(
      'INSERT INTO reviews (name, rating, review_text) VALUES (?, ?, ?)',
      [name, parseInt(rating, 10), review_text]
    );

    req.session.reviewMsg = { type: 'success', text: 'Thank you for your review!' };
    res.redirect('/');
  } catch (err) {
    console.error(err);
    req.session.reviewMsg = { type: 'error', text: 'Failed to submit review.' };
    res.redirect('/');
  }
});

// ---------- booking submission ----------

router.post('/book', async (req, res, next) => {
  try {
    const { date } = req.query;
    const { name, email, mobile, timeslot, type } = req.body;

    let isConflict = false;

    // Skip the double-booking check if they are joining the queue
    if (!timeslot.startsWith('Queue')) {
      const [existing] = await pool.query(
        'SELECT id FROM bookings WHERE date = ? AND timeslot = ?',
        [date, timeslot],
      );
      if (existing.length > 0) isConflict = true;
    }

    if (isConflict) {
      req.session.msg = { type: 'error', text: 'Already booked' };
    } else {
      // Insert the booking (the timeslot will literally be saved as "Queue")
      await pool.query(
        'INSERT INTO bookings (name, email, mobile, date, timeslot) VALUES (?, ?, ?, ?, ?)',
        [name, email, mobile, date, timeslot],
      );

      if (timeslot.startsWith('Queue')) {
        req.session.msg = { type: 'success', text: 'You have been added to the waitlist!' };

        const ownerBody = `A customer has joined the waitlist:<br><br>
          Name: ${name}<br>Mobile: ${mobile}<br>Email: ${email}<br>Type: ${type}<br><br>
          Date: ${date}<br>Slot: ${timeslot}`;
        await sendEmail(process.env.OWNER_EMAIL, 'New Waitlist Entry', ownerBody);

        const customerBody = `Hi ${name},<br><br>
          You've been added to the waitlist for ${date}.<br>
          If a spot opens up, Jamie will contact you at ${mobile}.<br><br>
          Thanks!`;
        await sendEmail(email, 'Waitlist Confirmation', customerBody);

      } else {
        req.session.msg = { type: 'success', text: 'Booking Successful' };

        const ownerBody = `A booking has been made under: <br><br>
          Name: ${name}<br>Mobile: ${mobile}<br>Email: ${email}<br>Type of cut: ${type}<br><br>
          For the following time: <br>${date}<br>${timeslot}`;
        await sendEmail(process.env.OWNER_EMAIL, 'Booking made', ownerBody);

        const customerBody = `Dear ${name}<br>
          A booking has been made for ${timeslot}, ${date}<br><br>
          Here are the details you need: <br>
          Address: 5 Anthony Drive Mount Waverley 3149 <br><br>
          Cancellation Policy: <br>
          To cancel bookings, contact Jamie at 0411504768 or contact through instagram, IG: @rousscuts.
          Appointments cancelled in under 24 hour notice will incur a $10 fee.
          Failure to show up without notice will incur a $20 fee.<br><br>
          Please let me know if you have any questions.<br><br>
          See you then!`;
        await sendEmail(email, 'Booking Confirmed', customerBody);
      }
    }

    res.redirect(`/?date=${encodeURIComponent(date)}`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
