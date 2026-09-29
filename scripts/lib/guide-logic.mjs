// Decides which steps the guided questions show. Shared by the tests (Node) and the
// browser: scripts/build.mjs strips the `export` keywords and bundles this file into
// guia.js, so keep it dependency-free and in plain ES2015 (older Android browsers).

// A step applies when every question in `when` was answered with one of the listed
// options. An unanswered question never hides a step: when unsure, show more.
export function stepApplies(step, answers) {
  var when = step.when || {};
  for (var question in when) {
    if (!Object.prototype.hasOwnProperty.call(when, question)) continue;
    var answer = answers[question];
    if (answer === undefined || answer === null || answer === '') continue;
    if (when[question].indexOf(answer) === -1) return false;
  }
  return true;
}

// Returns ordered, de-duplicated keys: "item:<id>" or "section:<id>".
// stateItems: { <stateId>: { agency: [itemIds], note: [itemIds] } }
export function selectSteps(guide, answers, stateItems) {
  var keys = [];
  var seen = {};
  function add(key) {
    if (!seen[key]) {
      seen[key] = true;
      keys.push(key);
    }
  }
  for (var i = 0; i < guide.steps.length; i++) {
    var step = guide.steps[i];
    if (!stepApplies(step, answers)) continue;
    if (step.item) add('item:' + step.item);
    else if (step.section) add('section:' + step.section);
    else if (step.state) {
      var state = stateItems[answers.estado];
      var ids = (state && state[step.state]) || [];
      for (var j = 0; j < ids.length; j++) add('item:' + ids[j]);
    }
  }
  return keys;
}
