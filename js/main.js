// Lobs AI — script.js (v3 — premium redesign)
'use strict';

document.addEventListener('DOMContentLoaded', () => {

  // ── Theme toggle ──────────────────────────────────────────
  const html = document.documentElement;
  const themeBtn = document.getElementById('themeToggle');
  const saved = 'dark'; localStorage.removeItem('theme');
  html.setAttribute('data-theme', saved);

  themeBtn.addEventListener('click', () => {
    const current = html.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  });

  // ── Mobile menu ───────────────────────────────────────────
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobileMenu');
  const mobileMenuClose = document.getElementById('mobileMenuClose');
  const mobileMenuBackdrop = document.getElementById('mobileMenuBackdrop');

  function openMenu() {
    mobileMenu.classList.add('open');
    mobileMenuBackdrop.classList.add('open');
    hamburger.classList.add('open');
    hamburger.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }
  function closeMenu() {
    mobileMenu.classList.remove('open');
    mobileMenuBackdrop.classList.remove('open');
    hamburger.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }
  hamburger.addEventListener('click', openMenu);
  mobileMenuClose.addEventListener('click', closeMenu);
  mobileMenuBackdrop.addEventListener('click', closeMenu);
  mobileMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));

  // ── Typing effect ─────────────────────────────────────────
  const phrases = [
    'A multi-agent workforce that works while you sleep.',
    'Orchestrating specialized agents for code, research, and writing.',
    '6 versions. 6 agents. 19 workflows. 24/7.',
    'Built by one grad student. Runs like a team of ten.',
    'From task framework to plugin — 6 versions in 3 months.',
  ];
  const typingEl = document.getElementById('typing-text');
  if (typingEl) {
    let phraseIdx = 0, charIdx = 0, deleting = false;
    const TYPE_SPEED = 45, DELETE_SPEED = 22, PAUSE_MS = 2200;

    function typeStep() {
      const current = phrases[phraseIdx];
      if (!deleting) {
        charIdx++;
        typingEl.textContent = current.slice(0, charIdx);
        if (charIdx === current.length) {
          deleting = true;
          setTimeout(typeStep, PAUSE_MS);
          return;
        }
      } else {
        charIdx--;
        typingEl.textContent = current.slice(0, charIdx);
        if (charIdx === 0) {
          deleting = false;
          phraseIdx = (phraseIdx + 1) % phrases.length;
        }
      }
      setTimeout(typeStep, deleting ? DELETE_SPEED : TYPE_SPEED);
    }
    setTimeout(typeStep, 1200);
  }

  // ── IntersectionObserver for reveal + counters ─────────────
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        revealObs.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

  // Auto-stagger cards
  document.querySelectorAll('.projects-grid, .stack-grid').forEach(grid => {
    grid.querySelectorAll('.project-card, .stack-item').forEach((child, i) => {
      if (!child.classList.contains('reveal')) {
        child.classList.add('reveal');
        child.style.transitionDelay = `${i * 0.08}s`;
        revealObs.observe(child);
      }
    });
  });

  // ── Animated counters ─────────────────────────────────────
  function animateCounter(el, target, suffix = '', duration = 1600) {
    const start = performance.now();
    function step(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(eased * target);
      el.textContent = value.toLocaleString() + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  const counterObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const el = e.target;
        const target = parseInt(el.dataset.target, 10);
        const suffix = el.dataset.suffix || '';
        animateCounter(el, target, suffix);
        counterObs.unobserve(el);
      }
    });
  }, { threshold: 0.3 });

  document.querySelectorAll('.counter, .hero-stat-num[data-target]').forEach(el => {
    counterObs.observe(el);
  });

  // ── Side TOC active dot ───────────────────────────────────
  const tocDots = document.querySelectorAll('.toc-dot');
  const allSections = document.querySelectorAll('section[id]');

  const tocObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        tocDots.forEach(d => d.classList.remove('active'));
        const dot = document.querySelector(`.toc-dot[data-section="${e.target.id}"]`);
        if (dot) dot.classList.add('active');
      }
    });
  }, { rootMargin: '-30% 0px -60% 0px' });

  allSections.forEach(s => tocObs.observe(s));

  // ── Nav active links + bg on scroll ───────────────────────
  const topnav = document.querySelector('.topnav');
  const navLinks = document.querySelectorAll('.nav-links a');

  const navObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        navLinks.forEach(l => {
          l.classList.toggle('active', l.getAttribute('href') === `#${e.target.id}`);
        });
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px' });

  allSections.forEach(s => navObs.observe(s));

  window.addEventListener('scroll', () => {
    const scrolled = window.scrollY > 60;
    topnav.style.background = scrolled
      ? (html.dataset.theme === 'light' ? 'rgba(248,250,252,0.98)' : 'rgba(8,12,24,0.98)')
      : '';
  }, { passive: true });

  // ── Project card expand/collapse ──────────────────────────
  document.querySelectorAll('.project-card').forEach(card => {
    const btn = card.querySelector('.card-expand-btn');
    if (!btn) return;

    card.addEventListener('click', (e) => {
      const isExpanded = card.dataset.expanded === 'true';
      // collapse all others
      document.querySelectorAll('.project-card[data-expanded="true"]').forEach(other => {
        if (other !== card) other.dataset.expanded = 'false';
      });
      card.dataset.expanded = isExpanded ? 'false' : 'true';
    });
  });

  // ── Arch node hover pulse ─────────────────────────────────
  document.querySelectorAll('.arch-node, .paw-component').forEach(node => {
    node.addEventListener('mouseenter', () => node.style.zIndex = '2');
    node.addEventListener('mouseleave', () => node.style.zIndex = '');
  });

  // ── Parallax on hero orbs ─────────────────────────────────
  const orbs = document.querySelectorAll('.orb');
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    orbs.forEach((orb, i) => {
      const speed = [0.08, 0.12, 0.06][i] || 0.08;
      orb.style.transform = `translateY(${y * speed}px)`;
    });
  }, { passive: true });

  // ── Smooth scroll for anchor links ────────────────────────
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      const offset = 80; // nav height
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });

});
