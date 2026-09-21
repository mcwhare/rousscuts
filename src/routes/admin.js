const express = require('express');
const router = express.Router();
const pool = require('../db');
const requireAuth = require('../middleware/requireAuth');
const { sendEmail } = require('../mailer');
const bcrypt = require('bcrypt');

function timeToInt(t) {
  return parseInt(String(t).replace(/:/g, ''), 10);
}

// ---------- login ----------

router.get('/login', (req, res) => {
  res.render('login');
});

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);

    let heading;
    let sub;
    let redirectTo = null;

    if (rows.length > 0 && rows[0].password === password) {
      req.session.isLogin = true;
      heading = 'Login details verified';
      sub = 'Redirecting to booking settings...';
      redirectTo = '/booking-settings';
    } else {
      heading = 'Invalid username or password';
      sub = 'Returning to the login page...';
      redirectTo = '/login';
    }

    res.render('login-status', { heading, sub, redirectTo });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// ---------- dashboard ----------

router.get('/booking-settings', requireAuth, (req, res) => {
  res.render('booking-settings');
});

// ---------- reviews ----------

router.get('/reviews', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, rating, review_text, created_at, approved FROM reviews ORDER BY created_at DESC',
    );
    res.render('reviews', { rows });
  } catch (err) {
    next(err);
  }
});

router.get('/edit-review', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, rating, review_text, approved FROM reviews WHERE id = ?',
      [req.query.id],
    );
    if (rows.length === 0) {
      return res.status(404).render('status', { message: 'Review not found', redirectTo: '/reviews' });
    }
    res.render('edit-review', { review: rows[0] });
  } catch (err) {
    next(err);
  }
});

router.post('/edit-review', requireAuth, async (req, res, next) => {
  try {
    const { id, name, rating, review_text, approved } = req.body;
    const parsedRating = parseInt(rating, 10);
    const trimmedName = String(name || '').trim();
    const trimmedReviewText = String(review_text || '').trim();

    if (!trimmedName || !trimmedReviewText || !Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).render('status', { message: 'Please provide a name, review, and rating from 1 to 5.', redirectTo: `/edit-review?id=${encodeURIComponent(id)}` });
    }

    await pool.query(
      'UPDATE reviews SET name = ?, rating = ?, review_text = ?, approved = ? WHERE id = ?',
      [trimmedName, parsedRating, trimmedReviewText, approved === '1' ? 1 : 0, id],
    );
    res.redirect('/reviews');
  } catch (err) {
    next(err);
  }
});

router.post('/delete-review', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.body;
    await pool.query('DELETE FROM reviews WHERE id = ?', [id]);
    res.render('status', { message: `Deleted review with id: ${id}`, redirectTo: '/reviews' });
  } catch (err) {
    next(err);
  }
});

// ---------- add availability ----------

router.get('/add-availability', requireAuth, (req, res) => {
  const msg = req.session.msg;
  delete req.session.msg;
  res.render('add-availability', { msg });
});

router.post('/add-availability', requireAuth, async (req, res, next) => {
  try {
    const { bookingDate, duration, timeStart, timeEnd } = req.body;

    if (timeToInt(timeEnd) - timeToInt(timeStart) > 0) {
      await pool.query('DELETE FROM booking_settings WHERE date = ?', [bookingDate]);
      await pool.query(
        'INSERT INTO booking_settings (date, duration, timeStart, timeEnd) VALUES (?, ?, ?, ?)',
        [bookingDate, duration, timeStart, timeEnd],
      );
      req.session.msg = 'Settings saved';
    } else {
      req.session.msg = 'ERROR: Invalid time interval';
    }
    res.redirect('/add-availability');
  } catch (err) {
    next(err);
  }
});

// ---------- edit / delete availability ----------

router.get('/edit-availability', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM booking_settings ORDER BY date');
    res.render('edit-availability', { rows });
  } catch (err) {
    next(err);
  }
});

router.get('/edit', requireAuth, (req, res) => {
  const { date } = req.query;
  res.render('edit', { date });
});

router.post('/edit', requireAuth, async (req, res, next) => {
  try {
    const { bookingDate, duration, timeStart, timeEnd } = req.body;

    if (timeToInt(timeEnd) - timeToInt(timeStart) > 0) {
      await pool.query(
        'UPDATE booking_settings SET duration = ?, timeStart = ?, timeEnd = ? WHERE date = ?',
        [duration, timeStart, timeEnd, bookingDate],
      );
      req.session.msg = 'Settings saved';
    } else {
      req.session.msg = 'ERROR: Invalid time interval';
    }
    res.redirect('/edit-availability');
  } catch (err) {
    next(err);
  }
});

router.post('/delete-availability', requireAuth, async (req, res, next) => {
  try {
    const { date } = req.body;
    await pool.query('DELETE FROM booking_settings WHERE date = ?', [date]);
    res.render('status', { message: `Deleted availability on ${date}`, redirectTo: '/edit-availability' });
  } catch (err) {
    next(err);
  }
});

// ---------- bookings ----------

router.get('/view-bookings', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, mobile, date, timeslot FROM bookings ORDER BY date DESC',
    );
    res.render('view-bookings', { rows });
  } catch (err) {
    next(err);
  }
});

router.post('/delete-booking', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.body;
    await pool.query('DELETE FROM bookings WHERE id = ?', [id]);
    res.render('status', { message: `Deleted booking with id: ${id}`, redirectTo: '/view-bookings' });
  } catch (err) {
    next(err);
  }
});

router.post('/confirm-booking', async (req, res, next) => {
    try {
        const { id, timeslot, email, name, date } = req.body;
        
        // 1. Remove "Queue " from the timeslot in the database
        await pool.query(
            'UPDATE bookings SET timeslot = ? WHERE id = ?',
            [timeslot, id]
        );
        
        // 2. Send the confirmation email to the customer
        const customerBody = `Hi ${name},<br><br>
            Great news! A spot has opened up and your waitlist request for <strong>${date} at ${timeslot}</strong> has been confirmed.<br><br>
            Here are the details you need:<br>
            Address: 5 Anthony Drive, Mount Waverley 3149<br><br>
            Cancellation Policy:<br>
            To cancel bookings, contact Jamie at 0411 504 768 or contact through Instagram, IG: @rousscuts.<br>
            Appointments cancelled with under 24 hours' notice will incur a $10 fee.<br>
            Failure to show up without notice will incur a $20 fee.<br><br>
            See you then!`;
            
        await sendEmail(email, 'Waitlist Confirmed - Rousscuts', customerBody);

        res.redirect('/view-bookings');
    } catch (err) {
        next(err);
    }
});

module.exports = router;
