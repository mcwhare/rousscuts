(function () {
  var calendarGrid = document.getElementById('calendarGrid');
  var timesPanel = document.getElementById('timesPanel');
  var monthLabel = document.getElementById('calendarMonthLabel');
  var prevBtn = document.getElementById('prevMonthBtn');
  var nextBtn = document.getElementById('nextMonthBtn');
  var collapseToggle = document.getElementById('collapseToggle');
  var bookingForm = document.getElementById('bookingForm');

  if (!calendarGrid || !timesPanel) return; // not on the booking page

  var state = {
    month: parseInt(calendarGrid.dataset.month, 10),
    year: parseInt(calendarGrid.dataset.year, 10),
    selectedDate: calendarGrid.dataset.selectedDate,
    collapsed: false,
  };

  function setFormDate(dateStr) {
    if (bookingForm) {
      bookingForm.action = '/book?date=' + encodeURIComponent(dateStr);
    }
  }

  function loadCalendar(month, year, selectedDate) {
    var url = '/partials/calendar-grid?month=' + month + '&year=' + year +
      (selectedDate ? '&date=' + encodeURIComponent(selectedDate) : '');
    return fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        calendarGrid.innerHTML = data.html;
        calendarGrid.classList.toggle('collapsed', state.collapsed);
        monthLabel.textContent = data.monthName + ' ' + data.year;
        prevBtn.dataset.month = data.prevMonth;
        prevBtn.dataset.year = data.prevYear;
        nextBtn.dataset.month = data.nextMonth;
        nextBtn.dataset.year = data.nextYear;
        state.month = month;
        state.year = year;
      });
  }

  function loadSlots(dateStr) {
    return fetch('/partials/slots?date=' + encodeURIComponent(dateStr))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        timesPanel.innerHTML = data.html;
        state.selectedDate = dateStr;
        setFormDate(dateStr);
      });
  }

  function selectDate(dateStr, month, year) {
    var needsCalendarReload = month !== state.month || year !== state.year;
    var work = needsCalendarReload
      ? loadCalendar(month, year, dateStr)
      : Promise.resolve().then(function () {
          calendarGrid.querySelectorAll('.day-cell.selected').forEach(function (el) {
            el.classList.remove('selected');
          });
          var target = calendarGrid.querySelector('[data-date="' + dateStr + '"]');
          if (target) target.classList.add('selected');
        });

    work.then(function () { return loadSlots(dateStr); })
      .then(function () {
        var url = new URL(window.location.href);
        url.searchParams.set('date', dateStr);
        window.history.pushState({}, '', url);
      })
      .catch(function (err) { console.error('Booking page update failed:', err); });
  }

  // Delegate day-cell clicks (works after innerHTML swaps too)
  calendarGrid.addEventListener('click', function (e) {
    var link = e.target.closest('.day-cell.bookable');
    if (!link) return;
    e.preventDefault();
    var dateStr = link.dataset.date;
    var month = parseInt(dateStr.slice(5, 7), 10);
    var year = parseInt(dateStr.slice(0, 4), 10);
    selectDate(dateStr, month, year);
  });

  // Month navigation
  [prevBtn, nextBtn].forEach(function (btn) {
    if (!btn) return;
    btn.addEventListener('click', function () {
      var month = parseInt(btn.dataset.month, 10);
      var year = parseInt(btn.dataset.year, 10);
      loadCalendar(month, year, null).catch(function (err) {
        console.error('Month navigation failed:', err);
      });
    });
  });

  // "Go to next available" — delegate since it lives inside the swapped fragment
  timesPanel.addEventListener('click', function (e) {
    var link = e.target.closest('.btn-next-available');
    if (!link) return;
    e.preventDefault();
    var dateStr = link.dataset.date;
    var month = parseInt(link.dataset.month, 10);
    var year = parseInt(link.dataset.year, 10);
    selectDate(dateStr, month, year);
  });

  // Timeslot pick -> prefill and open the modal (delegated, fragment gets replaced)
  timesPanel.addEventListener('click', function (e) {
    var pill = e.target.closest('.time-pill');
    if (!pill) return;

    var timeslot = pill.getAttribute('data-timeslot');
    var label = pill.getAttribute('data-label');

    // If the slot is booked, turn this into a queue request
    if (pill.classList.contains('booked')) {
        timeslot = 'Queue ' + timeslot;
        label = 'Waitlist for ' + label;
    }

    document.getElementById('timeslot').value = timeslot;
    document.getElementById('modalSelectedTime').textContent = label;
    
    // Force the modal to open in case the booked pill isn't a standard link
    window.location.hash = '#openModal';
  });

  if (collapseToggle) {
    collapseToggle.addEventListener('click', function () {
      state.collapsed = calendarGrid.classList.toggle('collapsed');
      collapseToggle.classList.toggle('flipped', state.collapsed);
    });
  }

  window.validateForm = function () {
    var form = document.querySelector('.modalContent form');
    if (!form.checkValidity()) {
      form.reportValidity();
      return false;
    }
    window.location.hash = '#close';
    return true;
  };

  // Back/forward browser navigation
  window.addEventListener('popstate', function () {
    var url = new URL(window.location.href);
    var dateStr = url.searchParams.get('date');
    if (dateStr) {
      var month = parseInt(dateStr.slice(5, 7), 10);
      var year = parseInt(dateStr.slice(0, 4), 10);
      selectDate(dateStr, month, year);
    }
  });
})();
