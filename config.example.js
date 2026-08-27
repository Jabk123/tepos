// config.example.js
// ──────────────────────────────────────────────────────────────
// Copy this file to "config.js" and fill in your real values.
// config.js is listed in .gitignore, so it never gets committed —
// this is the frontend equivalent of a .env file for a static site
// (browsers can't read a real .env at runtime on GitHub Pages).
//
//   cp config.example.js config.js
//
// See README.md → "Finding your Spreadsheet ID and Web App URL"
// for exactly where each value comes from.
// ──────────────────────────────────────────────────────────────
window.TQ_CONFIG = {
  // Your deployed Google Apps Script Web App URL, ending in /exec
  API_BASE: 'https://script.google.com/macros/s/AKfycby3VnGK2SK6h8Ggll_gsRCCKSoM9Y2-rmjbKe79XqPPX77FrUfm3fdriRu3e0dya1FV/exec'
};
