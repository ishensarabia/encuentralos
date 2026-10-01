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

  function value(name) {
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
  function drawRows(rows, x, y, width, height) {
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
        layout.push({ label: rows[i].label, lines: lines, labelWidth: labelWidth });
        total += lines.length * size * 1.28 + size * 0.4;
      }
      if (total <= height) break;
    }
    var cursor = y;
    var bottom = y + height;
    for (var r = 0; r < layout.length; r++) {
      for (var l = 0; l < layout[r].lines.length; l++) {
        if (cursor + size > bottom) return cursor;
        var text = layout[r].lines[l];
        var last = cursor + size * 1.28 + size > bottom && (l < layout[r].lines.length - 1 || r < layout.length - 1);
        if (last) text += '…';
        ctx.fillStyle = '#111';
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

  function draw(bitmap, fmt) {
    var W = fmt.w;
    var H = fmt.h;
    var margin = 60;
    canvas.width = W;
    canvas.height = H;
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
    var photoH = story ? Math.round(H * 0.34) : 520;
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
    var maxLines = story ? 2 : 4;
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
    if (age) {
      ctx.font = '700 ' + Math.round(nameFont * 0.7) + 'px ' + FONT;
      ctx.fillText(age + (age === '1' ? ' año' : ' años'), textX, y + nameFont * 0.8);
      y += nameFont * 0.95;
    }
    // The details start below the photo (post) or the name (story)
    y = story ? y + 20 : Math.max(y, photoY + photoH) + 30;

    // Footer with the contact phone
    var phone = value('telefono');
    var footerH = Math.round(H * 0.15);
    var footerY = H - footerH;
    ctx.fillStyle = '#0b5d57';
    ctx.fillRect(0, footerY, W, footerH);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = '700 ' + Math.round(footerH * 0.2) + 'px ' + FONT;
    ctx.fillText(data.foot, W / 2, footerY + footerH * 0.3, W - margin);
    if (phone) {
      ctx.font = '800 ' + Math.round(footerH * 0.38) + 'px ' + FONT;
      ctx.fillText(phone, W / 2, footerY + footerH * 0.76, W - margin);
    }
    ctx.textAlign = 'left';

    // Details between the name and the footer
    // Where and when she was last seen goes first: it is what people who see the flyer need most.
    var rows = [];
    var seen = [];
    if (value('fecha')) seen.push(longDate(value('fecha')));
    if (value('lugar')) seen.push(value('lugar'));
    if (seen.length) rows.push({ label: data.fields.visto, text: seen.join(', ') });
    if (value('senas')) rows.push({ label: data.fields.senas, text: value('senas') });
    if (value('vestimenta')) rows.push({ label: data.fields.vestimenta, text: value('vestimenta') });
    if (value('extra')) rows.push({ label: data.fields.otro, text: value('extra') });
    if (rows.length) drawRows(rows, margin, y, W - margin * 2, footerY - y - 20);
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
