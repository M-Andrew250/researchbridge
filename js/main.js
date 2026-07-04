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
// Where the Express backend lives. Update this when the backend is
// deployed (Step 11) — everything else references this one constant.
window.rbcApiBaseUrl = 'http://localhost:4000';

window.rbcSupabaseReady = new Promise((resolve, reject) => {
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
  script.onload = () => {
    window.rbcSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    resolve(window.rbcSupabase);
  };
  script.onerror = () => reject(new Error('Failed to load Supabase client library.'));
  document.head.appendChild(script);
});

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



// ── SCROLLSPY SECTION INDICATOR ──
// ── SCROLLSPY SECTION INDICATOR — DESKTOP ONLY ──
if (window.innerWidth > 768) {
  const indicatorCurrent = document.getElementById('indicatorCurrent');
  const indicatorLinks = document.querySelectorAll('.indicator-nav a');

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

  if (indicatorCurrent) {
    window.addEventListener('scroll', () => {
      let current = 'overview';

      sectionIds.forEach(id => {
        const section = document.getElementById(id);
        if (section) {
          const top = section.getBoundingClientRect().top;
          if (top <= 140) {
            current = id;
          }
        }
      });

      indicatorCurrent.textContent = sectionNames[current];

      indicatorLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === '#' + current) {
          link.classList.add('active');
          link.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'center'
          });
        }
      });
    }, { passive: true });
  }
}



// ── FLOATING TOC SIDEBAR ──
const tocSidebar = document.getElementById('tocSidebar');
const tocLinks = document.querySelectorAll('.toc-link');

if (tocSidebar) {
  window.addEventListener('scroll', () => {

    // Show sidebar after scrolling past hero
    if (window.scrollY > 500) {
      tocSidebar.classList.add('visible');
    } else {
      tocSidebar.classList.remove('visible');
    }

    // Highlight active section
    let current = 'overview';
    sectionIds.forEach(id => {
      const section = document.getElementById(id);
      if (section) {
        const top = section.getBoundingClientRect().top;
        if (top <= 160) {
          current = id;
        }
      }
    });

    tocLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === '#' + current) {
        link.classList.add('active');
      }
    });

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

  // Close menu when a link is clicked
  navLinks.querySelectorAll('a').forEach(link => {
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

  if (!authLoggedOut || !authLoggedIn) return;

  const supabase = await window.rbcSupabaseReady;
  const { data: { session } } = await supabase.auth.getSession();

  const applySessionToNav = (session) => {
    if (session) {
      const fullName = session.user.user_metadata?.full_name || session.user.email;
      authLoggedOut.style.display = 'none';
      authLoggedIn.style.display = 'flex';
      if (authWelcome) authWelcome.textContent = 'Hi, ' + fullName.split(' ')[0];
    } else {
      authLoggedOut.style.display = 'flex';
      authLoggedIn.style.display = 'none';
    }
  };

  applySessionToNav(session);

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
    }
  });

  // Logout
  if (authLogout) {
    authLogout.addEventListener('click', async () => {
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
    });
  }
}

updateAuthState();



// ── SEARCH ──
const searchData = [
  // COURSES
  {
    type: 'Course', icon: '📊',
    title: 'Excel for Data & Analysis',
    desc: 'Spreadsheets, pivot tables, dashboards',
    url: 'pages/courses/excel.html'
  },
  {
    type: 'Course', icon: '🐍',
    title: 'Python for Data Science',
    desc: 'Programming, data analysis, machine learning',
    url: 'pages/courses/python.html'
  },
  {
    type: 'Course', icon: '📉',
    title: 'Stata for Econometrics',
    desc: 'Regression, panel data, policy research',
    url: 'pages/courses/stata.html'
  },
  {
    type: 'Course', icon: '🔬',
    title: 'SPSS for Statistical Analysis',
    desc: 'Survey analysis, social science research',
    url: 'pages/courses/spss.html'
  },
  {
    type: 'Course', icon: '📐',
    title: 'R for Statistical Computing',
    desc: 'Statistical modelling, ggplot2, tidyverse',
    url: 'pages/courses/r.html'
  },
  {
    type: 'Course', icon: '🗃️',
    title: 'NVivo for Qualitative Research',
    desc: 'Coding, thematic analysis, qualitative data',
    url: 'pages/courses/nvivo.html'
  },
  {
    type: 'Course', icon: '🌐',
    title: 'Power BI for Data Visualization',
    desc: 'Dashboards, DAX, business intelligence',
    url: 'pages/courses/powerbi.html'
  },
  {
    type: 'Course', icon: '📋',
    title: 'KoBoToolbox for Data Collection',
    desc: 'Survey design, field data collection',
    url: 'pages/courses/kobo.html'
  },
  // SERVICES
  {
    type: 'Service', icon: '✏️',
    title: 'Thesis Editing & Proofreading',
    desc: 'Academic editing, citations, formatting',
    url: 'pages/thesis-editing.html'
  },
  {
    type: 'Service', icon: '📊',
    title: 'Data Collection & Analysis',
    desc: 'Survey design, statistical analysis',
    url: 'pages/data-analysis.html'
  },
  {
    type: 'Service', icon: '🔬',
    title: 'Research Project Design',
    desc: 'Methodology, sampling, research framework',
    url: 'pages/research-design.html'
  },
  {
    type: 'Service', icon: '📚',
    title: 'Literature Review Support',
    desc: 'Systematic search, synthesis, citations',
    url: 'pages/literature-review.html'
  },
  {
    type: 'Service', icon: '🎓',
    title: 'Capacity Building & Training',
    desc: 'Organisational training, workshops',
    url: 'pages/capacity-building.html'
  }
];

function resolveSearchUrl(url) {
  // Get current page path
  const path = window.location.pathname;

  // Detect depth by counting folder levels
  if (path.includes('/pages/courses/')) {
    // Two levels deep — pages/courses/excel.html
    return '../../' + url;
  } else if (path.includes('/pages/')) {
    // One level deep — pages/thesis-editing.html
    return '../' + url;
  } else {
    // Root level — index.html
    return url;
  }
}

function triggerSearch() {
  const searchInput = document.getElementById('searchInput');
  const resultsEl = document.getElementById('searchResults');
  const clearBtn = document.getElementById('searchClear');

  if (!searchInput || !resultsEl) return;

  const query = searchInput.value.toLowerCase().trim();

  if (query.length === 0) {
    resultsEl.classList.remove('visible');
    if (clearBtn) clearBtn.classList.remove('visible');
    return;
  }

  if (clearBtn) clearBtn.classList.add('visible');

  const matches = searchData.filter(item =>
    item.title.toLowerCase().includes(query) ||
    item.desc.toLowerCase().includes(query) ||
    item.type.toLowerCase().includes(query)
  );

  if (matches.length === 0) {
    resultsEl.innerHTML = `
      <div class="search-no-results">
        No results for "<strong>${query}</strong>"
      </div>`;
    resultsEl.classList.add('visible');
    return;
  }

  const courses = matches.filter(m => m.type === 'Course');
  const services = matches.filter(m => m.type === 'Service');
  let html = '';

  if (courses.length > 0) {
    html += `<div class="search-result-group-title">
      Courses</div>`;
    html += courses.map(item => `
      <a href="${resolveSearchUrl(item.url)}"
         class="search-result-item">
        <div class="search-result-icon">${item.icon}</div>
        <div class="search-result-text">
          <strong>${item.title}</strong>
          <span>${item.desc}</span>
        </div>
        <span class="search-result-arrow">→</span>
      </a>
    `).join('');
  }

  if (services.length > 0) {
    html += `<div class="search-result-group-title">
      Services</div>`;
    html += services.map(item => `
      <a href="${resolveSearchUrl(item.url)}"
         class="search-result-item">
        <div class="search-result-icon">${item.icon}</div>
        <div class="search-result-text">
          <strong>${item.title}</strong>
          <span>${item.desc}</span>
        </div>
        <span class="search-result-arrow">→</span>
      </a>
    `).join('');
  }

  resultsEl.innerHTML = html;
  resultsEl.classList.add('visible');
}

// Search input listener
const searchInputEl = document.getElementById('searchInput');
if (searchInputEl) {
  searchInputEl.addEventListener('input', triggerSearch);

  // Show results when input is focused
  // and already has a value
  searchInputEl.addEventListener('focus', () => {
    if (searchInputEl.value.trim().length > 0) {
      triggerSearch();
    }
  });
}

// Clear button
const searchClearBtn = document.getElementById('searchClear');
if (searchClearBtn) {
  searchClearBtn.addEventListener('click', () => {
    const input = document.getElementById('searchInput');
    const results = document.getElementById('searchResults');
    if (input) input.value = '';
    if (results) results.classList.remove('visible');
    searchClearBtn.classList.remove('visible');
    if (input) input.focus();
  });
}

// Close results when clicking outside
document.addEventListener('click', (e) => {
  const wrap = document.querySelector('.nav-search-wrap');
  const results = document.getElementById('searchResults');
  if (wrap && results && !wrap.contains(e.target)) {
    results.classList.remove('visible');
  }
});

// Also remove old overlay search elements if present
const oldOverlay = document.getElementById('searchOverlay');
if (oldOverlay) oldOverlay.remove();
const oldNavBtn = document.getElementById('navSearchBtn');
if (oldNavBtn) oldNavBtn.remove();



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