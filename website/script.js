/* Eco Player website — interaction scripts */

document.addEventListener('DOMContentLoaded', () => {
  // Smooth reveal for feature cards on scroll (Intersection Observer fallback)
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.animationPlayState = 'running';
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );

  document.querySelectorAll('[data-animate]').forEach((el) => {
    observer.observe(el);
  });

  // External links open with a small visual hint (cursor already indicates)
  document.querySelectorAll('a[target="_blank"]').forEach((el) => {
    el.setAttribute('rel', 'noopener noreferrer');
  });
});
