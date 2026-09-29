// Saves the guide on the phone so it works without signal (see sw.js).
// Service workers only run over https or localhost, never from a file:// page.
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(function () {});
}
