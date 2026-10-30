// Renders content into static HTML pages. Pure: returns Map<fileName, html>.
// mode "preview": every item, with review badges and reviewer notes, never indexed.
// mode "public": approved items only; refuses to render anything else.

import { SITE, HOME_ITEMS, REQUIRED_PUBLIC_ITEMS, PAGES, GUIDE_PAGE, PHASE_TITLES, T } from '../../site/strings.mjs';
import { PHASES, summarize } from './content.mjs';
import { FICHA_PAGE, ESCRITOS_PAGE } from '../../site/tools.mjs';
import { ALL_STATES } from '../../site/states.mjs';
import { renderFichaBody, renderEscritosBody } from './tools-render.mjs';

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ENTITIES[c]);

const fullDate = new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeZone: 'UTC' });
const monthYear = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' });

// Accepts YYYY, YYYY-MM or YYYY-MM-DD, as used in sources.json.
export function formatDate(value) {
  if (!value) return '';
  if (/^\d{4}$/.test(value)) return value;
  if (/^\d{4}-\d{2}$/.test(value)) return monthYear.format(new Date(`${value}-01T00:00:00Z`));
  return fullDate.format(new Date(`${value}T00:00:00Z`));
}

// Mexican numbers: toll-free 800 numbers are dialled as-is; other 10-digit numbers get +52.
export function telHref(value) {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('800') || digits.length !== 10) return `tel:${digits}`;
  return `tel:+52${digits}`;
}

// Only our own files may load: no third-party scripts, styles, fonts or trackers.
const CSP = "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src 'self' blob:; manifest-src 'self'; worker-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'";

function layout({ mode, title, description, body, bodyClass = '', nav, css, footerExtra = '', scripts = [] }) {
  const fullTitle = title === SITE.name ? SITE.name : `${title} · ${SITE.name}`;
  const scriptTags = ['app.js', ...scripts].map((s) => `<script src="${esc(s)}" defer></script>`).join('\n');
  return `<!doctype html>
<html lang="es-MX">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="referrer" content="no-referrer">
${mode === 'preview' ? '<meta name="robots" content="noindex, nofollow">\n' : ''}<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#0b5d57">
<meta property="og:type" content="website">
<meta property="og:locale" content="es_MX">
<meta property="og:site_name" content="${esc(SITE.name)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<link rel="icon" href="icon.svg" type="image/svg+xml">
<link rel="manifest" href="manifest.webmanifest">
<style>${css}</style>
${scriptTags}
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
<a class="skip" href="#main">${esc(T.skipLink)}</a>
${mode === 'preview' ? `<p class="flag" role="alert">${esc(T.previewBanner)}</p>\n` : ''}<header class="site"><div class="wrap"><a href="index.html">${esc(SITE.name)}</a></div></header>
<main id="main" class="wrap">
${body}
</main>
<footer class="site"><div class="wrap">
<nav aria-label="Secciones"><ul>${nav.map((n) => `<li><a href="${esc(n.file)}">${esc(n.label)}</a></li>`).join('')}</ul></nav>
<p>${esc(T.footerPrivacy)} ${esc(T.footerNotLegal)}</p>
${footerExtra}</div></footer>
</body>
</html>
`;
}

function renderContact(c, mode) {
  let value;
  if (c.kind === 'phone') value = `<a class="call" href="${esc(telHref(c.value))}">${esc(c.value)}</a>`;
  else if (c.kind === 'web') value = `<a href="${esc(c.value)}" rel="noopener noreferrer">${esc(c.value.replace(/^https:\/\//, ''))}</a>`;
  else if (c.kind === 'email') value = `<a href="mailto:${esc(c.value)}">${esc(c.value)}</a>`;
  else value = esc(c.value); // whatsapp, address: shown as text
  const flag = mode === 'preview' && !c.confirmed_on ? ` <span class="badge">${esc(T.contactUnconfirmed)}</span>` : '';
  return `<li><span class="label">${esc(c.label)}</span>${value}${flag}</li>`;
}

function renderRefs(refs, { mode, sourcesById }) {
  const lis = refs.map((r) => {
    const src = sourcesById.get(r.source);
    const how = mode === 'preview' ? ` (${esc(T.verification[r.verification])})` : '';
    return `<li><a href="fuentes.html#src-${esc(src.id)}">${esc(src.short)}</a>, ${esc(r.locator)}${how}</li>`;
  });
  return `<details class="sources"><summary>${esc(T.sourcesOfItem)}</summary><ul>${lis.join('')}</ul></details>`;
}

// anchor=false renders a copy (home page, guide) whose heading links to the item's own page.
function renderItem(item, ctx, { anchor = true } = {}) {
  const href = anchor ? `#${item.id}` : `${ctx.itemPage.get(item.id)}#${item.id}`;
  const out = [`<article class="item"${anchor ? ` id="${esc(item.id)}"` : ''}>`];
  out.push(`<h3><a href="${esc(href)}">${esc(item.title)}</a></h3>`);
  if (ctx.mode === 'preview') {
    out.push(`<p><span class="badge ${esc(item.review.status)}">${esc(T.status[item.review.status])}</span></p>`);
  }
  out.push(`<p>${esc(item.body)}</p>`);
  if (item.list) out.push(`<ul>${item.list.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`);
  if (item.quote) {
    const src = ctx.sourcesById.get(item.quote.source);
    out.push(`<blockquote class="quote"><p>«${esc(item.quote.text)}»</p><footer>${esc(T.quoteFrom(src.short, item.quote.locator))}</footer></blockquote>`);
  }
  if (item.contacts?.length) out.push(`<ul class="contacts">${item.contacts.map((c) => renderContact(c, ctx.mode)).join('')}</ul>`);
  out.push(renderRefs(item.sources, ctx));
  if (ctx.mode === 'public' && item.review.last_reviewed) {
    out.push(`<p class="reviewed">${esc(T.reviewedOn(formatDate(item.review.last_reviewed)))}</p>`);
  }
  if (ctx.mode === 'preview' && item.review.notes) {
    out.push(`<p class="note"><strong>${esc(T.reviewNote)}:</strong> ${esc(item.review.notes)}</p>`);
  }
  out.push('</article>');
  return out.join('\n');
}

// The flyer and document makers, with a line each on what they do. Shown on the home page
// and under the guided questions' results.
const toolCards = `<ul class="cards tools">${[FICHA_PAGE, ESCRITOS_PAGE].map((p) => `<li><a href="${esc(p.file)}">${esc(p.nav)}<span>${esc(p.description)}</span></a></li>`).join('')}</ul>`;

const cards = (links) => `<ul class="cards">${links.map((l) => `<li><a href="${esc(l.file)}">${esc(l.label)}</a></li>`).join('')}</ul>`;

// Guided questions: a form, plus every possible result pre-rendered and hidden.
// guia.js shows and orders the ones that apply. Without JavaScript, a link to the full list.
function renderGuide(guide, { ctx, itemsById, statePages, sectionPages }) {
  const out = [`<h1>${esc(guide.title)}</h1>`, `<p class="lead">${esc(guide.intro)}</p>`];
  if (ctx.mode === 'preview') {
    out.push(`<p><span class="badge ${esc(guide.review.status)}">${esc(T.status[guide.review.status])}</span></p>`);
    if (guide.review.notes) out.push(`<p class="note"><strong>${esc(T.reviewNote)}:</strong> ${esc(guide.review.notes)}</p>`);
  }
  const checklist = sectionPages.find((p) => p.section.id === 'checklist');
  out.push(`<p id="guia-sinjs">${esc(T.guideNoJs)} <a href="${esc(checklist?.file ?? 'index.html')}">${esc(checklist?.nav ?? T.homeNav)}</a>.</p>`);

  out.push('<form id="guia-form" class="guide" autocomplete="off" hidden>');
  for (const q of guide.questions) {
    if (q.options === 'states') {
      // All 32 states, whether or not the guide has a page for them yet.
      out.push(`<div class="field"><label for="guia-${esc(q.id)}">${esc(q.text)}</label>`);
      out.push(`<select id="guia-${esc(q.id)}" name="${esc(q.id)}"><option value="">${esc(T.guideSkip)}</option>`);
      for (const s of ALL_STATES) out.push(`<option value="${esc(s.id)}">${esc(s.name)}</option>`);
      out.push('</select></div>');
      continue;
    }
    out.push(`<fieldset><legend>${esc(q.text)}</legend>`);
    for (const o of q.options) {
      out.push(`<label><input type="radio" name="${esc(q.id)}" value="${esc(o.id)}"> ${esc(o.label)}</label>`);
    }
    out.push(`<label class="skip-option"><input type="radio" name="${esc(q.id)}" value="" checked> ${esc(T.guideSkip)}</label>`);
    out.push('</fieldset>');
  }
  out.push(`<p><button type="submit" class="call">${esc(T.guideSubmit)}</button></p>`, '</form>');

  out.push('<section id="guia-resultados" hidden>');
  out.push(`<h2 id="guia-titulo" tabindex="-1">${esc(T.guideResultsTitle)}</h2>`);
  out.push(`<p id="guia-otro" class="note" hidden>${esc(T.guideOtherStateNote)}</p>`);
  out.push('<div id="guia-lista">');
  const referenced = new Set();
  for (const step of guide.steps) {
    if (step.item) referenced.add(step.item);
    if (step.state) for (const s of statePages) for (const i of s.items) if (i.kind === step.state) referenced.add(i.id);
  }
  for (const id of referenced) {
    const item = itemsById.get(id);
    if (item) out.push(`<div data-key="item:${esc(id)}" hidden>${renderItem(item, ctx, { anchor: false })}</div>`);
  }
  for (const step of guide.steps.filter((s) => s.section)) {
    const page = sectionPages.find((p) => p.section.id === step.section);
    if (!page) continue;
    out.push(`<div data-key="section:${esc(step.section)}" hidden><article class="item"><h3><a href="${esc(page.file)}">${esc(page.section.title)}</a></h3>${page.section.intro ? `<p>${esc(page.section.intro)}</p>` : ''}</article></div>`);
  }
  out.push('</div>');
  if (checklist) out.push(`<p>${esc(T.guideResultsNote)} <a href="${esc(checklist.file)}">${esc(checklist.nav)}</a>.</p>`);
  out.push(`<h2>${esc(T.guideToolsTitle)}</h2>`);
  out.push(toolCards);
  out.push(`<p><button type="button" id="guia-reiniciar">${esc(T.guideReset)}</button></p>`, '</section>');

  // Data for guia.js. type="application/json" is never executed, so the CSP allows it.
  const stateItems = Object.fromEntries(statePages.map((s) => [s.state.id, {
    agency: s.items.filter((i) => i.kind === 'agency').map((i) => i.id),
    note: s.items.filter((i) => i.kind === 'note').map((i) => i.id),
  }]));
  const data = JSON.stringify({ steps: guide.steps, stateItems }).replace(/</g, '\\u003c');
  out.push(`<script type="application/json" id="guia-datos">${data}</script>`);
  return out.join('\n');
}

export function renderSite(content, { mode, css, builtOn }) {
  if (mode !== 'preview' && mode !== 'public') throw new Error(`unknown mode "${mode}"`);

  const sourcesById = new Map(content.sources.map((s) => [s.id, s]));
  const itemsById = new Map();
  for (const group of [...content.sections, ...content.states]) for (const item of group.items) itemsById.set(item.id, item);

  if (mode === 'public') {
    const unapproved = [...itemsById.values()].filter((i) => i.review.status !== 'approved').map((i) => i.id);
    if (unapproved.length) throw new Error(`Public build received unapproved items: ${unapproved.join(', ')}`);
    if (content.guide && content.guide.review.status !== 'approved') throw new Error('Public build received unapproved guided questions');
    const missing = REQUIRED_PUBLIC_ITEMS.filter((id) => !itemsById.has(id));
    if (missing.length) throw new Error(`Public build refused. These items must be approved first: ${missing.join(', ')}`);
  } else {
    const missing = HOME_ITEMS.filter((id) => !itemsById.has(id));
    if (missing.length) throw new Error(`HOME_ITEMS not found in content: ${missing.join(', ')}`);
  }

  // Which pages exist: empty sections and states are skipped (public build before review).
  const sectionPages = content.sections
    .filter((s) => s.items.length)
    .map((s) => {
      const page = PAGES[s.section.id];
      if (!page) throw new Error(`No page defined in site/strings.mjs for section "${s.section.id}"`);
      return { ...s, ...page };
    });
  const statePages = content.states
    .filter((s) => s.items.length)
    .map((s) => ({ ...s, file: `estado-${s.state.id}.html` }));
  const guide = content.guide ?? null;

  const itemPage = new Map();
  for (const p of [...sectionPages, ...statePages]) for (const item of p.items) itemPage.set(item.id, p.file);

  const ctx = { mode, sourcesById, itemPage };
  const nav = [
    { file: 'index.html', label: T.homeNav },
    ...(guide ? [{ file: GUIDE_PAGE.file, label: GUIDE_PAGE.nav }] : []),
    ...sectionPages.map((p) => ({ file: p.file, label: p.nav })),
    { file: FICHA_PAGE.file, label: FICHA_PAGE.nav },
    { file: ESCRITOS_PAGE.file, label: ESCRITOS_PAGE.nav },
    { file: 'fuentes.html', label: T.sourcesNav },
    { file: 'acerca.html', label: T.aboutNav },
  ];
  const stats = summarize(content);
  const footerExtra = [
    `<p>${esc(T.builtOn(formatDate(builtOn)))}</p>`,
    mode === 'preview' ? `<p>${esc(T.previewCounts(stats))}</p>` : '',
  ].join('\n');
  const page = (opts) => layout({ mode, nav, css, footerExtra, ...opts });

  const pages = new Map();

  // Home
  const homeItems = HOME_ITEMS.map((id) => itemsById.get(id)).filter(Boolean);
  pages.set('index.html', page({
    title: SITE.name,
    description: SITE.description,
    bodyClass: 'home',
    body: [
      `<h1>${esc(T.homeTitle)}</h1>`,
      `<p class="lead">${esc(T.homeLead)}</p>`,
      guide ? `<p><a class="call cta" href="${esc(GUIDE_PAGE.file)}">${esc(T.guideCta)}</a></p>` : '',
      `<h2>${esc(T.homeImportant)}</h2>`,
      ...homeItems.map((i) => renderItem(i, ctx, { anchor: false })),
      `<h2>${esc(T.guideToolsTitle)}</h2>`,
      toolCards,
      statePages.length
        ? `<h2>${esc(T.homeStates)}</h2>\n${cards(statePages.map((s) => ({ file: s.file, label: s.state.name })))}\n<p>${esc(T.homeStatesMissing)}</p>`
        : '',
      `<h2>${esc(T.homeMore)}</h2>`,
      cards(sectionPages.map((p) => ({ file: p.file, label: p.nav }))),
    ].join('\n'),
  }));

  // Guided questions
  if (guide) {
    pages.set(GUIDE_PAGE.file, page({
      title: guide.title,
      description: T.guideDescription,
      scripts: ['guia.js'],
      body: renderGuide(guide, { ctx, itemsById, statePages, sectionPages }),
    }));
  }

  // Tools that run on the phone. Without JavaScript they point to the written steps.
  const toolFallback = sectionPages.find((p) => p.section.id === 'documentos') ?? { file: 'index.html', nav: T.homeNav };
  pages.set(FICHA_PAGE.file, page({
    title: FICHA_PAGE.title,
    description: FICHA_PAGE.description,
    scripts: [FICHA_PAGE.script],
    body: renderFichaBody(toolFallback),
  }));
  pages.set(ESCRITOS_PAGE.file, page({
    title: ESCRITOS_PAGE.title,
    description: ESCRITOS_PAGE.description,
    scripts: [ESCRITOS_PAGE.script],
    bodyClass: 'page-escritos',
    body: renderEscritosBody(sectionPages.find((p) => p.section.id === 'rechazo') ?? { file: 'index.html', nav: T.homeNav }),
  }));

  // National sections
  for (const p of sectionPages) {
    const body = [`<h1>${esc(p.section.title)}</h1>`];
    if (p.section.intro) body.push(`<p class="lead">${esc(p.section.intro)}</p>`);
    if (p.section.id === 'rechazo') body.push(`<p class="print-hint">${esc(T.printHint)}</p>`);
    if (p.section.id === 'checklist') {
      for (const phase of PHASES) {
        const items = p.items.filter((i) => i.phase === phase);
        if (!items.length) continue;
        body.push(`<h2 id="${esc(phase)}">${esc(PHASE_TITLES[phase])}</h2>`, ...items.map((i) => renderItem(i, ctx)));
      }
    } else {
      body.push(...p.items.map((i) => renderItem(i, ctx)));
    }
    pages.set(p.file, page({ title: p.section.title, description: p.description, body: body.join('\n'), bodyClass: `page-${p.section.id}` }));
  }

  // States
  const nationalLinks = sectionPages.filter((p) => p.section.id === 'checklist' || p.section.id === 'instituciones');
  for (const s of statePages) {
    const agencies = s.items.filter((i) => i.kind === 'agency');
    const notes = s.items.filter((i) => i.kind === 'note');
    const body = [`<h1>${esc(T.statePageTitle(s.state.name))}</h1>`];
    if (agencies.length) body.push(`<h2>${esc(T.stateAgencies)}</h2>`, ...agencies.map((i) => renderItem(i, ctx)));
    if (notes.length) body.push(`<h2>${esc(T.stateNotes)}</h2>`, ...notes.map((i) => renderItem(i, ctx)));
    if (nationalLinks.length) {
      body.push(`<p>${esc(T.stateSeeAlso)} ${nationalLinks.map((p) => `<a href="${esc(p.file)}">${esc(p.nav)}</a>`).join(' · ')}.</p>`);
    }
    pages.set(s.file, page({ title: T.statePageTitle(s.state.name), description: T.stateDescription(s.state.name), body: body.join('\n') }));
  }

  // Sources
  const sourceBlocks = content.sources.map((s) => {
    const dates = [
      s.published ? `${T.published}: ${formatDate(s.published)}` : '',
      s.last_reform ? `${T.lastReform}: ${formatDate(s.last_reform)}` : '',
    ].filter(Boolean).join(' · ');
    return [
      `<article class="source" id="src-${esc(s.id)}">`,
      `<h3>${esc(s.title)}</h3>`,
      `<p>${esc(s.issuer)}${dates ? `<br>${esc(dates)}` : ''}</p>`,
      `<p><a href="${esc(s.url)}" rel="noopener noreferrer">${esc(T.openSource)}</a></p>`,
      mode === 'preview' && s.accessed === null ? `<p class="note">${esc(T.sourceNotRead)}</p>` : '',
      '</article>',
    ].filter(Boolean).join('\n');
  });
  pages.set('fuentes.html', page({
    title: T.sourcesTitle,
    description: T.sourcesDescription,
    body: [`<h1>${esc(T.sourcesTitle)}</h1>`, `<p class="lead">${esc(T.sourcesIntro)}</p>`, ...sourceBlocks].join('\n'),
  }));

  // About
  pages.set('acerca.html', page({
    title: T.aboutTitle,
    description: T.aboutDescription,
    body: [`<h1>${esc(T.aboutTitle)}</h1>`, ...T.aboutParagraphs.map((p) => `<p>${esc(p)}</p>`)].join('\n'),
  }));

  return pages;
}
