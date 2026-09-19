-- Reference only. This documents the table shapes the old PHP app already
-- queried against (bookings, booking_settings, users) so you can confirm
-- your existing tables match. Do NOT run this against your live database —
-- it's here so you (or I) can sanity-check column names/types, not to
-- recreate tables that already hold real bookings.

CREATE TABLE IF NOT EXISTS booking_settings (
  date DATE NOT NULL PRIMARY KEY,
  duration INT NOT NULL,
  timeStart TIME NOT NULL,
  timeEnd TIME NOT NULL
);

CREATE TABLE IF NOT EXISTS bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  mobile VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  timeslot VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  username VARCHAR(255) NOT NULL PRIMARY KEY,
  password VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  approved BOOLEAN DEFAULT 1
);