const express = require('express');
const router = express.Router();
const pool = require('../db');
const requireAuth = require('../middleware/requireAuth');

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

module.exports = router;
