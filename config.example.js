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
  API_BASE: 'https://script.google.com/macros/s/PASTE_YOUR_DEPLOYMENT_ID_HERE/exec'
};
