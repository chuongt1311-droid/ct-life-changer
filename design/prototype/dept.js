/* Life Changer prototype — Performance Department.
   Synthetic demo day; no real data. Plan 5 replaces this with the app. */

(function () {
  'use strict';

  // The countdown is the one number that must never shuffle width or go stale
  // while the screen sits open on a desk.
  var el = document.querySelector('[data-countdown]');
  if (el) {
    var left = parseInt(el.getAttribute('data-countdown'), 10);
    setInterval(function () {
      if (left <= 0) return;
      left -= 1;
      el.textContent = left + (left === 1 ? ' min' : ' min');
    }, 60000);
  }

  // Skip links empty their section rather than hiding it: a skipped section
  // still counts, and CT can come back to it.
  Array.prototype.forEach.call(document.querySelectorAll('.skip'), function (btn) {
    btn.addEventListener('click', function () {
      var group = btn.closest('.field');
      if (!group) return;
      Array.prototype.forEach.call(group.querySelectorAll('textarea, input'), function (input) {
        if (input.type === 'checkbox' || input.type === 'radio') input.checked = false;
        else input.value = '';
      });
      btn.textContent = 'Skipped — undo';
      btn.disabled = false;
    });
  });

  // The composer grows with the message instead of scrolling inside 52px.
  var ask = document.getElementById('ask');
  if (ask) {
    ask.addEventListener('input', function () {
      ask.style.height = 'auto';
      ask.style.height = Math.min(ask.scrollHeight, 160) + 'px';
    });
  }
})();
