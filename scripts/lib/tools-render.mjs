// HTML for the two tools that run on the family's phone (flyer, documents for authorities).
// The forms are hidden until the page's script runs; without JavaScript a note points to
// the written guide instead. Called by renderSite.

import { esc } from './render.mjs';
import { FICHA_PAGE, ESCRITOS_PAGE, FUNDAMENTOS, CAMPOS, ESCRITOS, TOOLS_T as X } from '../../site/tools.mjs';

// type="application/json" is never executed, so the CSP allows it.
const dataScript = (id, data) => `<script type="application/json" id="${id}">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;

function field({ id, label, hint, type = 'text', long = false, required = false, prefix, attrs = '' }) {
  const name = `${prefix}-${id}`;
  const control = long
    ? `<textarea id="${name}" name="${esc(id)}" rows="3"${required ? ' required' : ''}${attrs}></textarea>`
    : `<input id="${name}" name="${esc(id)}" type="${type}"${required ? ' required' : ''}${type === 'number' ? ' min="0" max="120" inputmode="numeric"' : ''}${type === 'tel' ? ' inputmode="tel"' : ''} autocomplete="off"${attrs}>`;
  return `<label class="field" for="${name}"><span class="field-label">${esc(label)}</span>${hint ? `<span class="hint">${esc(hint)}</span>` : ''}${control}</label>`;
}

export function renderFichaBody(guideLink) {
  const f = X.fichaFields;
  const out = [`<h1>${esc(FICHA_PAGE.title)}</h1>`, `<p class="lead">${esc(X.fichaIntro)}</p>`];
  out.push(`<div class="note"><strong>${esc(X.fichaBefore)}</strong><ul>${X.fichaBeforeList.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>`);
  out.push(`<p id="ficha-sinjs">${esc(X.fichaNoJs)} <a href="${esc(guideLink.file)}">${esc(guideLink.nav)}</a>.</p>`);
  out.push('<form id="ficha-form" class="tool no-print" autocomplete="off" hidden>');
  out.push(field({ id: 'nombre', label: f.nombre, required: true, prefix: 'f' }));
  out.push(field({ id: 'edad', label: f.edad, type: 'number', prefix: 'f' }));
  out.push(`<label class="field" for="f-foto"><span class="field-label">${esc(f.foto)}</span><span class="hint">${esc(X.fichaPhotoHint)}</span><input id="f-foto" name="foto" type="file" accept="image/*"></label>`);
  out.push(field({ id: 'senas', label: f.senas, long: true, prefix: 'f' }));
  out.push(field({ id: 'vestimenta', label: f.vestimenta, long: true, prefix: 'f' }));
  out.push(field({ id: 'fecha', label: f.fecha, type: 'date', prefix: 'f' }));
  out.push(field({ id: 'lugar', label: f.lugar, prefix: 'f' }));
  out.push(field({ id: 'telefono', label: f.telefono, type: 'tel', prefix: 'f' }));
  out.push(field({ id: 'extra', label: f.extra, prefix: 'f' }));
  out.push(`<fieldset class="choice"><legend>${esc(f.formato)}</legend>`);
  X.fichaFormats.forEach((fmt, i) => {
    out.push(`<label><input type="radio" name="formato" value="${esc(fmt.id)}"${i === 0 ? ' checked' : ''}> ${esc(fmt.label)}</label>`);
  });
  out.push('</fieldset>');
  out.push(`<p><button type="submit" class="call">${esc(X.fichaMakeIt)}</button></p>`);
  out.push('<p id="ficha-error" class="note" role="alert" hidden></p>');
  out.push('</form>');
  out.push('<section id="ficha-resultado" class="no-print" hidden>');
  out.push(`<canvas id="ficha-canvas" role="img" aria-label="${esc(X.fichaPreviewLabel)}"></canvas>`);
  out.push(`<p class="actions"><button type="button" id="ficha-descargar" class="call">${esc(X.fichaDownload)}</button> <button type="button" id="ficha-compartir" class="alt" hidden>${esc(X.fichaShare)}</button></p>`);
  out.push('</section>');
  out.push(dataScript('ficha-datos', { formats: X.fichaFormats, banner: X.fichaTitleBanner, foot: X.fichaFootNote, fields: f, needName: X.fichaNeedName }));
  return out.join('\n');
}

export function renderEscritosBody(guideLink) {
  const out = [`<h1>${esc(ESCRITOS_PAGE.title)}</h1>`, `<p class="lead">${esc(X.escritosIntro)}</p>`];
  out.push(`<p class="note">${esc(X.escritosLimit)}</p>`);
  out.push(`<h2>${esc(X.escritosHowToTitle)}</h2><ul>${X.escritosHowTo.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`);
  out.push(`<p id="escritos-sinjs">${esc(X.escritosNoJs)} <a href="${esc(guideLink.file)}">${esc(guideLink.nav)}</a>.</p>`);

  out.push('<form id="escritos-form" class="tool no-print" autocomplete="off" hidden>');
  out.push(`<fieldset class="choice"><legend>${esc(X.escritosPick)}</legend>`);
  Object.entries(ESCRITOS).forEach(([id, def], i) => {
    out.push(`<label><input type="radio" name="tipo" value="${esc(id)}"${i === 0 ? ' checked' : ''}> <span><strong>${esc(def.title)}</strong><span class="hint">${esc(def.when)}</span></span></label>`);
  });
  out.push('</fieldset>');
  // One input per field; it is shown for every document that uses it, so what the person
  // typed (their name, for example) carries over when they switch documents.
  for (const [id, campo] of Object.entries(CAMPOS)) {
    const types = Object.entries(ESCRITOS).filter(([, d]) => d.fields.includes(id)).map(([t]) => t).join(' ');
    out.push(`<div class="field-wrap" data-types="${esc(types)}">${field({ id, ...campo, prefix: 'e' })}</div>`);
  }
  out.push(`<p><button type="submit" class="call">${esc(X.escritosMake)}</button></p>`);
  out.push('</form>');

  out.push('<section id="escritos-resultado" hidden>');
  out.push(`<h2 id="escritos-titulo" tabindex="-1" class="no-print">${esc(X.escritosResult)}</h2>`);
  out.push('<p id="escritos-faltan" class="note no-print" role="status" hidden></p>');
  out.push('<pre id="escritos-texto" class="doc" tabindex="0"></pre>');
  out.push(`<p class="actions no-print"><button type="button" id="escritos-copiar" class="call">${esc(X.escritosCopy)}</button> <button type="button" id="escritos-descargar" class="alt">${esc(X.escritosDownload)}</button> <button type="button" id="escritos-imprimir" class="alt">${esc(X.escritosPrint)}</button> <button type="button" id="escritos-volver" class="alt">${esc(X.escritosBack)}</button></p>`);
  out.push('</section>');
  out.push(dataScript('escritos-datos', { escritos: ESCRITOS, campos: CAMPOS, fund: FUNDAMENTOS, copied: X.escritosCopied, missingOne: X.escritosMissingOne, missingMany: X.escritosMissingMany }));
  return out.join('\n');
}
