// ──────────────────────────────────────────────────────────────
// Code.gs – Technopaths Quota Backend (Google Apps Script)
// FIXED VERSION – see README "What was broken" section
// ──────────────────────────────────────────────────────────────

// ─── CONFIG ──────────────────────────────────────────────────
// Never hardcode the Spreadsheet ID in source. It's read from this
// project's Script Properties (Apps Script's equivalent of a .env file)
// so the same code can be copy-pasted into any deployment safely.
//
// To set it: open this project → gear icon "Project Settings" (left
// sidebar) → scroll to "Script Properties" → Add script property →
// key = SPREADSHEET_ID, value = your sheet's ID (see README for how to
// find it) → Save.
const SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
const SHEET_QUOTATIONS = 'Quotations';
const SHEET_ITEMS      = 'Quotation Items';
const SHEET_USERS      = 'Users';

function assertConfigured_() {
  if (!SPREADSHEET_ID) {
    throw new Error('SPREADSHEET_ID script property is not set. See README → Deployment.');
  }
}

// ─── doGet – handle GET requests (fetch data) ──────────────
function doGet(e) {
  try {
    assertConfigured_();
    const action = e.parameter.action;
    const id     = e.parameter.id;

    if (action === 'getAllQuotes') {
      return returnJson(getAllQuotations());
    } else if (action === 'getQuote' && id) {
      return returnJson(getQuoteById(id));
    } else if (action === 'getDashboardStats') {
      return returnJson(getDashboardStats());
    } else {
      return returnJson({ error: 'Invalid or missing action parameter' });
    }
  } catch (err) {
    return returnJson({ error: 'Server error: ' + err.message });
  }
}

// ─── doPost – handle POST requests (create, update, delete) ──
function doPost(e) {
  try {
    assertConfigured_();
    if (!e.postData || !e.postData.contents) {
      return returnJson({ error: 'No data received' });
    }
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    if (action === 'createQuote') {
      return returnJson(createNewQuote(data));
    } else if (action === 'updateStatus') {
      return returnJson(updateQuoteStatus(data.id, data.status));
    } else if (action === 'deleteQuote') {
      return returnJson(deleteQuote(data.id));
    } else {
      return returnJson({ error: 'Invalid action' });
    }
  } catch (err) {
    // Always return valid JSON, even on failure, so the frontend can parse it
    return returnJson({ error: err.message || 'Unknown server error' });
  }
}

// Some browsers send a CORS preflight OPTIONS request. Apps Script web apps
// can't fully customize preflight responses, so the frontend avoids
// triggering one (see script.js apiPost — uses text/plain content type).
// This handler is just a harmless safety net.
function doOptions(e) {
  return ContentService.createTextOutput('');
}

// ─── HELPER: return JSON ──────────────────────────────────────
// IMPORTANT: ContentService.TextOutput has NO setHeader()/statusCode API.
// The previous version called output.setHeader(...) which throws
// "TypeError: output.setHeader is not a function" on every single request —
// that crash is what produced the HTML error page the frontend was
// choking on ("Network error" / broken JSON.parse). Apps Script web apps
// deployed with "Who has access: Anyone" already return CORS-permissive
// responses by default, so no manual header is needed.
function returnJson(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── SHEET HELPERS ──────────────────────────────────────────
function getSheet(sheetName) {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);
}

function getNextId(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 1;
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat().filter(v => typeof v === 'number');
  return ids.length ? Math.max(...ids) + 1 : 1;
}

// Converts a sheet's rows into an array of objects, trimming header
// whitespace so keys like " Date Created" become "Date Created".
// (The real spreadsheet has stray leading/trailing spaces in some
// headers — trimming here avoids having to touch the sheet at all.)
function sheetToObjects(sheet) {
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length < 1) return [];
  const rawHeaders = values.shift();
  const headers = rawHeaders.map(h => String(h).trim());
  return values
    .filter(row => row.join('') !== '') // skip fully blank rows
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });
}

// ─── FETCH ALL QUOTATIONS (with items) ─────────────────────
function getAllQuotations() {
  const quoteSheet = getSheet(SHEET_QUOTATIONS);
  const itemSheet  = getSheet(SHEET_ITEMS);
  if (!quoteSheet || !itemSheet) return [];

  const quotes = sheetToObjects(quoteSheet);
  quotes.forEach(q => {
    q.items = getItemsForQuote(q['Quote Number']);
  });
  return quotes;
}

function getItemsForQuote(quoteNumber) {
  const sheet = getSheet(SHEET_ITEMS);
  if (!sheet) return [];
  const items = sheetToObjects(sheet).filter(row => row['Quote Number'] === quoteNumber);
  // The live sheet's item column is named "Description", but the frontend
  // reads "Item Description". Alias it so both names always work.
  items.forEach(item => {
    if (item['Description'] !== undefined && item['Item Description'] === undefined) {
      item['Item Description'] = item['Description'];
    }
  });
  return items;
}

// ─── GET SINGLE QUOTE BY ID ──────────────────────────────
function getQuoteById(id) {
  const all = getAllQuotations();
  return all.find(q => String(q.ID) === String(id)) || null;
}

// ─── DASHBOARD STATS ──────────────────────────────────────
function getDashboardStats() {
  const all = getAllQuotations();
  const totalQuotes = all.length;
  const clients = new Set(all.map(q => q['Client Name']).filter(Boolean));
  const totalClients = clients.size;

  const today = new Date();
  const expiringThisWeek = all.filter(q => {
    if (!q['Date Expires']) return false;
    const expDate = new Date(q['Date Expires']);
    const diffDays = (expDate - today) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= 7;
  }).length;

  const totalRevenue = all.reduce((sum, q) => sum + (parseFloat(q['Grand Total']) || 0), 0);

  const recent = all
    .slice()
    .sort((a, b) => new Date(b['Created At']) - new Date(a['Created At']))
    .slice(0, 5);

  return {
    totalQuotes,
    totalClients,
    expiringThisWeek,
    totalRevenue,
    recentQuotes: recent
  };
}

// ─── VALIDATION ───────────────────────────────────────────
function validateQuoteData(data) {
  const errors = [];
  if (!data.clientName || !String(data.clientName).trim()) errors.push('Client Name is required');
  if (!data.items || !data.items.length) errors.push('At least one quotation item is required');
  return errors;
}

// ─── CREATE NEW QUOTATION ────────────────────────────────
function createNewQuote(data) {
  const errors = validateQuoteData(data);
  if (errors.length) {
    return { success: false, error: errors.join(', ') };
  }

  const quoteSheet = getSheet(SHEET_QUOTATIONS);
  const itemSheet  = getSheet(SHEET_ITEMS);
  if (!quoteSheet || !itemSheet) return { success: false, error: 'Sheets not found. Check SPREADSHEET_ID.' };

  const now = new Date();
  const dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMdd');
  const nextId = getNextId(quoteSheet);
  const quoteNumber = `QUOTE-${dateStr}-${String(nextId).padStart(3, '0')}`;

  const quoteRow = [
    nextId,
    quoteNumber,
    data.dateCreated || Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    data.dateExpires || '',
    data.service || '',
    data.clientType || '',
    data.clientName || '',
    data.clientEmail || '',
    data.clientPhone || '',
    data.clientAddress || '',
    data.clientCompany || '',
    parseFloat(data.subtotal) || 0,
    parseFloat(data.tax) || 0,
    parseFloat(data.grandTotal) || 0,
    data.status || 'Active',
    data.notes || '',
    Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')
  ];
  quoteSheet.appendRow(quoteRow);

  if (data.items && data.items.length) {
    data.items.forEach(item => {
      const itemRow = [
        getNextId(itemSheet),
        quoteNumber,
        item.description || '',
        parseInt(item.quantity, 10) || 0,
        parseFloat(item.unitPrice) || 0,
        parseFloat(item.total) || 0,
        Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')
      ];
      itemSheet.appendRow(itemRow);
    });
  }

  return { success: true, quoteNumber, id: nextId };
}

// ─── UPDATE STATUS (e.g. approve a draft) ─────────────────
function updateQuoteStatus(id, status) {
  const sheet = getSheet(SHEET_QUOTATIONS);
  if (!sheet) return { success: false, error: 'Sheet not found' };
  const data = sheet.getDataRange().getValues();
  const headers = data.shift().map(h => String(h).trim());
  const colIndex = headers.indexOf('Status') + 1;
  const idIndex = headers.indexOf('ID') + 1;
  let found = false;
  data.forEach((row, idx) => {
    if (String(row[idIndex - 1]) === String(id)) {
      sheet.getRange(idx + 2, colIndex).setValue(status);
      found = true;
    }
  });
  return { success: found };
}

// ─── DELETE QUOTE (and its items) ──────────────────────
function deleteQuote(id) {
  const quoteSheet = getSheet(SHEET_QUOTATIONS);
  const itemSheet  = getSheet(SHEET_ITEMS);
  if (!quoteSheet || !itemSheet) return { success: false, error: 'Sheets not found' };

  const all = getAllQuotations();
  const quote = all.find(q => String(q.ID) === String(id));
  if (!quote) return { success: false, error: 'Quote not found' };
  const quoteNumber = quote['Quote Number'];

  const itemData = itemSheet.getDataRange().getValues();
  const itemHeaders = itemData.shift().map(h => String(h).trim());
  const quoteNumCol = itemHeaders.indexOf('Quote Number') + 1;
  const rowsToDelete = [];
  itemData.forEach((row, idx) => {
    if (row[quoteNumCol - 1] === quoteNumber) rowsToDelete.push(idx + 2);
  });
  rowsToDelete.sort((a, b) => b - a).forEach(row => itemSheet.deleteRow(row));

  const quoteData = quoteSheet.getDataRange().getValues();
  const quoteHeaders = quoteData.shift().map(h => String(h).trim());
  const idCol = quoteHeaders.indexOf('ID') + 1;
  let rowToDelete = -1;
  quoteData.forEach((row, idx) => {
    if (String(row[idCol - 1]) === String(id)) rowToDelete = idx + 2;
  });
  if (rowToDelete > -1) quoteSheet.deleteRow(rowToDelete);

  return { success: true };
}
