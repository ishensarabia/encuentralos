// Search flyer. The photo and the data stay on this phone: the image is drawn on a canvas
// here and nothing is stored, uploaded or put in the URL. Redrawing the photo also drops its
// hidden metadata (location, date, camera).
(function () {
  'use strict';
  var form = document.getElementById('ficha-form');
  var dataEl = document.getElementById('ficha-datos');
  if (!form || !dataEl) return;

  var data = JSON.parse(dataEl.textContent);
  var canvas = document.getElementById('ficha-canvas');
  var result = document.getElementById('ficha-resultado');
  var errorEl = document.getElementById('ficha-error');
  var shareBtn = document.getElementById('ficha-compartir');
  var ctx = canvas.getContext('2d');
  var FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

  form.hidden = false;
  document.getElementById('ficha-sinjs').hidden = true;

  // While the example is drawn, the values come from the sample instead of the form.
  var sample = null;

  function value(name) {
    if (sample) return String(sample[name] || '');
    var el = form.elements[name];
    return el ? String(el.value).replace(/\s+/g, ' ').trim() : '';
  }

  function longDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return iso;
    var months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    return parseInt(m[3], 10) + ' de ' + months[parseInt(m[2], 10) - 1] + ' de ' + m[1];
  }

  function wrap(text, maxWidth) {
    var words = text.split(' ');
    var lines = [];
    var line = '';
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + ' ' + words[i] : words[i];
      if (line && ctx.measureText(test).width > maxWidth) {
        lines.push(line);
        line = words[i];
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  // Draws `rows` ([{label, text}]) top-down in the box and returns the y where it ended.
  // The font shrinks until everything fits; if even the smallest size does not fit, the
  // rest is cut with an ellipsis rather than drawn over the footer.
  // With `strict`, nothing is drawn (and -1 is returned) if the rows do not fit at the smallest size.
  function drawRows(rows, x, y, width, height, strict, maxSize) {
    var size = maxSize || 46;
    var layout;
    for (; size >= 26; size -= 2) {
      var total = 0;
      layout = [];
      for (var i = 0; i < rows.length; i++) {
        ctx.font = '700 ' + size + 'px ' + FONT;
        var labelWidth = ctx.measureText(rows[i].label + ': ').width;
        ctx.font = '400 ' + size + 'px ' + FONT;
        var lines = wrap(rows[i].text, width - labelWidth);
        layout.push({ label: rows[i].label, lines: lines, labelWidth: labelWidth, color: rows[i].color || '#111' });
        total += lines.length * size * 1.28 + size * 0.4;
      }
      if (total <= height) break;
    }
    if (strict && total > height) return -1;
    var cursor = y;
    var bottom = y + height;
    for (var r = 0; r < layout.length; r++) {
      for (var l = 0; l < layout[r].lines.length; l++) {
        if (cursor + size > bottom) return cursor;
        var text = layout[r].lines[l];
        var last = cursor + size * 1.28 + size > bottom && (l < layout[r].lines.length - 1 || r < layout.length - 1);
        if (last) text += '…';
        ctx.fillStyle = layout[r].color;
        if (l === 0) {
          ctx.font = '700 ' + size + 'px ' + FONT;
          ctx.fillText(layout[r].label + ': ', x, cursor + size);
          ctx.font = '400 ' + size + 'px ' + FONT;
          ctx.fillText(text, x + layout[r].labelWidth, cursor + size);
        } else {
          ctx.font = '400 ' + size + 'px ' + FONT;
          ctx.fillText(text, x + layout[r].labelWidth, cursor + size);
        }
        cursor += size * 1.28;
        if (last) return cursor;
      }
      cursor += size * 0.4;
    }
    return cursor;
  }

  // The day the flyer was made, so anyone who finds an old copy can tell how old the data is.
  function issuedText() {
    var m = sample && sample.emision ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(sample.emision) : null;
    var d = new Date();
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var parts = m ? [m[3], m[2], m[1]] : [pad(d.getDate()), pad(d.getMonth() + 1), String(d.getFullYear())];
    return data.issuedLabel + ' ' + parts.join('/');
  }

  // Photo cropped to fill its box, keeping the face (upper part) in view.
  function drawPhoto(bitmap, x, y, w, h) {
    ctx.fillStyle = '#e6e6e6';
    ctx.fillRect(x, y, w, h);
    if (!bitmap) return;
    var scale = Math.max(w / bitmap.width, h / bitmap.height);
    var sw = w / scale;
    var sh = h / scale;
    ctx.drawImage(bitmap, (bitmap.width - sw) / 2, (bitmap.height - sh) * 0.25, sw, sh, x, y, w, h);
  }

  // Green footer: phone, who answers, folio and date. Returns the y where it starts.
  function drawFooter(W, H, margin) {
    var phone = value('telefono');
    var contact = [];
    if (value('contacto')) contact.push(value('contacto'));
    if (value('folio')) contact.push(data.folioLabel + ': ' + value('folio'));
    contact.push(issuedText());
    var strip = 40;
    var footerH = Math.round(H * 0.18) + strip;
    var footerY = H - footerH;
    var mainH = footerH - strip;
    ctx.fillStyle = '#0b5d57';
    ctx.fillRect(0, footerY, W, footerH);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = '700 ' + Math.round(mainH * 0.16) + 'px ' + FONT;
    ctx.fillText(data.foot, W / 2, footerY + mainH * 0.24, W - margin);
    if (phone) {
      ctx.font = '800 ' + Math.round(mainH * 0.31) + 'px ' + FONT;
      ctx.fillText(phone, W / 2, footerY + mainH * 0.6, W - margin);
    }
    ctx.font = '700 ' + Math.round(mainH * 0.15) + 'px ' + FONT;
    ctx.fillText(contact.join('  ·  '), W / 2, footerY + mainH * 0.87, W - margin);
    // Credit strip: where the flyer comes from, so others can make their own
    ctx.fillStyle = '#08443f';
    ctx.fillRect(0, H - strip, W, strip);
    ctx.fillStyle = '#d6efec';
    ctx.font = '600 22px ' + FONT;
    ctx.fillText(data.credit, W / 2, H - strip / 2 + 8, W - margin);
    ctx.textAlign = 'left';
    return footerY;
  }

  // A watermark across the example, so a screenshot of it can never pass as a real search.
  function drawWatermark(text, W, H) {
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-Math.PI / 7);
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#a3001b';
    ctx.textAlign = 'center';
    ctx.font = '900 ' + Math.round(W * 0.22) + 'px ' + FONT;
    ctx.fillText(text, 0, W * 0.07, W * 1.2);
    ctx.restore();
  }

  // Table of labelled facts in a grey panel (like the official cédulas): label on the left,
  // value on the right. The font shrinks to fit maxH. Returns the y where the panel ends.
  function drawTable(items, x, y, width, maxH) {
    var pad = 22;
    var size = 32;
    var layout;
    var total;
    var labelW;
    for (; size >= 22; size -= 2) {
      ctx.font = '700 ' + size + 'px ' + FONT;
      labelW = 0;
      for (var i = 0; i < items.length; i++) labelW = Math.max(labelW, ctx.measureText(items[i].label).width);
      labelW += 18;
      ctx.font = '400 ' + size + 'px ' + FONT;
      layout = [];
      total = pad * 2;
      for (var j = 0; j < items.length; j++) {
        var lines = wrap(items[j].text, width - pad * 2 - labelW);
        layout.push(lines);
        total += lines.length * size * 1.3 + size * 0.3;
      }
      if (total <= maxH) break;
    }
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(x, y, width, total);
    var cursor = y + pad;
    for (var r = 0; r < items.length; r++) {
      ctx.fillStyle = '#444';
      ctx.font = '700 ' + size + 'px ' + FONT;
      ctx.fillText(items[r].label, x + pad, cursor + size);
      ctx.fillStyle = '#111';
      ctx.font = '400 ' + size + 'px ' + FONT;
      for (var l = 0; l < layout[r].length; l++) {
        ctx.fillText(layout[r][l], x + pad + labelW, cursor + size);
        cursor += size * 1.3;
      }
      cursor += size * 0.3;
    }
    return y + total;
  }

  // Full-page flyer, laid out like an official cédula: health risk on top, photo and name on the
  // left, table of physical features on the right, then señas, clothing and what is known.
  function drawSheet(bitmap, W, H) {
    var margin = 60;
    var t = data.table;
    var bannerH = 130;
    ctx.fillStyle = '#a3001b';
    ctx.fillRect(0, 0, W, bannerH);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 84px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText(data.banner, W / 2, 98);
    ctx.textAlign = 'left';
    var y = bannerH + 24;

    // Health risk first: someone who sees the person may need to act on it
    var risk = value('vulnerabilidad');
    if (risk) {
      ctx.font = '700 34px ' + FONT;
      var riskLines = wrap(data.fields.alerta.toUpperCase() + ': ' + risk, W - margin * 2 - 50);
      if (riskLines.length > 5) { riskLines = riskLines.slice(0, 5); riskLines[4] += '…'; }
      var boxH = riskLines.length * 44 + 28;
      ctx.fillStyle = '#fdeaec';
      ctx.fillRect(margin, y, W - margin * 2, boxH);
      ctx.fillStyle = '#a3001b';
      ctx.fillRect(margin, y, 12, boxH);
      for (var k = 0; k < riskLines.length; k++) ctx.fillText(riskLines[k], margin + 34, y + 14 + (k + 1) * 44 - 10);
      y += boxH + 24;
    }

    var leftW = 460;
    var rightX = margin + leftW + 40;
    var rightW = W - margin - rightX;
    var photoH = 480;
    var top = y;
    drawPhoto(bitmap, margin, top, leftW, photoH);

    // Name, alias, age and sex under the photo
    var name = value('nombre').toUpperCase();
    var nameFont = 56;
    ctx.fillStyle = '#111';
    for (; ; nameFont -= 2) {
      ctx.font = '800 ' + nameFont + 'px ' + FONT;
      if (wrap(name, leftW).length <= 3 || nameFont <= 34) break;
    }
    var ly = top + photoH + 18;
    var nameLines = wrap(name, leftW).slice(0, 3);
    for (var n = 0; n < nameLines.length; n++) {
      ctx.fillText(nameLines[n], margin, ly + nameFont);
      ly += nameFont * 1.1;
    }
    if (value('apodo')) {
      ctx.font = 'italic 600 ' + Math.round(nameFont * 0.55) + 'px ' + FONT;
      ctx.fillText(data.aliasLabel + ': “' + value('apodo') + '”', margin, ly + nameFont * 0.6, leftW);
      ly += nameFont * 0.75;
    }
    var meta = [];
    if (value('edad')) meta.push(value('edad') + (value('edad') === '1' ? ' año' : ' años'));
    if (value('sexo')) meta.push(value('sexo'));
    if (meta.length) {
      ctx.font = '700 ' + Math.round(nameFont * 0.72) + 'px ' + FONT;
      ctx.fillText(meta.join(' · '), margin, ly + nameFont * 0.85, leftW);
      ly += nameFont;
    }

    // Table of facts on the right
    var items = [];
    var when = [];
    if (value('fecha')) when.push(longDate(value('fecha')));
    if (value('hora')) when.push('hacia las ' + value('hora') + ' h');
    if (when.length) items.push({ label: t.fecha, text: when.join(', ') });
    ['lugar', 'estatura', 'peso', 'complexion', 'tez', 'cabello', 'cabello_tipo', 'cabello_largo', 'ojos', 'ojos_tamano', 'boca', 'labios', 'ocupacion'].forEach(function (key) {
      if (value(key)) items.push({ label: t[key], text: value(key) });
    });
    var tableEnd = top;
    if (items.length) tableEnd = drawTable(items, rightX, top, rightW, Math.max(photoH, ly - top));

    // Señas, clothing and what is known, full width between the table and the footer
    var below = Math.max(ly, tableEnd) + 30;
    var footerY = drawFooter(W, H, margin);
    var rows = [];
    if (value('senas')) rows.push({ label: data.fields.senas, text: value('senas') });
    if (value('vestimenta')) rows.push({ label: data.fields.vestimenta, text: value('vestimenta') });
    if (value('hechos')) rows.push({ label: t.hechos, text: value('hechos') });
    if (value('extra')) rows.push({ label: data.fields.otro, text: value('extra') });
    if (rows.length) drawRows(rows, margin, below, W - margin * 2, footerY - below - 20, false, 34);
  }

  // opts (example only): { canvas, values, watermark }. Without it the flyer is drawn from the form.
  function draw(bitmap, fmt, opts) {
    var W = fmt.w;
    var H = fmt.h;
    var margin = 60;
    var target = opts ? opts.canvas : canvas;
    sample = opts ? opts.values : null;
    ctx = target.getContext('2d');
    target.width = W;
    target.height = H;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    if (fmt.id === 'hoja') {
      drawSheet(bitmap, W, H);
      if (opts && opts.watermark) drawWatermark(opts.watermark, W, H);
      sample = null;
      return;
    }

    // Banner
    var bannerH = Math.round(H * 0.09);
    ctx.fillStyle = '#a3001b';
    ctx.fillRect(0, 0, W, bannerH);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 ' + Math.round(bannerH * 0.62) + 'px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText(data.banner, W / 2, bannerH * 0.72);
    ctx.textAlign = 'left';

    // Photo, cropped to fill its box with the face (upper part) kept in view
    // On the tall story format the photo goes on top; on the post it sits left of the name.
    var story = fmt.id === 'story';
    var photoY = bannerH + 30;
    var photoW = story ? W - margin * 2 : 420;
    var photoH = story ? Math.round(H * 0.28) : 520;
    drawPhoto(bitmap, margin, photoY, photoW, photoH);

    // Name and age
    var name = value('nombre').toUpperCase();
    var age = value('edad');
    var textX = story ? margin : margin + photoW + 40;
    var textW = story ? W - margin * 2 : W - margin - textX;
    var maxLines = story ? 2 : 3;
    var y = story ? photoY + photoH + 30 : photoY;
    var nameFont = story ? 84 : 76;
    ctx.fillStyle = '#111';
    for (; ; nameFont -= 4) {
      ctx.font = '800 ' + nameFont + 'px ' + FONT;
      if (wrap(name, textW).length <= maxLines || nameFont <= 36) break;
    }
    var nameLines = wrap(name, textW).slice(0, maxLines);
    for (var i = 0; i < nameLines.length; i++) {
      ctx.fillText(nameLines[i], textX, y + nameFont);
      y += nameFont * 1.1;
    }
    var alias = value('apodo');
    if (alias) {
      ctx.font = 'italic 600 ' + Math.round(nameFont * 0.52) + 'px ' + FONT;
      ctx.fillText(data.aliasLabel + ': “' + alias + '”', textX, y + nameFont * 0.55, textW);
      y += nameFont * 0.7;
    }
    // "17 años · Mujer": the facts a stranger checks first against the person in front of them
    var meta = [];
    if (age) meta.push(age + (age === '1' ? ' año' : ' años'));
    if (value('sexo')) meta.push(value('sexo'));
    if (meta.length) {
      ctx.font = '700 ' + Math.round(nameFont * 0.7) + 'px ' + FONT;
      ctx.fillText(meta.join(' · '), textX, y + nameFont * 0.8, textW);
      y += nameFont * 0.95;
    }
    // The details start below the photo (post) or the name (story)
    var sideY = y + 10;
    y = story ? y + 20 : Math.max(y, photoY + photoH) + 30;

    var footerY = drawFooter(W, H, margin);

    // Details between the name and the footer
    // Order matters when space runs out (the last rows are the ones cut): where and when the person
    // was last seen first, then any health risk, then what lets a stranger recognise them.
    var rows = [];
    var seen = [];
    if (value('fecha')) seen.push(longDate(value('fecha')));
    if (value('hora')) seen.push('hacia las ' + value('hora') + ' h');
    if (value('lugar')) seen.push(value('lugar'));
    if (seen.length) rows.push({ label: data.fields.visto, text: seen.join(', ') });
    if (value('vulnerabilidad')) rows.push({ label: data.fields.alerta, text: value('vulnerabilidad'), color: '#a3001b' });
    // The compact formats fold the table of the full-page flyer into one line
    var low = function (key) { return value(key).toLowerCase(); };
    var join = function (keys) { return keys.map(low).filter(Boolean).join(', '); };
    var look = [];
    if (value('estatura')) look.push('estatura ' + value('estatura'));
    if (value('peso')) look.push('peso ' + value('peso'));
    if (value('complexion')) look.push('complexión ' + low('complexion'));
    if (value('tez')) look.push('piel ' + low('tez'));
    if (join(['cabello', 'cabello_tipo', 'cabello_largo'])) look.push('cabello ' + join(['cabello', 'cabello_tipo', 'cabello_largo']));
    if (value('ojos') || value('ojos_tamano')) look.push('ojos ' + [low('ojos'), low('ojos_tamano')].filter(Boolean).join(' y '));
    if (value('boca')) look.push('boca ' + low('boca'));
    if (value('labios')) look.push('labios ' + low('labios'));
    if (value('ocupacion')) look.push('ocupación ' + low('ocupacion'));
    if (look.length) {
      var lookText = look.join(', ');
      rows.push({ label: data.fields.rasgos, text: lookText.charAt(0).toUpperCase() + lookText.slice(1) });
    }
    if (value('senas')) rows.push({ label: data.fields.senas, text: value('senas') });
    if (value('vestimenta')) rows.push({ label: data.fields.vestimenta, text: value('vestimenta') });
    if (value('hechos')) rows.push({ label: data.table.hechos, text: value('hechos') });
    if (value('extra')) rows.push({ label: data.fields.otro, text: value('extra') });
    // On the post the space beside the photo would stay empty, so "last seen" goes there if it
    // fits whole; otherwise it goes below with the rest. Nothing important may be cut off, which
    // is also why the health-risk row always stays full width below the photo.
    if (!story && sideY < photoY + photoH - 120 && rows.length && rows[0].label === data.fields.visto) {
      if (drawRows([rows[0]], textX, sideY, textW, photoY + photoH - sideY, true) >= 0) rows.shift();
    }
    if (rows.length) drawRows(rows, margin, y, W - margin * 2, footerY - y - 20);

    if (opts && opts.watermark) drawWatermark(opts.watermark, W, H);
    sample = null;
  }

  // Example flyer: invented data and the stand-in photo, drawn with the same code as the real one.
  var exampleEl = document.getElementById('ficha-ejemplo');
  if (exampleEl && data.example) {
    var examplePhoto = new Image();
    var drawExample = function (img) {
      draw(img, data.formats[0], { canvas: document.getElementById('ficha-ejemplo-canvas'), values: data.example.values, watermark: data.example.watermark });
      exampleEl.hidden = false;
    };
    examplePhoto.onload = function () { drawExample(examplePhoto); };
    examplePhoto.onerror = function () { drawExample(null); };
    examplePhoto.src = data.example.photo;
  }

  function loadBitmap(file) {
    if (!file) return Promise.resolve(null);
    if (window.createImageBitmap) return createImageBitmap(file);
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('image')); };
      img.src = url;
    });
  }

  function chosenFormat() {
    var id = form.querySelector('input[name=formato]:checked').value;
    for (var i = 0; i < data.formats.length; i++) if (data.formats[i].id === id) return data.formats[i];
    return data.formats[0];
  }

  function toBlob(callback) {
    if (canvas.toBlob) canvas.toBlob(callback, 'image/png');
    else callback(null);
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    errorEl.hidden = true;
    if (!value('nombre')) {
      errorEl.textContent = data.needName;
      errorEl.hidden = false;
      return;
    }
    var file = form.elements.foto.files && form.elements.foto.files[0];
    loadBitmap(file).then(function (bitmap) {
      draw(bitmap, chosenFormat());
      result.hidden = false;
      canvas.scrollIntoView();
    }, function () {
      draw(null, chosenFormat());
      result.hidden = false;
    });
  });

  function fileName() {
    var base = value('nombre').toLowerCase().normalize ? value('nombre').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') : value('nombre').toLowerCase();
    return 'se-busca-' + (base.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'ficha') + '.png';
  }

  document.getElementById('ficha-descargar').addEventListener('click', function () {
    toBlob(function (blob) {
      if (!blob) return;
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = fileName();
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    });
  });

  // The share sheet (WhatsApp, Instagram, …) only exists on phones that can share files.
  if (navigator.canShare && navigator.share && window.File) {
    try {
      if (navigator.canShare({ files: [new File([''], 'a.png', { type: 'image/png' })] })) shareBtn.hidden = false;
    } catch (e) { /* not supported */ }
  }
  shareBtn.addEventListener('click', function () {
    toBlob(function (blob) {
      if (!blob) return;
      var file = new File([blob], fileName(), { type: 'image/png' });
      navigator.share({ files: [file] }).catch(function () {});
    });
  });
})();
