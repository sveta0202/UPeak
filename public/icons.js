(function () {
  var SPRITE_ID = "upeak-icon-sprite";

  // Apple SF Symbols-inspired glyphs. Names mirror SF Symbols where possible.
  // Each symbol uses currentColor for stroke/fill and is sized via 1em by default.
  var SVG = [
    '<svg xmlns="http://www.w3.org/2000/svg" id="' + SPRITE_ID + '" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">',

    // calendar
    '<symbol id="sf-calendar" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">',
    '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/>',
    '<line x1="3.5" y1="9.5" x2="20.5" y2="9.5"/>',
    '<line x1="8" y1="3" x2="8" y2="6.5"/>',
    '<line x1="16" y1="3" x2="16" y2="6.5"/>',
    '</symbol>',

    // exclamationmark.triangle
    '<symbol id="sf-warning" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">',
    '<path d="M12 4 L21 19.5 L3 19.5 Z"/>',
    '<line x1="12" y1="10" x2="12" y2="14.5"/>',
    '<circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none"/>',
    '</symbol>',

    // face.frowning (sad)
    '<symbol id="sf-sad" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">',
    '<circle cx="12" cy="12" r="9"/>',
    '<circle cx="9" cy="10.5" r="0.9" fill="currentColor" stroke="none"/>',
    '<circle cx="15" cy="10.5" r="0.9" fill="currentColor" stroke="none"/>',
    '<path d="M8.5 16.5 C 10 14.8, 14 14.8, 15.5 16.5"/>',
    '</symbol>',

    // moon.zzz (sleep)
    '<symbol id="sf-sleep" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">',
    '<path d="M20 14.5 A8 8 0 1 1 9.5 4 A6.5 6.5 0 0 0 20 14.5 Z"/>',
    '</symbol>',

    // bolt (energy)
    '<symbol id="sf-bolt" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">',
    '<path d="M13.5 3 L5.5 13.5 L11 13.5 L10.5 21 L18.5 10.5 L13 10.5 Z" fill="currentColor" stroke="currentColor"/>',
    '</symbol>',

    // wind / waves (stress)
    '<symbol id="sf-stress" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">',
    '<path d="M3 8 H14 A3 3 0 1 0 11 5"/>',
    '<path d="M3 13 H17 A3 3 0 1 1 14 16"/>',
    '<path d="M3 18 H10"/>',
    '</symbol>',

    // list.bullet.clipboard (plan)
    '<symbol id="sf-list" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">',
    '<rect x="5" y="4.5" width="14" height="16" rx="2.5"/>',
    '<rect x="9" y="3" width="6" height="3.5" rx="1"/>',
    '<line x1="8.5" y1="11" x2="15.5" y2="11"/>',
    '<line x1="8.5" y1="14.5" x2="15.5" y2="14.5"/>',
    '<line x1="8.5" y1="18" x2="13" y2="18"/>',
    '</symbol>',

    // chart.bar (patterns)
    '<symbol id="sf-chart" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">',
    '<line x1="3.5" y1="20" x2="20.5" y2="20"/>',
    '<rect x="5.5" y="12" width="3" height="7" rx="0.7"/>',
    '<rect x="10.5" y="8" width="3" height="11" rx="0.7"/>',
    '<rect x="15.5" y="14" width="3" height="5" rx="0.7"/>',
    '</symbol>',

    // chart.line.uptrend.xyaxis (influence)
    '<symbol id="sf-trend" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">',
    '<polyline points="3.5,17 9,11.5 12.5,14.5 20,6.5"/>',
    '<polyline points="15.5,6.5 20,6.5 20,11"/>',
    '</symbol>',

    // target / scope
    '<symbol id="sf-target" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">',
    '<circle cx="12" cy="12" r="8.5"/>',
    '<circle cx="12" cy="12" r="5"/>',
    '<circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
    '</symbol>',

    // microscope / flask (research)
    '<symbol id="sf-flask" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">',
    '<path d="M9 3 H15"/>',
    '<path d="M10 3 V10 L5 19 A2 2 0 0 0 6.7 21.5 H17.3 A2 2 0 0 0 19 19 L14 10 V3"/>',
    '<line x1="8" y1="15" x2="16" y2="15"/>',
    '</symbol>',

    // globe (language)
    '<symbol id="sf-globe" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">',
    '<circle cx="12" cy="12" r="9"/>',
    '<ellipse cx="12" cy="12" rx="4" ry="9"/>',
    '<line x1="3" y1="12" x2="21" y2="12"/>',
    '</symbol>',

    // ellipsis
    '<symbol id="sf-ellipsis" viewBox="0 0 24 24" fill="currentColor">',
    '<circle cx="6" cy="12" r="1.6"/>',
    '<circle cx="12" cy="12" r="1.6"/>',
    '<circle cx="18" cy="12" r="1.6"/>',
    '</symbol>',

    // mountain.2 (logo placeholder)
    '<symbol id="sf-mountain" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">',
    '<path d="M3 19 L9 9 L13 14 L16 10 L21 19 Z" fill="currentColor" fill-opacity="0.15"/>',
    '</symbol>',
    '</svg>'
  ].join("");

  function inject() {
    if (document.getElementById(SPRITE_ID)) return;
    var holder = document.createElement("div");
    holder.style.display = "none";
    holder.innerHTML = SVG;
    document.body.insertBefore(holder.firstChild, document.body.firstChild);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inject);
  } else {
    inject();
  }
})();
