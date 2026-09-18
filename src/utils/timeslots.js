function pad(n) {
  return n.toString().padStart(2, '0');
}

function formatSlot(date) {
  const hours24 = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours24 >= 12 ? 'PM' : 'AM';
  // Matches the old PHP format("H:iA") exactly — 24h hour + AM/PM, so
  // existing stored timeslot strings ("14:00PM") still compare correctly.
  return `${pad(hours24)}:${pad(minutes)}${ampm}`;
}

/**
 * Generate timeslots for a given day.
 * @param {number} duration length of each slot in minutes
 * @param {number} cleanup gap added after each slot in minutes
 * @param {string} start "HH:MM:SS" start time
 * @param {string} end "HH:MM:SS" end time
 * @param {string} dateStr "YYYY-MM-DD" anchor date for the time math
 */
function timeslots(duration, cleanup, start, end, dateStr) {
  const slots = [];
  if (!duration || !start || !end) return slots;

  let cursor = new Date(`${dateStr}T${start}`);
  const endTime = new Date(`${dateStr}T${end}`);
  const durationMs = Number(duration) * 60000;
  const cleanupMs = Number(cleanup || 0) * 60000;

  while (cursor < endTime) {
    const periodEnd = new Date(cursor.getTime() + durationMs);
    if (periodEnd > endTime) break;
    slots.push(`${formatSlot(cursor)} - ${formatSlot(periodEnd)}`);
    cursor = new Date(cursor.getTime() + durationMs + cleanupMs);
  }
  return slots;
}

module.exports = { timeslots };
