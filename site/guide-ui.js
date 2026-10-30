// Guided questions UI. Bundled by scripts/build.mjs after guide-logic (selectSteps).
// Answers live only in this page's memory: nothing is stored, sent or put in the URL.
var form = document.getElementById('guia-form');
var dataEl = document.getElementById('guia-datos');
if (form && dataEl) {
  var data = JSON.parse(dataEl.textContent);
  var results = document.getElementById('guia-resultados');
  var list = document.getElementById('guia-lista');
  var title = document.getElementById('guia-titulo');
  var otherState = document.getElementById('guia-otro');
  var cards = {};
  var nodes = list.querySelectorAll('[data-key]');
  for (var i = 0; i < nodes.length; i++) cards[nodes[i].getAttribute('data-key')] = nodes[i];

  form.hidden = false;
  document.getElementById('guia-sinjs').hidden = true;

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var answers = {};
    var inputs = form.querySelectorAll('input[type=radio]:checked, select');
    for (var j = 0; j < inputs.length; j++) answers[inputs[j].name] = inputs[j].value;

    var keys = selectSteps({ steps: data.steps }, answers, data.stateItems);
    for (var key in cards) cards[key].hidden = true;
    for (var k = 0; k < keys.length; k++) {
      var card = cards[keys[k]];
      if (!card) continue;
      list.appendChild(card); // re-append in the order the steps apply
      card.hidden = false;
    }
    // A state was chosen but the guide has no page for it yet: say the national channels apply.
    otherState.hidden = !answers.estado || !!data.stateItems[answers.estado];
    results.hidden = false;
    title.focus();
    title.scrollIntoView();
  });

  document.getElementById('guia-reiniciar').addEventListener('click', function () {
    form.reset();
    results.hidden = true;
    for (var key in cards) cards[key].hidden = true;
    window.scrollTo(0, 0);
  });
}
