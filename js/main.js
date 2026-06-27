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