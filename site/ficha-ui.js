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
  function drawRows(rows, x, y, width, height, strict) {
    var size = 46;
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
    var story = H > 1500;
    var photoY = bannerH + 30;
    var photoW = story ? W - margin * 2 : 420;
    var photoH = story ? Math.round(H * 0.28) : 520;
    ctx.fillStyle = '#e6e6e6';
    ctx.fillRect(margin, photoY, photoW, photoH);
    if (bitmap) {
      var scale = Math.max(photoW / bitmap.width, photoH / bitmap.height);
      var sw = photoW / scale;
      var sh = photoH / scale;
      var sx = (bitmap.width - sw) / 2;
      var sy = (bitmap.height - sh) * 0.25;
      ctx.drawImage(bitmap, sx, sy, sw, sh, margin, photoY, photoW, photoH);
    }

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

    // Footer with the contact phone
    var phone = value('telefono');
    // Second footer line: who answers and the case folio, small so the phone stays the biggest thing
    var contact = [];
    if (value('contacto')) contact.push(value('contacto'));
    if (value('folio')) contact.push(data.folioLabel + ': ' + value('folio'));
    var footerH = Math.round(H * (contact.length ? 0.18 : 0.15));
    var footerY = H - footerH;
    ctx.fillStyle = '#0b5d57';
    ctx.fillRect(0, footerY, W, footerH);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = '700 ' + Math.round(footerH * (contact.length ? 0.16 : 0.2)) + 'px ' + FONT;
    ctx.fillText(data.foot, W / 2, footerY + footerH * (contact.length ? 0.24 : 0.3), W - margin);
    if (phone) {
      ctx.font = '800 ' + Math.round(footerH * (contact.length ? 0.31 : 0.38)) + 'px ' + FONT;
      ctx.fillText(phone, W / 2, footerY + footerH * (contact.length ? 0.6 : 0.76), W - margin);
    }
    if (contact.length) {
      ctx.font = '700 ' + Math.round(footerH * 0.15) + 'px ' + FONT;
      ctx.fillText(contact.join('  ·  '), W / 2, footerY + footerH * 0.87, W - margin);
    }
    ctx.textAlign = 'left';

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
    var look = [];
    if (value('estatura')) look.push('estatura ' + value('estatura'));
    if (value('complexion')) look.push('complexión ' + value('complexion').toLowerCase());
    if (value('tez')) look.push('piel ' + value('tez').toLowerCase());
    if (value('cabello')) look.push('cabello ' + value('cabello'));
    if (value('ojos')) look.push('ojos ' + value('ojos'));
    if (look.length) {
      var lookText = look.join(', ');
      rows.push({ label: data.fields.rasgos, text: lookText.charAt(0).toUpperCase() + lookText.slice(1) });
    }
    if (value('senas')) rows.push({ label: data.fields.senas, text: value('senas') });
    if (value('vestimenta')) rows.push({ label: data.fields.vestimenta, text: value('vestimenta') });
    if (value('extra')) rows.push({ label: data.fields.otro, text: value('extra') });
    // On the post the space beside the photo would stay empty, so "last seen" goes there if it
    // fits whole; otherwise it goes below with the rest. Nothing important may be cut off, which
    // is also why the health-risk row always stays full width below the photo.
    if (!story && sideY < photoY + photoH - 120 && rows.length && rows[0].label === data.fields.visto) {
      if (drawRows([rows[0]], textX, sideY, textW, photoY + photoH - sideY, true) >= 0) rows.shift();
    }
    if (rows.length) drawRows(rows, margin, y, W - margin * 2, footerY - y - 20);

    // A watermark across the example, so a screenshot of it can never pass as a real search
    if (opts && opts.watermark) {
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.rotate(-Math.PI / 7);
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = '#a3001b';
      ctx.textAlign = 'center';
      ctx.font = '900 ' + Math.round(W * 0.22) + 'px ' + FONT;
      ctx.fillText(opts.watermark, 0, W * 0.07, W * 1.2);
      ctx.restore();
    }
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
