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
  });
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
  });
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

    // Update label text
    indicatorCurrent.textContent = sectionNames[current];

    // Update active nav link
    indicatorLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === '#' + current) {
        link.classList.add('active');
        // Scroll the active link into view within the nav bar
        link.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    });
  });
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

  });
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


