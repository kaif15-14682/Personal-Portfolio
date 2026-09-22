(() => {
  const root = document.documentElement;
  root.classList.add('js');
  const themeToggle = document.querySelector('.theme-toggle');
  const savedTheme = localStorage.getItem('portfolio-theme');
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  const setTheme = theme => { root.dataset.theme = theme; themeToggle.setAttribute('aria-pressed', theme === 'light'); themeToggle.querySelector('span').textContent = theme === 'light' ? '◑' : '◐'; };
  setTheme(savedTheme || (prefersLight ? 'light' : 'dark'));
  themeToggle.addEventListener('click', () => { const next = root.dataset.theme === 'light' ? 'dark' : 'light'; setTheme(next); localStorage.setItem('portfolio-theme', next); });

  document.querySelectorAll('[data-glow]').forEach(card => card.addEventListener('pointermove', event => { const box = card.getBoundingClientRect(); card.style.setProperty('--x', `${event.clientX - box.left}px`); card.style.setProperty('--y', `${event.clientY - box.top}px`); }));

  const navLinks = [...document.querySelectorAll('.main-nav a')];
  const sections = navLinks.map(link => document.querySelector(link.getAttribute('href'))).filter(Boolean);
  const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) navLinks.forEach(link => link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`)); }), { rootMargin: '-35% 0px -55% 0px' });
  sections.forEach(section => observer.observe(section));

  const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    }
  }), { threshold: 0.12 });
  document.querySelectorAll('.project-card, .timeline article, .skills-grid article, .education-card, .repository-section').forEach(item => revealObserver.observe(item));

  const topButton = document.querySelector('.back-to-top');
  window.addEventListener('scroll', () => topButton.classList.toggle('visible', window.scrollY > 700), { passive: true });
  topButton.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  document.getElementById('year').textContent = new Date().getFullYear();
})();
