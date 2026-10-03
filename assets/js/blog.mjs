// The article remains readable without this progressive enhancement.
const toc = document.querySelector('.article-toc');
if (toc) {
  const wide = matchMedia('(min-width: 801px)');
  const setOpen = () => { toc.open = wide.matches; };
  setOpen();
  wide.addEventListener('change', setOpen);
  const links = [...toc.querySelectorAll('a[href^="#"]')];
  const sections = links.map(link => document.getElementById(link.hash.slice(1))).filter(Boolean);
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting);
      if (!visible.length) return;
      const id = visible[0].target.id;
      links.forEach(link => {
        const active = link.hash === `#${id}`;
        link.classList.toggle('is-current', active);
        if (active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }, { rootMargin: '-100px 0px -60% 0px', threshold: 0 });
    sections.forEach(section => observer.observe(section));
  }
  links.forEach(link => link.addEventListener('click', () => { if (!wide.matches) toc.open = false; }));
}
