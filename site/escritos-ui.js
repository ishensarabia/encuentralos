// Documents for authorities. Bundled by scripts/build.mjs after escritos-logic (buildEscrito).
// What the person types stays in this page's memory: nothing is stored, sent or put in the URL.
var form = document.getElementById('escritos-form');
var dataEl = document.getElementById('escritos-datos');
if (form && dataEl) {
  var data = JSON.parse(dataEl.textContent);
  var wraps = form.querySelectorAll('.field-wrap');
  var result = document.getElementById('escritos-resultado');
  var textEl = document.getElementById('escritos-texto');
  var titleEl = document.getElementById('escritos-titulo');
  var missingEl = document.getElementById('escritos-faltan');
  var copyBtn = document.getElementById('escritos-copiar');

  form.hidden = false;
  document.getElementById('escritos-sinjs').hidden = true;

  function currentType() {
    var checked = form.querySelector('input[name=tipo]:checked');
    return checked ? checked.value : 'reporte';
  }

  // Show only the fields the chosen document uses. Hidden fields are not required.
  function showFields() {
    var type = currentType();
    for (var i = 0; i < wraps.length; i++) {
      var applies = (' ' + wraps[i].getAttribute('data-types') + ' ').indexOf(' ' + type + ' ') !== -1;
      wraps[i].hidden = !applies;
      var control = wraps[i].querySelector('input, textarea');
      var id = control.getAttribute('name');
      if (data.campos[id] && data.campos[id].required) control.required = applies;
    }
  }

  function readValues() {
    var values = {};
    var controls = form.querySelectorAll('input[name], textarea[name]');
    for (var i = 0; i < controls.length; i++) {
      if (controls[i].type !== 'radio') values[controls[i].name] = controls[i].value;
    }
    return values;
  }

  var radios = form.querySelectorAll('input[name=tipo]');
  for (var r = 0; r < radios.length; r++) radios[r].addEventListener('change', showFields);
  showFields();

  var built = null;
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var type = currentType();
    var today = new Date();
    var iso = today.getFullYear() + '-' + ('0' + (today.getMonth() + 1)).slice(-2) + '-' + ('0' + today.getDate()).slice(-2);
    built = buildEscrito(type, readValues(), data.escritos[type], data.campos, data.fund, iso);
    textEl.textContent = built.text;
    titleEl.textContent = built.title;
    if (built.missing.length) {
      missingEl.textContent = built.missing.length === 1 ? data.missingOne : data.missingMany.replace('{n}', built.missing.length);
      missingEl.hidden = false;
    } else {
      missingEl.hidden = true;
    }
    form.hidden = true;
    result.hidden = false;
    titleEl.focus();
    window.scrollTo(0, 0);
  });

  document.getElementById('escritos-volver').addEventListener('click', function () {
    result.hidden = true;
    form.hidden = false;
    window.scrollTo(0, 0);
  });

  document.getElementById('escritos-imprimir').addEventListener('click', function () {
    window.print();
  });

  document.getElementById('escritos-descargar').addEventListener('click', function () {
    if (!built) return;
    var blob = new Blob([built.text], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'escrito.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  });

  copyBtn.addEventListener('click', function () {
    if (!built) return;
    var label = copyBtn.textContent;
    function done() {
      copyBtn.textContent = data.copied;
      setTimeout(function () { copyBtn.textContent = label; }, 1500);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(built.text).then(done, selectText);
    } else {
      selectText();
    }
    // Fallback for browsers without the clipboard API: select the text so it can be copied by hand.
    function selectText() {
      var range = document.createRange();
      range.selectNodeContents(textEl);
      var selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
  });
}
