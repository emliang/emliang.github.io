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

// Each walkthrough is a complete static figure until its controls are ready.
for (const figure of document.querySelectorAll('[data-figure-walkthrough]')) {
  const controls = figure.querySelector('[data-figure-controls]');
  const tabs = [...controls.querySelectorAll('[role="tab"]')];
  const panels = [...figure.querySelectorAll('[role="tabpanel"]')];
  function select(index, focus = false) {
    figure.dataset.currentStep = String(index + 1);
    tabs.forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
      panels[i].hidden = i !== index;
    });
    figure.querySelector('svg').setAttribute('aria-describedby', panels[index].id);
    if (focus) tabs[index].focus();
  }
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(i));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (i + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (i + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      select(next, true);
    });
  });
  select(0);
  figure.classList.add('is-enhanced');
  controls.hidden = false;
}
