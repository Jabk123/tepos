// ──────────────────────────────────────────────────────────────
// script.js – Technopaths Quota Frontend
// FIXED VERSION – see README "What was broken" section
// ──────────────────────────────────────────────────────────────

// API_BASE and login credentials come from config.js (loaded before this
// file, and gitignored so real values never get committed). See
// config.example.js for the template and the README for how to fill it in.
const API_BASE = (window.TQ_CONFIG && window.TQ_CONFIG.API_BASE) || '';

if (!API_BASE) {
  console.error('Missing config.js — copy config.example.js to config.js and fill in API_BASE.');
}

// ─── AUTH ────────────────────────────────────────────────────
function checkAuth() {
  if (!sessionStorage.getItem('tq_logged_in')) {
    window.location.href = 'index.html';
    return;
  }
  const name = sessionStorage.getItem('tq_full_name') || sessionStorage.getItem('tq_username') || 'User';
  document.querySelectorAll('#usernameDisplay').forEach(el => el.textContent = name);
  renderNav();
}

// ─── NAVIGATION (sidebar on desktop, top bar + bottom tabs on mobile) ──
// Rendered once from JS so every page shares exactly one nav definition —
// this also fixes the old bug where dashboard/create-quote/view-quotes/
// quote-details never loaded bootstrap.bundle.js, so the navbar toggler
// and modals silently did nothing on mobile.
function renderNav() {
  const mount = document.getElementById('tqNav');
  if (!mount) return;

  const page = document.body.dataset.page || '';
  const name = sessionStorage.getItem('tq_full_name') || sessionStorage.getItem('tq_username') || 'User';
  const initial = name.trim().charAt(0).toUpperCase() || 'U';

  const items = [
    { key: 'dashboard', href: 'dashboard.html', icon: 'bi-speedometer2', label: 'Dashboard' },
    { key: 'create', href: 'create-quote.html', icon: 'bi-plus-circle', label: 'New Quote' },
    { key: 'view', href: 'view-quotes.html', icon: 'bi-list-ul', label: 'All Quotes' }
  ];

  const sidebarItems = items.map(it => `
    <a class="tq-nav-item ${page === it.key ? 'active' : ''}" href="${it.href}">
      <span class="tq-node"></span><i class="bi ${it.icon}"></i> ${it.label}
    </a>`).join('');

  const bottomItems = items.map(it => `
    <a class="tq-bottomnav-item ${page === it.key ? 'active' : ''}" href="${it.href}">
      <i class="bi ${it.icon}"></i><span>${it.label}</span>
    </a>`).join('') + `
    <a class="tq-bottomnav-item" href="#" id="logoutBtn">
      <i class="bi bi-box-arrow-right"></i><span>Logout</span>
    </a>`;

  mount.innerHTML = `
    <aside class="tq-sidebar">
      <div class="tq-logo">Technopaths <span>Quota</span></div>
      <div class="tq-tagline">Technopaths Entity</div>
      <nav class="tq-nav-path">${sidebarItems}</nav>
      <div class="tq-sidebar-footer">
        <div class="tq-user">
          <div class="tq-user-avatar">${initial}</div>
          <div><div class="tq-user-name">${name}</div><div class="tq-user-role">Administrator</div></div>
        </div>
        <a href="#" class="tq-logout-link" id="logoutBtn"><i class="bi bi-box-arrow-right"></i> Logout</a>
      </div>
    </aside>
    <header class="tq-topbar">
      <div class="tq-logo">Technopaths <span>Quota</span></div>
      <a href="#" class="tq-topbar-logout" id="logoutBtn"><i class="bi bi-box-arrow-right"></i></a>
    </header>
    <nav class="tq-bottomnav"><div class="tq-bottomnav-inner">${bottomItems}</div></nav>
  `;
}

// ─── LOGOUT ─────────────────────────────────────────────────
document.addEventListener('click', function (e) {
  if (e.target.id === 'logoutBtn' || e.target.closest('#logoutBtn')) {
    e.preventDefault();
    sessionStorage.clear();
    window.location.href = 'index.html';
  }
});

// ─── TOAST NOTIFICATIONS (replaces alert() for a more professional feel) ──
function ensureToastContainer() {
  let c = document.getElementById('tqToastContainer');
  if (!c) {
    c = document.createElement('div');
    c.id = 'tqToastContainer';
    c.style.cssText = 'position:fixed;top:20px;right:20px;z-index:2000;display:flex;flex-direction:column;gap:10px;max-width:340px;';
    document.body.appendChild(c);
  }
  return c;
}

function showToast(message, type = 'danger') {
  const container = ensureToastContainer();
  const toast = document.createElement('div');
  const icon = type === 'success' ? 'bi-check-circle-fill' : type === 'warning' ? 'bi-exclamation-triangle-fill' : 'bi-x-circle-fill';
  toast.className = `alert alert-${type} shadow-sm d-flex align-items-center gap-2 mb-0`;
  toast.style.cssText = 'animation: tqFadeIn .2s ease;';
  toast.innerHTML = `<i class="bi ${icon}"></i><div>${message}</div>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity .3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ─── CURRENCY (South African Rand) ─────────────────────────────
function formatCurrency(value) {
  const n = parseFloat(value) || 0;
  return 'R' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── API HELPERS ────────────────────────────────────────────
async function apiGet(action, params = {}) {
  const url = new URL(API_BASE);
  url.searchParams.append('action', action);
  Object.keys(params).forEach(k => url.searchParams.append(k, params[k]));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('Server responded with status ' + res.status);
  const data = await res.json();
  if (data && data.error) throw new Error(data.error);
  return data;
}

async function apiPost(action, data) {
  // IMPORTANT: Apps Script web apps do not handle CORS preflight (OPTIONS)
  // requests. Sending "Content-Type: application/json" forces the browser
  // to send a preflight, which gets blocked and shows up as a generic
  // "network error". Using "text/plain" keeps this a "simple request" that
  // skips preflight entirely — Apps Script still reads the raw JSON body
  // fine via e.postData.contents.
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, ...data })
  });
  if (!res.ok) throw new Error('Server responded with status ' + res.status);
  return res.json();
}

// ─── DASHBOARD ──────────────────────────────────────────────
async function loadDashboard() {
  try {
    const stats = await apiGet('getDashboardStats');
    document.getElementById('totalQuotes').textContent = stats.totalQuotes || 0;
    document.getElementById('totalClients').textContent = stats.totalClients || 0;
    document.getElementById('expiringCount').textContent = stats.expiringThisWeek || 0;
    document.getElementById('totalRevenue').textContent = formatCurrency(stats.totalRevenue);

    const tbody = document.getElementById('recentTableBody');
    tbody.innerHTML = '';
    if (stats.recentQuotes && stats.recentQuotes.length) {
      stats.recentQuotes.forEach(q => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><a href="quote-details.html?id=${q.ID}">${q['Quote Number']}</a></td>
          <td>${q['Client Name'] || ''}</td>
          <td>${q['Service'] || ''}</td>
          <td>${q['Date Created'] || ''}</td>
          <td>${formatCurrency(q['Grand Total'])}</td>
          <td><span class="badge ${q['Status'] === 'Active' ? 'bg-success' : q['Status'] === 'Expired' ? 'bg-danger' : 'bg-secondary'}">${q['Status'] || 'Draft'}</span></td>
        `;
        tbody.appendChild(tr);
      });
    } else {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No quotations yet.</td></tr>';
    }
  } catch (err) {
    console.error('Dashboard error:', err);
    showToast('Failed to load dashboard data: ' + err.message);
  }
}

// ─── CREATE QUOTE ───────────────────────────────────────────
function initCreateQuote() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('dateCreated').value = today;
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 30);
  document.getElementById('dateExpires').value = expiry.toISOString().split('T')[0];
  document.getElementById('quoteNumber').value = 'QUOTE-' + today.replace(/-/g, '') + '-XXX (assigned on save)';

  addItemRow();

  document.getElementById('addItemBtn').addEventListener('click', () => addItemRow());

  document.getElementById('itemsContainer').addEventListener('click', function (e) {
    if (e.target.closest('.remove-item')) {
      const row = e.target.closest('.item-row');
      if (document.querySelectorAll('.item-row').length > 1) {
        row.remove();
        recalcTotals();
      } else {
        showToast('At least one item is required.', 'warning');
      }
    }
  });

  document.getElementById('itemsContainer').addEventListener('input', function (e) {
    if (e.target.matches('.item-qty, .item-price')) {
      const row = e.target.closest('.item-row');
      calcRowTotal(row);
      recalcTotals();
    }
  });

  document.getElementById('resetBtn').addEventListener('click', function () {
    if (confirm('This will clear all unsaved data. Continue?')) {
      resetForm();
    }
  });

  document.getElementById('previewBtn').addEventListener('click', previewQuote);

  document.getElementById('quoteForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if (validateForm()) {
      showSaveConfirmation();
    }
  });
}

function addItemRow(desc = '', qty = 1, price = 0) {
  const container = document.getElementById('itemsContainer');
  const row = document.createElement('div');
  row.className = 'row g-2 mb-2 item-row';
  row.innerHTML = `
    <div class="col-md-5"><input type="text" class="form-control item-desc" placeholder="Description" value="${desc}" /></div>
    <div class="col-md-2"><input type="number" class="form-control item-qty" placeholder="Qty" value="${qty}" min="1" /></div>
    <div class="col-md-2"><input type="number" class="form-control item-price" placeholder="Unit Price" step="0.01" value="${price}" /></div>
    <div class="col-md-2"><input type="text" class="form-control item-total" placeholder="Total" readonly value="${(qty * price).toFixed(2)}" /></div>
    <div class="col-md-1"><button type="button" class="btn btn-outline-danger remove-item"><i class="bi bi-trash"></i></button></div>
  `;
  container.appendChild(row);
  recalcTotals();
}

function calcRowTotal(row) {
  const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
  const price = parseFloat(row.querySelector('.item-price').value) || 0;
  row.querySelector('.item-total').value = (qty * price).toFixed(2);
}

function recalcTotals() {
  const rows = document.querySelectorAll('.item-row');
  let subtotal = 0;
  rows.forEach(row => {
    subtotal += parseFloat(row.querySelector('.item-total').value) || 0;
  });
  const tax = subtotal * 0.15;
  const grand = subtotal + tax;
  document.getElementById('subtotal').value = subtotal.toFixed(2);
  document.getElementById('tax').value = tax.toFixed(2);
  document.getElementById('grandTotal').value = grand.toFixed(2);
}

function validateForm() {
  const clientName = document.getElementById('clientName').value.trim();
  if (!clientName) {
    showToast('Client Name is required.', 'warning');
    document.getElementById('clientName').focus();
    return false;
  }
  const items = document.querySelectorAll('.item-row');
  let hasDesc = false;
  items.forEach(row => {
    if (row.querySelector('.item-desc').value.trim() !== '') hasDesc = true;
  });
  if (!hasDesc) {
    showToast('Please add at least one item description.', 'warning');
    return false;
  }
  return true;
}

function collectFormData() {
  const items = [];
  document.querySelectorAll('.item-row').forEach(row => {
    const desc = row.querySelector('.item-desc').value.trim();
    const qty = parseInt(row.querySelector('.item-qty').value, 10) || 0;
    const price = parseFloat(row.querySelector('.item-price').value) || 0;
    if (desc) items.push({ description: desc, quantity: qty, unitPrice: price, total: qty * price });
  });
  return {
    dateCreated: document.getElementById('dateCreated').value,
    dateExpires: document.getElementById('dateExpires').value,
    service: document.getElementById('service').value,
    clientType: document.getElementById('clientType').value,
    clientName: document.getElementById('clientName').value.trim(),
    clientEmail: document.getElementById('clientEmail').value.trim(),
    clientPhone: document.getElementById('clientPhone').value.trim(),
    clientAddress: document.getElementById('clientAddress').value.trim(),
    clientCompany: document.getElementById('clientCompany').value.trim(),
    subtotal: parseFloat(document.getElementById('subtotal').value) || 0,
    tax: parseFloat(document.getElementById('tax').value) || 0,
    grandTotal: parseFloat(document.getElementById('grandTotal').value) || 0,
    notes: document.getElementById('notes').value.trim(),
    status: 'Active',
    items: items
  };
}

function showSaveConfirmation() {
  if (confirm('Are you sure you want to create this quotation?')) {
    saveQuote();
  }
}

async function saveQuote() {
  const btn = document.getElementById('saveBtn');
  const textEl = document.getElementById('saveBtnText');
  const spinner = document.getElementById('saveSpinner');

  // Remember the original markup so we restore it exactly (icon included)
  // rather than clobbering it with plain text — that HTML-tags-showing-up
  // bug came from setting .textContent to a string containing an <i> tag.
  const originalMarkup = textEl.innerHTML;

  btn.disabled = true;
  textEl.textContent = 'Saving…';
  spinner.classList.remove('d-none');

  try {
    const data = collectFormData();
    const result = await apiPost('createQuote', data);

    if (result.success) {
      document.getElementById('successMessage').innerHTML = `Quotation <strong>${result.quoteNumber}</strong> created successfully!`;
      const modal = new bootstrap.Modal(document.getElementById('successModal'));
      modal.show();
      document.getElementById('viewQuoteBtn').onclick = function () {
        window.location.href = `quote-details.html?id=${result.id}`;
      };
      document.getElementById('createAnotherBtn').onclick = function () {
        modal.hide();
        resetForm();
      };
    } else {
      showToast('Could not save quotation: ' + (result.error || 'Unknown error'));
    }
  } catch (err) {
    console.error(err);
    showToast('Network error while saving: ' + err.message);
  } finally {
    btn.disabled = false;
    textEl.innerHTML = originalMarkup;
    spinner.classList.add('d-none');
  }
}

function resetForm() {
  document.getElementById('quoteForm').reset();
  document.getElementById('itemsContainer').innerHTML = '';
  addItemRow();
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('dateCreated').value = today;
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 30);
  document.getElementById('dateExpires').value = expiry.toISOString().split('T')[0];
  document.getElementById('quoteNumber').value = 'QUOTE-' + today.replace(/-/g, '') + '-XXX (assigned on save)';
  recalcTotals();
}

function previewQuote() {
  if (!validateForm()) return;
  const data = collectFormData();
  const itemsHtml = data.items.map(item => `
    <tr><td>${item.description}</td><td>${item.quantity}</td><td>${formatCurrency(item.unitPrice)}</td><td>${formatCurrency(item.total)}</td></tr>
  `).join('');
  const html = `
    <div class="p-3 border rounded">
      <h4>Technopaths Entity</h4>
      <h5>Quotation Preview</h5>
      <p><strong>Client:</strong> ${data.clientName}</p>
      <table class="table table-bordered"><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>${itemsHtml}</tbody></table>
      <p><strong>Subtotal:</strong> ${formatCurrency(data.subtotal)}</p>
      <p><strong>Tax:</strong> ${formatCurrency(data.tax)}</p>
      <h4>Grand Total: ${formatCurrency(data.grandTotal)}</h4>
    </div>
  `;
  document.getElementById('previewContent').innerHTML = html;
  new bootstrap.Modal(document.getElementById('previewModal')).show();
}

// ─── VIEW QUOTES ─────────────────────────────────────────────
let allQuotes = [];
let currentPage = 1;
const perPage = 10;

async function initViewQuotes() {
  await loadQuotes();
  document.getElementById('searchInput').addEventListener('input', filterQuotes);
  document.getElementById('statusFilter').addEventListener('change', filterQuotes);
  document.getElementById('refreshBtn').addEventListener('click', loadQuotes);
  document.getElementById('exportCsvBtn').addEventListener('click', exportCsv);
}

async function loadQuotes() {
  const tbody = document.getElementById('quotesTableBody');
  tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">Loading quotations…</td></tr>';
  try {
    const data = await apiGet('getAllQuotes');
    allQuotes = data || [];
    filterQuotes();
  } catch (err) {
    console.error(err);
    showToast('Failed to load quotations: ' + err.message);
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-danger">Could not load quotations.</td></tr>';
  }
}

function filterQuotes() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const status = document.getElementById('statusFilter').value;
  let filtered = allQuotes.filter(q => {
    const name = (q['Client Name'] || '').toLowerCase();
    const num = (q['Quote Number'] || '').toLowerCase();
    const matchSearch = name.includes(search) || num.includes(search);
    const matchStatus = status === '' || q['Status'] === status;
    return matchSearch && matchStatus;
  });
  filtered.sort((a, b) => new Date(b['Created At']) - new Date(a['Created At']));
  renderTable(filtered);
}

function renderTable(filtered) {
  const totalPages = Math.ceil(filtered.length / perPage) || 1;
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * perPage;
  const pageItems = filtered.slice(start, start + perPage);

  const tbody = document.getElementById('quotesTableBody');
  if (!pageItems.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No quotations found.</td></tr>';
  } else {
    tbody.innerHTML = pageItems.map(q => `
      <tr>
        <td><a href="quote-details.html?id=${q.ID}">${q['Quote Number']}</a></td>
        <td>${q['Client Name'] || ''}</td>
        <td>${q['Service'] || ''}</td>
        <td>${q['Date Created'] || ''}</td>
        <td>${q['Date Expires'] || ''}</td>
        <td>${formatCurrency(q['Grand Total'])}</td>
        <td><span class="badge ${q['Status'] === 'Active' ? 'bg-success' : q['Status'] === 'Expired' ? 'bg-danger' : 'bg-secondary'}">${q['Status'] || 'Draft'}</span></td>
        <td>
          <a href="quote-details.html?id=${q.ID}" class="btn btn-sm btn-outline-info"><i class="bi bi-eye"></i></a>
          <button class="btn btn-sm btn-outline-danger delete-quote" data-id="${q.ID}"><i class="bi bi-trash"></i></button>
        </td>
      </tr>
    `).join('');
  }

  const pagination = document.getElementById('paginationList');
  pagination.innerHTML = '';
  for (let i = 1; i <= totalPages; i++) {
    const li = document.createElement('li');
    li.className = `page-item ${i === currentPage ? 'active' : ''}`;
    li.innerHTML = `<a class="page-link" href="#" data-page="${i}">${i}</a>`;
    li.querySelector('a').addEventListener('click', function (e) {
      e.preventDefault();
      currentPage = parseInt(this.dataset.page, 10);
      filterQuotes();
    });
    pagination.appendChild(li);
  }

  document.querySelectorAll('.delete-quote').forEach(btn => {
    btn.addEventListener('click', function () {
      document.getElementById('confirmDeleteBtn').dataset.id = this.dataset.id;
      new bootstrap.Modal(document.getElementById('deleteModal')).show();
    });
  });
}

document.addEventListener('click', function (e) {
  if (e.target.id === 'confirmDeleteBtn') {
    deleteQuoteById(e.target.dataset.id);
  }
});

async function deleteQuoteById(id) {
  try {
    const result = await apiPost('deleteQuote', { id });
    if (result.success) {
      showToast('Quotation deleted.', 'success');
      loadQuotes();
    } else {
      showToast('Delete failed: ' + (result.error || 'Unknown error'));
    }
  } catch (err) {
    showToast('Error deleting: ' + err.message);
  } finally {
    bootstrap.Modal.getInstance(document.getElementById('deleteModal'))?.hide();
  }
}

function exportCsv() {
  const headers = ['Quote Number', 'Client', 'Service', 'Date', 'Grand Total', 'Status'];
  const rows = allQuotes.map(q => [q['Quote Number'], q['Client Name'], q['Service'], q['Date Created'], q['Grand Total'], q['Status']]);
  const csv = headers.join(',') + '\n' + rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'quotations.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ─── QUOTE DETAILS ───────────────────────────────────────────
async function initQuoteDetails() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) {
    document.getElementById('quoteDisplay').innerHTML = '<div class="alert alert-danger">No quotation ID provided.</div>';
    return;
  }
  try {
    const quote = await apiGet('getQuote', { id });
    if (!quote) {
      document.getElementById('quoteDisplay').innerHTML = '<div class="alert alert-warning">Quotation not found.</div>';
      return;
    }
    renderQuoteDetails(quote);
    document.getElementById('printBtn').addEventListener('click', () => window.print());
    document.getElementById('pdfBtn').addEventListener('click', function () {
      const element = document.getElementById('quoteDisplay');
      html2pdf().from(element).save(`quote-${quote['Quote Number']}.pdf`);
    });
    document.getElementById('backBtn').addEventListener('click', () => window.history.back());
  } catch (err) {
    document.getElementById('quoteDisplay').innerHTML = '<div class="alert alert-danger">Error loading quotation.</div>';
    console.error(err);
  }
}

function renderQuoteDetails(q) {
  const items = q.items || [];
  const itemsHtml = items.map(item => `
    <tr><td>${item['Item Description'] || item['Description'] || ''}</td><td>${item['Quantity'] || 0}</td><td>${formatCurrency(item['Unit Price'])}</td><td>${formatCurrency(item['Total'])}</td></tr>
  `).join('');
  const html = `
    <div class="print-area">
      <div class="text-center mb-4">
        <h1 class="display-6">Technopaths Entity</h1>
        <p class="lead">Technopaths Quota</p>
        <hr />
        <h3>Quotation</h3>
      </div>
      <div class="row">
        <div class="col-md-6"><strong>Quote #:</strong> ${q['Quote Number']}</div>
        <div class="col-md-6"><strong>Date:</strong> ${q['Date Created']}</div>
        <div class="col-md-6"><strong>Expires:</strong> ${q['Date Expires']}</div>
        <div class="col-md-6"><strong>Service:</strong> ${q['Service']}</div>
      </div>
      <hr />
      <h5>Client</h5>
      <p><strong>${q['Client Name']}</strong><br />${q['Client Address'] || ''}<br />${q['Client Email'] || ''}<br />${q['Client Phone'] || ''}</p>
      <hr />
      <table class="table table-bordered">
        <thead><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
        <tbody>${itemsHtml || '<tr><td colspan="4" class="text-center">No items</td></tr>'}</tbody>
      </table>
      <div class="row">
        <div class="col-md-6 offset-md-6">
          <p><strong>Subtotal:</strong> ${formatCurrency(q['Subtotal'])}</p>
          <p><strong>Tax (15%):</strong> ${formatCurrency(q['Tax'])}</p>
          <h4>Grand Total: ${formatCurrency(q['Grand Total'])}</h4>
        </div>
      </div>
      <hr />
      <p><strong>Notes:</strong> ${q['Notes'] || 'N/A'}</p>
      <hr />
      <p class="text-muted small">Payment is due within 30 days. All quotes are valid for 30 days from the date of issue.</p>
    </div>
  `;
  document.getElementById('quoteDisplay').innerHTML = html;
}