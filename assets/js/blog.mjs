// The article remains readable without this progressive enhancement.
const articleBody = document.querySelector('.article-body');
const toc = document.querySelector('.article-toc');

// Reading progress hairline & mobile quick-jump pill.
let progressBar = null;
let mobilePill = null;
if (articleBody) {
  progressBar = document.createElement('div');
  progressBar.className = 'reading-progress';
  progressBar.setAttribute('aria-hidden', 'true');
  document.body.append(progressBar);
}
if (toc) {
  mobilePill = document.createElement('button');
  mobilePill.type = 'button';
  mobilePill.className = 'mobile-toc-pill';
  mobilePill.textContent = 'Contents ↑';
  mobilePill.setAttribute('aria-label', 'Jump to table of contents');
  mobilePill.addEventListener('click', () => {
    toc.open = true;
    toc.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const summary = toc.querySelector('summary');
    if (summary) summary.focus({ preventScroll: true });
  });
  document.body.append(mobilePill);
}

const tocLinks = toc ? [...toc.querySelectorAll('a[href^="#"]')] : [];
const tocSections = tocLinks.map(link => document.getElementById(link.hash.slice(1))).filter(Boolean);

if (toc) {
  const wide = matchMedia('(min-width: 801px)');
  const setOpen = () => { toc.open = wide.matches; };
  setOpen();
  wide.addEventListener('change', setOpen);
  tocLinks.forEach(link => link.addEventListener('click', () => { if (!wide.matches) toc.open = false; }));
}

let scrollPending = false;
const updateOnScroll = () => {
  scrollPending = false;
  if (progressBar && articleBody) {
    const rect = articleBody.getBoundingClientRect();
    const total = Math.max(1, articleBody.offsetHeight - window.innerHeight * 0.7);
    const passed = Math.min(Math.max(-rect.top + 120, 0), total);
    progressBar.style.transform = `scaleX(${(passed / total).toFixed(4)})`;
  }
  if (mobilePill) {
    mobilePill.classList.toggle('is-visible', window.scrollY > 420);
  }
  if (tocSections.length) {
    const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 24;
    let current;
    if (atBottom) {
      current = tocSections[tocSections.length - 1].id;
    } else {
      for (const section of tocSections) {
        if (section.getBoundingClientRect().top > 150) break;
        current = section.id;
      }
    }
    tocLinks.forEach(link => {
      const active = link.hash === `#${current}`;
      link.classList.toggle('is-current', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
};
const scheduleScroll = () => {
  if (scrollPending) return;
  scrollPending = true;
  requestAnimationFrame(updateOnScroll);
};
if (articleBody || toc) {
  window.addEventListener('scroll', scheduleScroll, { passive: true });
  window.addEventListener('resize', scheduleScroll);
  window.addEventListener('load', scheduleScroll);
  updateOnScroll();
}

// Section heading permalink buttons (#).
if (articleBody) {
  for (const section of articleBody.querySelectorAll('section[id]')) {
    const heading = section.querySelector(':scope > h2');
    if (!heading || heading.querySelector('.section-anchor')) continue;
    const anchor = document.createElement('a');
    anchor.className = 'section-anchor';
    anchor.href = `#${section.id}`;
    anchor.textContent = '#';
    anchor.setAttribute('aria-label', `Copy link to ${heading.textContent.trim()}`);
    let resetTimer;
    anchor.addEventListener('click', event => {
      event.preventDefault();
      const url = new URL(`#${section.id}`, window.location.href).href;
      history.replaceState(null, '', `#${section.id}`);
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).catch(() => {});
      }
      anchor.textContent = 'Copied';
      anchor.classList.add('is-copied');
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        anchor.textContent = '#';
        anchor.classList.remove('is-copied');
      }, 1400);
    });
    heading.append(anchor);
  }
}

// Citation hover/focus popover and return-to-text link on click.
if (articleBody) {
  const refLinks = [...articleBody.querySelectorAll('a[href^="#ref-"]')]
    .filter(link => !link.closest('#references'));
  if (refLinks.length) {
    const popover = document.createElement('div');
    popover.className = 'citation-popover';
    popover.setAttribute('role', 'tooltip');
    popover.hidden = true;
    document.body.append(popover);

    let hideTimer = null;
    let activeTrigger = null;
    let openScrollY = 0;

    const closePopover = () => {
      clearTimeout(hideTimer);
      popover.hidden = true;
      activeTrigger = null;
    };
    const scheduleClose = () => {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(closePopover, 160);
    };
    const showPopover = link => {
      const targetId = link.getAttribute('href').slice(1);
      const refItem = document.getElementById(targetId);
      if (!refItem) return;
      clearTimeout(hideTimer);
      activeTrigger = link;
      openScrollY = window.scrollY;

      const label = document.createElement('span');
      label.className = 'citation-popover-label';
      const num = link.textContent.replace(/[\[\]]/g, '').trim();
      label.textContent = num ? `Reference ${num}` : 'Reference';

      const body = document.createElement('div');
      for (const node of refItem.childNodes) {
        if (node.nodeType === 1 && node.classList.contains('ref-back')) continue;
        body.append(node.cloneNode(true));
      }
      popover.replaceChildren(label, body);
      popover.hidden = false;

      const rect = link.getBoundingClientRect();
      const popRect = popover.getBoundingClientRect();
      const margin = 12;
      let left = rect.left + rect.width / 2 - popRect.width / 2;
      left = Math.max(margin, Math.min(left, window.innerWidth - popRect.width - margin));
      let top = rect.bottom + 8;
      if (top + popRect.height > window.innerHeight - margin && rect.top - popRect.height - 8 > margin) {
        top = rect.top - popRect.height - 8;
      }
      popover.style.left = `${Math.round(left)}px`;
      popover.style.top = `${Math.round(top)}px`;
    };

    popover.addEventListener('mouseenter', () => clearTimeout(hideTimer));
    popover.addEventListener('mouseleave', scheduleClose);
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !popover.hidden) closePopover();
    });
    window.addEventListener('scroll', () => {
      if (!popover.hidden && Math.abs(window.scrollY - openScrollY) > 24) closePopover();
    }, { passive: true });

    refLinks.forEach((link, idx) => {
      if (!link.id) link.id = `cite-${idx + 1}`;
      link.addEventListener('mouseenter', () => showPopover(link));
      link.addEventListener('mouseleave', scheduleClose);
      link.addEventListener('focus', () => showPopover(link));
      link.addEventListener('blur', () => {
        setTimeout(() => {
          if (!popover.contains(document.activeElement) && document.activeElement !== activeTrigger) {
            closePopover();
          }
        }, 120);
      });
      link.addEventListener('click', () => {
        closePopover();
        const refItem = document.getElementById(link.getAttribute('href').slice(1));
        if (!refItem) return;
        for (const old of document.querySelectorAll('#references .ref-back')) old.remove();
        const back = document.createElement('a');
        back.className = 'ref-back';
        back.href = `#${link.id}`;
        back.textContent = '↩ Back';
        back.setAttribute('aria-label', 'Return to citation in article');
        refItem.append(back);
      });
    });
  }
}

// Walkthrough figures default to the complete final step; tabs let readers inspect earlier steps.
for (const figure of document.querySelectorAll('[data-figure-walkthrough]')) {
  const controls = figure.querySelector('[data-figure-controls]');
  if (!controls) continue;
  const tabs = [...controls.querySelectorAll('[role="tab"]')];
  const panels = [...figure.querySelectorAll('[role="tabpanel"]')];
  if (!tabs.length || tabs.length !== panels.length) continue;

  function select(index, focus = false) {
    figure.dataset.currentStep = String(index + 1);
    tabs.forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
      panels[i].hidden = i !== index;
    });
    const svg = figure.querySelector('svg');
    if (svg) svg.setAttribute('aria-describedby', panels[index].id);
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
  select(tabs.length - 1);
  figure.classList.add('is-enhanced');
  controls.hidden = false;
}
