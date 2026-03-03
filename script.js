// Lobs AI — script.js
// Scroll animations via IntersectionObserver + minor interactivity

document.addEventListener('DOMContentLoaded', () => {

  // ── Reveal on scroll ──────────────────────────────────────
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

  // ── Staggered card children ───────────────────────────────
  document.querySelectorAll('.projects-grid, .stack-grid, .journal-col').forEach(grid => {
    const children = grid.querySelectorAll('.project-card, .stack-item, .journal-item');
    children.forEach((child, i) => {
      child.classList.add('reveal');
      child.style.transitionDelay = `${i * 0.1}s`;
      observer.observe(child);
    });
  });

  // ── Nav background on scroll ──────────────────────────────
  const nav = document.querySelector('nav');
  window.addEventListener('scroll', () => {
    nav.style.background = window.scrollY > 60
      ? 'rgba(10,14,26,0.95)'
      : 'rgba(10,14,26,0.7)';
  }, { passive: true });

  // ── Smooth active nav highlighting ────────────────────────
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-links a');

  const navObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        navLinks.forEach(l => {
          l.style.color = l.getAttribute('href') === `#${e.target.id}`
            ? 'var(--teal)' : '';
        });
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px' });

  sections.forEach(s => navObserver.observe(s));

  // ── Arch diagram node pulse on hover ─────────────────────
  document.querySelectorAll('.arch-node').forEach(node => {
    node.addEventListener('mouseenter', () => {
      node.style.transform = 'scale(1.05)';
    });
    node.addEventListener('mouseleave', () => {
      node.style.transform = '';
    });
  });

});
