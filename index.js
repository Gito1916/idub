// Event Timings
const tmStart = new Date('March 25, 2026 12:00:00').getTime();
const tmEnd = new Date('March 25, 2026 19:00:00').getTime();
const mbStart = new Date('March 29, 2026 10:00:00').getTime();
const mbEnd = new Date('March 29, 2026 14:00:00').getTime();
const recStart = new Date('March 29, 2026 15:00:00').getTime();
const recEnd = new Date('March 29, 2026 20:00:00').getTime();

const events = [
  { id: 'tm', shortLocation: 'Diko CSS, Edem Idim, Ikono-Ini' },
  { id: 'mb', shortLocation: 'BCS Nyok Esu Bethel, Calabar' },
  { id: 'rec', shortLocation: 'Event 45, Calabar' }
];

let hasAnimatedProgress = false;

function updateWeddingTracker(now) {
  let progress = 0;
  let enrouteText = '';

  // Evaluate states
  const getEventState = (start, end) => {
    if (now < start) return 'upcoming';
    if (now > end) return 'completed';
    return 'live';
  };

  const tmState = getEventState(tmStart, tmEnd);
  const mbState = getEventState(mbStart, mbEnd);
  const recState = getEventState(recStart, recEnd);

  // Set classes & badge text
  const applyState = (id, state, upcomingText = 'Upcoming') => {
    const el = document.getElementById('step-' + id);
    if (!el) return;
    el.classList.remove('upcoming', 'live', 'completed');
    el.classList.add(state);
    const badge = el.querySelector('.badge');
    if (state === 'completed') badge.innerText = 'Completed';
    else if (state === 'live') badge.innerText = 'Live Now';
    else badge.innerText = upcomingText;
  };

  applyState('tm', tmState, 'Up Next');
  applyState('mb', mbState, 'Upcoming');
  applyState('rec', recState, 'Upcoming');

  // Determine progress and enroute text
  // enrouteText is only set between events, never during live or after all done
  if (tmState === 'upcoming') {
    progress = 12;
    enrouteText = `Enroute to ${events[0].shortLocation}`;
  } else if (tmState === 'live') {
    progress = 0;
    enrouteText = '';
  } else if (tmState === 'completed' && mbState === 'upcoming') {
    progress = 25;
    enrouteText = `Enroute to ${events[1].shortLocation}`;
  } else if (mbState === 'live') {
    progress = 50;
    enrouteText = '';
  } else if (mbState === 'completed' && recState === 'upcoming') {
    progress = 75;
    enrouteText = `Enroute to ${events[2].shortLocation}`;
  } else if (recState === 'live') {
    progress = 100;
    enrouteText = '';
  } else if (recState === 'completed') {
    progress = 100;
    enrouteText = '';
  }

  // Apply to DOM
  const fillEl = document.getElementById('trackerFill');
  const enrouteEl = document.getElementById('trackerEnroute');

  if (fillEl) {
    if (!hasAnimatedProgress) {
      // Start from 0 then animate to target so both desktop + mobile see the fill
      fillEl.style.setProperty('--progress', '0%');
      if (enrouteEl) {
        enrouteEl.style.setProperty('--progress', '0%');
      }
      setTimeout(() => {
        fillEl.style.setProperty('--progress', `${progress}%`);
        if (enrouteEl) {
          if (enrouteText) {
            enrouteEl.innerText = enrouteText;
            enrouteEl.style.setProperty('--progress', `${progress}%`);
            enrouteEl.classList.add('visible');
          } else {
            enrouteEl.classList.remove('visible');
            enrouteEl.innerText = '';
          }
        }
      }, 700);
      hasAnimatedProgress = true;
    } else {
      fillEl.style.setProperty('--progress', `${progress}%`);
      if (enrouteEl) {
        if (enrouteText) {
          enrouteEl.innerText = enrouteText;
          enrouteEl.style.setProperty('--progress', `${progress}%`);
          enrouteEl.classList.add('visible');
        } else {
          enrouteEl.classList.remove('visible');
          enrouteEl.innerText = '';
        }
      }
    }
  }
}

function updateCountdown() {
  const now = new Date().getTime();
  const distance = tmStart - now;

  const countdownEl = document.getElementById('countdown');

  if (distance <= 0) {
    if (countdownEl) countdownEl.style.display = 'none';
  } else {
    if (countdownEl) countdownEl.style.display = 'inline-flex';
    // Pre-event countdown logic
    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    const elDays = document.getElementById('cd-days');
    const elHours = document.getElementById('cd-hours');
    const elMinutes = document.getElementById('cd-minutes');
    const elSeconds = document.getElementById('cd-seconds');

    if (elDays) elDays.innerText = days.toString().padStart(2, '0');
    if (elHours) elHours.innerText = hours.toString().padStart(2, '0');
    if (elMinutes) elMinutes.innerText = minutes.toString().padStart(2, '0');
    if (elSeconds) elSeconds.innerText = seconds.toString().padStart(2, '0');
  }

  updateWeddingTracker(now);
}

setInterval(updateCountdown, 1000);
updateCountdown();

// RSVP Form Logic
document.getElementById('rsvpForm').addEventListener('submit', function (event) {
  event.preventDefault();

  const button = this.querySelector('button[type="submit"]');
  const message = document.getElementById('formMessage');

  button.innerText = 'Forwarding...';
  button.disabled = true;

  setTimeout(() => {
    const fullName = document.getElementById('fullName').value;
    const attendance = document.getElementById('attendance').value;
    const guests = document.getElementById('guests').value;
    const note = document.getElementById('message').value;

    let waText = '*Wedding RSVP*\\n';
    waText += `*Name:* ${fullName}\\n`;
    waText += `*Attending:* ${attendance === 'yes' ? 'Joyfully Accept' : 'Regretfully Decline'}\\n`;
    waText += `*Guests:* ${guests}\\n`;
    if (note) {
      waText += `*Message:* ${note}`;
    }

    const waUrl = `https://wa.me/2348068940721?text=${encodeURIComponent(waText)}`;
    window.open(waUrl, '_blank');

    this.reset();
    button.innerText = 'Send RSVP';
    button.disabled = false;

    message.hidden = false;
    message.innerHTML = 'Opening WhatsApp to send your RSVP...';
    message.style.color = 'var(--navy)';
  }, 300);
});

// Story Frame Scroll Fade
const storyFrames = document.querySelectorAll('.story-frame');
window.addEventListener('scroll', () => {
  const viewportHeight = window.innerHeight;
  const fadeStart = viewportHeight * 0.85;
  const fadeEnd = viewportHeight * 0.25;

  storyFrames.forEach((frame, index) => {
    if (index === storyFrames.length - 1) {
      return;
    }

    const nextFrame = storyFrames[index + 1];
    const nextRect = nextFrame.getBoundingClientRect();

    if (nextRect.top > fadeStart) {
      frame.style.opacity = 1;
    } else if (nextRect.top < fadeEnd) {
      frame.style.opacity = 0;
    } else {
      const progress = (nextRect.top - fadeEnd) / (fadeStart - fadeEnd);
      frame.style.opacity = progress.toFixed(3);
    }
  });
});

window.dispatchEvent(new Event('scroll'));

// Site Loader Reveal
window.addEventListener('load', () => {
  setTimeout(() => {
    document.body.classList.add('site-loaded');
    setTimeout(() => {
      document.getElementById('loader').style.display = 'none';
    }, 800);
  }, 500);
});
