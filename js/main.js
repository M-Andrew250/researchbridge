// ── SUPABASE CLIENT ──
// Loaded here (rather than a separate file) so every page that
// already includes main.js gets it for free, with no relative-path
// juggling across the site's different folder depths.
//
// The anon key below is safe to be public — it's the key Supabase
// expects embedded in frontend code; access is controlled by Row
// Level Security on the database side, not by keeping this secret.
// (The service_role key used by the Express backend lives only in
// server/.env and is never sent to the browser.)
const SUPABASE_URL = 'https://ztrokpqlinqezmnicrpi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0cm9rcHFsaW5xZXptbmljcnBpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwNjYzNDEsImV4cCI6MjA5ODY0MjM0MX0.Tkd234JkFGvdIQFIsj1DjLJxEj6oVyi5mJZTORbvFl0';

// ── API BASE URL ──
// Where the Express backend lives. Auto-detects local dev vs the
// deployed Render backend so the same file works in both places
// without manual edits — everything else references this one constant.
window.rbcApiBaseUrl = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  ? 'http://localhost:4000'
  : 'https://api.researchbridgeconsulting.com';

// ── AUTH SESSION STORAGE ("Remember Me") ──
// Supabase persists the session (access + refresh token) in whatever
// storage we hand it. To support a "Remember me" checkbox on the login
// page, this adapter picks the backend at read/write time based on a
// flag: unchecked -> sessionStorage (wiped when the browser closes),
// checked (or not set yet, e.g. an already-logged-in visitor before this
// feature existed) -> localStorage (survives closing the browser).
const RBC_REMEMBER_KEY = 'rbc-remember-me';
const RBC_AUTH_TOKEN_KEY = 'sb-ztrokpqlinqezmnicrpi-auth-token';

function rbcPreferredStorage() {
  return localStorage.getItem(RBC_REMEMBER_KEY) === 'false' ? window.sessionStorage : window.localStorage;
}

// Called by the login page right before signing in, based on the
// "Remember me" checkbox. Also clears any leftover session from the
// other storage so a prior login's tokens can't linger and conflict.
window.rbcSetRememberMe = function (remember) {
  localStorage.setItem(RBC_REMEMBER_KEY, remember ? 'true' : 'false');
  (remember ? window.sessionStorage : window.localStorage).removeItem(RBC_AUTH_TOKEN_KEY);
};

const rbcAuthStorage = {
  getItem: (key) => rbcPreferredStorage().getItem(key),
  setItem: (key, value) => rbcPreferredStorage().setItem(key, value),
  removeItem: (key) => rbcPreferredStorage().removeItem(key),
};

window.rbcSupabaseReady = new Promise((resolve, reject) => {
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
  script.onload = () => {
    window.rbcSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { storage: rbcAuthStorage },
    });
    resolve(window.rbcSupabase);
  };
  script.onerror = () => reject(new Error('Failed to load Supabase client library.'));
  document.head.appendChild(script);
});

// ── DARK MODE TOGGLE ──
// The initial theme (read from localStorage) is already applied by a
// blocking inline script in <head>, before this file even loads, so
// there's no flash of the wrong theme. This just wires up the click.
const themeToggle = document.getElementById('themeToggle');
if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('rbc-theme', 'light');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('rbc-theme', 'dark');
    }
  });
}


// ── FOOTER COPYRIGHT YEAR ──
// Every footer's "&copy; <year>" uses <span id="copyrightYear">
// instead of a hardcoded year, so it never goes stale again.
document.querySelectorAll('#copyrightYear').forEach(el => {
  el.textContent = new Date().getFullYear();
});


// ── SCROLL REVEAL ──

console.log('JS file loaded successfully!');
const revealElements = document.querySelectorAll('.reveal');

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.15 });

revealElements.forEach(el => observer.observe(el));


// ── ACCORDION ──
document.querySelectorAll('.module-header').forEach(header => {
  header.addEventListener('click', () => {
    const lessons = header.nextElementSibling;
    header.classList.toggle('open');
    lessons.classList.toggle('open');
  });
});


// ── SCROLL PROGRESS BAR ──
const progressBar = document.getElementById('progressBar');
if (progressBar) {
  window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = (scrollTop / docHeight) * 100;
    progressBar.style.width = progress + '%';
  }, { passive: true });
}


// ── STICKY ENROL BUTTON ──
const stickyEnrol = document.getElementById('stickyEnrol');
if (stickyEnrol) {
  window.addEventListener('scroll', () => {
    if (window.scrollY > 400) {
      stickyEnrol.classList.add('visible');
    } else {
      stickyEnrol.classList.remove('visible');
    }
  }, { passive: true });
}


// ── FAQ ACCORDION ──
document.querySelectorAll('.faq-question').forEach(question => {
  question.addEventListener('click', () => {
    const answer = question.nextElementSibling;
    question.classList.toggle('open');
    answer.classList.toggle('open');
  });
});



// ── SCROLLSPY (section indicator pill + floating TOC sidebar) ──
// These used to be two separate scroll listeners, each re-reading
// getBoundingClientRect() for every section on every single scroll
// event — duplicated work, and enough forced layout thrashing to
// visibly jank/"shake" while scrolling course pages. Merged into one
// computation, throttled to run at most once per animation frame, and
// only calls scrollIntoView() when the active section actually
// changes (previously it fired on every tick, fighting the user's own
// scroll gesture).
const indicatorCurrent = document.getElementById('indicatorCurrent');
const indicatorLinks = document.querySelectorAll('.indicator-nav a');
const tocSidebar = document.getElementById('tocSidebar');
const tocLinks = document.querySelectorAll('.toc-link');

const sectionIds = [
  'overview', 'instructor', 'outcomes', 'applications',
  'outline', 'video', 'testimonials', 'faq', 'pricing', 'enrol'
];

const sectionNames = {
  overview:      'Overview',
  instructor:    'Instructor',
  outcomes:      'Learning Outcomes',
  applications:  'Real Life Applications',
  outline:       'Course Outline',
  video:         'Video Tutorial',
  testimonials:  'Testimonials',
  faq:           'FAQ',
  pricing:       'Pricing',
  enrol:         'Enrol Now'
};

if (indicatorCurrent || tocSidebar) {
  let lastSection = null;
  let scrollspyScheduled = false;

  const updateScrollspy = () => {
    scrollspyScheduled = false;

    let current = 'overview';
    sectionIds.forEach(id => {
      const section = document.getElementById(id);
      if (section && section.getBoundingClientRect().top <= 150) {
        current = id;
      }
    });

    if (indicatorCurrent && window.innerWidth > 768) {
      indicatorCurrent.textContent = sectionNames[current];
      indicatorLinks.forEach(link => {
        const isActive = link.getAttribute('href') === '#' + current;
        link.classList.toggle('active', isActive);
        if (isActive && current !== lastSection) {
          link.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      });
    }

    if (tocSidebar) {
      tocSidebar.classList.toggle('visible', window.scrollY > 500);
      tocLinks.forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === '#' + current);
      });
    }

    lastSection = current;
  };

  window.addEventListener('scroll', () => {
    if (!scrollspyScheduled) {
      scrollspyScheduled = true;
      requestAnimationFrame(updateScrollspy);
    }
  }, { passive: true });
}



// ── HERO VIDEO FADE IN ──
const heroVideo = document.getElementById('heroVideo');
if (heroVideo) {
  heroVideo.addEventListener('canplay', () => {
    heroVideo.classList.add('loaded');
  });

  // Fallback — show video after 2s even if canplay is slow
  setTimeout(() => {
    if (heroVideo) {
      heroVideo.classList.add('loaded');
    }
  }, 2000);
}




// ── SUMMARY BANNER MOBILE TOGGLE ──
if (window.innerWidth <= 768) {
  document.querySelectorAll('.summary-item').forEach(item => {
    item.addEventListener('click', () => {
      const isOpen = item.classList.contains('mobile-open');
      // Close all
      document.querySelectorAll('.summary-item').forEach(i => {
        i.classList.remove('mobile-open');
      });
      // Open clicked if it was closed
      if (!isOpen) {
        item.classList.add('mobile-open');
      }
    });
  });
}



// ── HAMBURGER MENU ──
const navHamburger = document.getElementById('navHamburger');
const navLinks = document.getElementById('navLinks');

if (navHamburger && navLinks) {
  navHamburger.addEventListener('click', () => {
    navHamburger.classList.toggle('open');
    navLinks.classList.toggle('open');
  });

  // Close menu when a real link is clicked — but not a dropdown
  // trigger, which only toggles its own submenu (see the
  // .nav-dropdown-trigger handler below) and shouldn't collapse
  // the whole panel out from under it.
  navLinks.querySelectorAll('a:not(.nav-dropdown-trigger)').forEach(link => {
    link.addEventListener('click', () => {
      navHamburger.classList.remove('open');
      navLinks.classList.remove('open');
    });
  });
}



// ── PAUSE VIDEO ON SCROLL FOR PERFORMANCE ──
if (heroVideo) {
  let scrollTimer = null;

  window.addEventListener('scroll', () => {
    if (!heroVideo.paused) {
      heroVideo.pause();
    }
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      heroVideo.play().catch(() => {});
    }, 150);
  }, { passive: true });
}



// ── HIDE FIXED BUTTONS WHILE SCROLLING ON MOBILE ──
if (window.innerWidth <= 768) {
  const fixedButtons = document.querySelectorAll(
    '.whatsapp-btn, .sticky-enrol'
  );
  let scrollEndTimer = null;

  window.addEventListener('scroll', () => {
    fixedButtons.forEach(btn => btn.classList.add('scrolling'));
    clearTimeout(scrollEndTimer);
    scrollEndTimer = setTimeout(() => {
      fixedButtons.forEach(btn => btn.classList.remove('scrolling'));
    }, 200);
  }, { passive: true });
}



// ── ANNOUNCEMENT BAR DISMISS ──
const announcementBar = document.getElementById('announcementBar');
const announcementClose = document.getElementById('announcementClose');

if (announcementClose && announcementBar) {
  // Check if already dismissed
  if (localStorage.getItem('announcementDismissed') === 'true') {
    announcementBar.classList.add('hidden');
  }

  announcementClose.addEventListener('click', () => {
    announcementBar.classList.add('hidden');
    localStorage.setItem('announcementDismissed', 'true');
  });
}



// ── NAV DROPDOWN MOBILE TOGGLE ──
if (window.innerWidth <= 768) {
  document.querySelectorAll('.nav-dropdown-item').forEach(item => {
    const trigger = item.querySelector('.nav-dropdown-trigger');
    if (trigger) {
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        const isOpen = item.classList.contains('mobile-open');
        // Close all dropdowns
        document.querySelectorAll('.nav-dropdown-item').forEach(i => {
          i.classList.remove('mobile-open');
        });
        // Open clicked if it was closed
        if (!isOpen) {
          item.classList.add('mobile-open');
        }
      });
    }
  });
}



// ── AUTH STATE CHECK ──
// Runs on every page to update navbar, driven by the real Supabase
// Auth session rather than a localStorage flag.
async function updateAuthState() {
  const authLoggedOut = document.getElementById('authLoggedOut');
  const authLoggedIn = document.getElementById('authLoggedIn');
  const authWelcome = document.getElementById('authWelcome');
  const authLogout = document.getElementById('authLogout');
  const accountTrigger = document.getElementById('accountTrigger');

  // Mobile hamburger-menu counterparts — .nav-auth is hidden below
  // 480px with no other way to reach Login/Sign Up/Dashboard/Log Out,
  // so these mirror the same state inside the mobile #navLinks panel.
  const mobileAuthLoggedOut = document.querySelector('.nav-mobile-auth-loggedout');
  const mobileAuthLoggedIn = document.querySelector('.nav-mobile-auth-loggedin');
  const mobileLogout = document.querySelector('.nav-mobile-logout');

  if (!authLoggedOut || !authLoggedIn) return;

  const supabase = await window.rbcSupabaseReady;
  const { data: { session } } = await supabase.auth.getSession();

  const applySessionToNav = (session) => {
    if (session) {
      authLoggedOut.style.display = 'none';
      authLoggedIn.style.display = 'flex';
      if (mobileAuthLoggedOut) mobileAuthLoggedOut.style.display = 'none';
      if (mobileAuthLoggedIn) mobileAuthLoggedIn.style.display = 'flex';
      const fullName = session.user.user_metadata?.full_name || session.user.email;
      const nameParts = fullName.trim().split(/\s+/);
      const lastName = nameParts[nameParts.length - 1];
      if (authWelcome) authWelcome.textContent = 'Logged in as ' + lastName;
    } else {
      authLoggedOut.style.display = 'flex';
      authLoggedIn.style.display = 'none';
      authLoggedIn.classList.remove('open');
      if (mobileAuthLoggedOut) mobileAuthLoggedOut.style.display = 'flex';
      if (mobileAuthLoggedIn) mobileAuthLoggedIn.style.display = 'none';
    }
  };

  applySessionToNav(session);

  // Account dropdown: opens on hover (CSS, matching the Services/Courses
  // nav dropdowns) and also toggles on click for keyboard/touch users
  // who can't hover, with a click-outside to close it again.
  if (accountTrigger) {
    accountTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      authLoggedIn.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
      if (!authLoggedIn.contains(e.target)) {
        authLoggedIn.classList.remove('open');
      }
    });
  }

  // Keep the navbar in sync if auth state changes on this page
  // (e.g. token refresh, or signed out in another tab).
  supabase.auth.onAuthStateChange((event, session) => {
    applySessionToNav(session);

    // SIGNED_IN fires once for an actual new sign-in — either a
    // password login, or landing here via an email confirmation
    // link (supabase-js auto-detects the session from the URL). It
    // does NOT fire when a page load merely restores an existing
    // session, so this can't spam the welcome email on navigation.
    if (event === 'SIGNED_IN' && session) {
      fetch(`${window.rbcApiBaseUrl}/api/notifications/welcome`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).catch(() => {});

      // Link any in-person applications submitted as a guest (before
      // this account existed) to this account now, by matching email.
      fetch(`${window.rbcApiBaseUrl}/api/enrolments/claim`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).catch(() => {});
    }
  });

  // Logout — shared by the desktop account dropdown and the mobile
  // hamburger-menu counterpart, both wired to the same handler.
  const handleLogoutClick = async (e) => {
    e.preventDefault();
    if (!confirm('Are you sure you want to log out?')) return;

    // Check for incomplete online courses and send an encouragement
    // email before actually signing out — best-effort, don't let a
    // slow/failed request delay logging out. Re-fetch the session
    // here rather than reusing the one from page load, since the
    // access token may have refreshed since then.
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession) {
        await fetch(`${window.rbcApiBaseUrl}/api/notifications/check-progress`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${currentSession.access_token}` },
        });
      }
    } catch (err) {}

    await supabase.auth.signOut();
    window.location.reload();
  };

  if (authLogout) authLogout.addEventListener('click', handleLogoutClick);
  if (mobileLogout) mobileLogout.addEventListener('click', handleLogoutClick);
}

updateAuthState();



// ── COOKIE CONSENT ──
function initCookieBanner() {
  const cookieBanner = document.getElementById('cookieBanner');
  const cookieAccept = document.getElementById('cookieAccept');
  const cookieDecline = document.getElementById('cookieDecline');

  if (!cookieBanner) return;

  const cookieChoice = localStorage.getItem('rbcCookieConsent');

  if (cookieChoice) {
    // Already made a choice — hide immediately
    cookieBanner.style.display = 'none';
    return;
  }

  // Show after delay
  setTimeout(() => {
    cookieBanner.classList.add('visible');
  }, 1500);

  function dismissBanner(choice) {
    localStorage.setItem('rbcCookieConsent', choice);
    // Slide down
    cookieBanner.classList.remove('visible');
    // Remove from DOM after animation completes
    setTimeout(() => {
      cookieBanner.style.display = 'none';
    }, 500);
  }

  if (cookieAccept) {
    cookieAccept.addEventListener('click', () => {
      dismissBanner('accepted');
    });
  }

  if (cookieDecline) {
    cookieDecline.addEventListener('click', () => {
      dismissBanner('declined');
    });
  }
}

initCookieBanner();





// ── BACK TO TOP ──
const backToTop = document.getElementById('backToTop');

if (backToTop) {
  // Show/hide on scroll
  window.addEventListener('scroll', () => {
    if (window.scrollY > 400) {
      backToTop.classList.add('visible');
    } else {
      backToTop.classList.remove('visible');
    }
  }, { passive: true });

  // Scroll to top on click
  backToTop.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
}