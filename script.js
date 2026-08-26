// ──────────────────────────────────────────────────────────────
// script.js – Technopaths Quota Frontend
// ──────────────────────────────────────────────────────────────

const API_BASE = 'https://script.google.com/macros/s/AKfycbzqocrUAOWNqlpu-EshkIQ7-0aeuAkH0sceTEREsoqjVdbCzS1aEgk08vAKubkT-cY/exec'; // Replace with your deployed Google Apps Script URL

// ─── AUTH ────────────────────────────────────────────────────
function checkAuth() {
  if (!sessionStorage.getItem('tq_logged_in')) {
    window.location.href = 'index.html';
  }
  // Update username display
  const name = sessionStorage.getItem('tq_full_name') || sessionStorage.getItem('tq_username') || 'User';
  document.querySelectorAll('#usernameDisplay').forEach(el => el.textContent = name);
}

// ─── LOGOUT ─────────────────────────────────────────────────
document.addEventListener('click', function(e) {
  if (e.target.id === 'logoutBtn' || e.target.closest('#logoutBtn')) {
    e.preventDefault();
    sessionStorage.clear();
    window.location.href = 'index.html';
  }
});

// ─── API HELPERS ────────────────────────────────────────────
async function apiGet(action, params = {}) {
  const url = new URL(API_BASE);
  url.searchParams.append('action', action);
  Object.keys(params).forEach(k => url.searchParams.append(k, params[k]));
  const res = await fetch(url.toString());
  return res.json();
}

async function apiPost(action, data) {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...data })
  });
  return res.json();
}

// ─── DASHBOARD ──────────────────────────────────────────────
async function loadDashboard() {
  try {
    const stats = await apiGet('getDashboardStats');
    document.getElementById('totalQuotes').textContent = stats.totalQuotes || 0;
    document.getElementById('totalClients').textContent = stats.totalClients || 0;
    document.getElementById('expiringCount').textContent = stats.expiringThisWeek || 0;
    document.getElementById('totalRevenue').textContent = '$' + (stats.totalRevenue || 0).toFixed(2);

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
          <td>$${parseFloat(q['Grand Total'] || 0).toFixed(2)}</td>
          <td><span class="badge ${q['Status'] === 'Active' ? 'bg-success' : q['Status'] === 'Expired' ? 'bg-danger' : 'bg-secondary'}">${q['Status'] || 'Draft'}</span></td>
        `;
        tbody.appendChild(tr);
      });
    } else {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No quotations yet.</td></tr>';
    }
  } catch (err) {
    console.error('Dashboard error:', err);
    alert('Failed to load dashboard data.');
  }
}

// ─── CREATE QUOTE ───────────────────────────────────────────
let quoteItems = [];

function initCreateQuote() {
  // Set dates
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('dateCreated').value = today;
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 30);
  document.getElementById('dateExpires').value = expiry.toISOString().split('T')[0];
  // Auto-generate quote number (client-side, but backend will override)
  document.getElementById('quoteNumber').value = 'QUOTE-' + today.replace(/-/g,'') + '-XXX';

  // Add initial item row
  addItemRow();

  // Add item button
  document.getElementById('addItemBtn').addEventListener('click', addItemRow);

  // Remove item delegate
  document.getElementById('itemsContainer').addEventListener('click', function(e) {
    if (e.target.closest('.remove-item')) {
      const row = e.target.closest('.item-row');
      if (document.querySelectorAll('.item-row').length > 1) {
        row.remove();
        recalcTotals();
      } else {
        alert('At least one item is required.');
      }
    }
  });

  // Recalculate on input
  document.getElementById('itemsContainer').addEventListener('input', function(e) {
    if (e.target.matches('.item-qty, .item-price')) {
      const row = e.target.closest('.item-row');
      calcRowTotal(row);
      recalcTotals();
    }
  });

  // Reset form
  document.getElementById('resetBtn').addEventListener('click', function() {
    if (confirm('This will clear all unsaved data. Continue?')) {
      resetForm();
    }
  });

  // Preview
  document.getElementById('previewBtn').addEventListener('click', function() {
    previewQuote();
  });

  // Submit
  document.getElementById('quoteForm').addEventListener('submit', function(e) {
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
    <div class="col-md-2"><input type="text" class="form-control item-total" placeholder="Total" readonly value="${(qty*price).toFixed(2)}" /></div>
    <div class="col-md-1"><button type="button" class="btn btn-outline-danger remove-item"><i class="bi bi-trash"></i></button></div>
  `;
  container.appendChild(row);
  recalcTotals();
}

function calcRowTotal(row) {
  const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
  const price = parseFloat(row.querySelector('.item-price').value) || 0;
  const total = qty * price;
  row.querySelector('.item-total').value = total.toFixed(2);
}

function recalcTotals() {
  const rows = document.querySelectorAll('.item-row');
  let subtotal = 0;
  rows.forEach(row => {
    const total = parseFloat(row.querySelector('.item-total').value) || 0;
    subtotal += total;
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
    alert('Client Name is required.');
    document.getElementById('clientName').focus();
    return false;
  }
  const items = document.querySelectorAll('.item-row');
  let hasDesc = false;
  items.forEach(row => {
    if (row.querySelector('.item-desc').value.trim() !== '') hasDesc = true;
  });
  if (!hasDesc) {
    alert('Please add at least one item description.');
    return false;
  }
  return true;
}

function collectFormData() {
  const items = [];
  document.querySelectorAll('.item-row').forEach(row => {
    const desc = row.querySelector('.item-desc').value.trim();
    const qty = parseInt(row.querySelector('.item-qty').value) || 0;
    const price = parseFloat(row.querySelector('.item-price').value) || 0;
    if (desc) {
      items.push({ description: desc, quantity: qty, unitPrice: price, total: qty * price });
    }
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
  const text = document.getElementById('saveBtnText');
  const spinner = document.getElementById('saveSpinner');
  btn.disabled = true;
  text.textContent = 'Saving…';
  spinner.classList.remove('d-none');

  try {
    const data = collectFormData();
    const result = await apiPost('createQuote', data);
    if (result.success) {
      // Show success modal
      document.getElementById('successMessage').innerHTML = `Quotation <strong>${result.quoteNumber}</strong> created successfully!`;
      const modal = new bootstrap.Modal(document.getElementById('successModal'));
      modal.show();
      // Store quote number for view
      document.getElementById('viewQuoteBtn').onclick = function() {
        window.location.href = `quote-details.html?id=${result.id}`;
      };
      document.getElementById('createAnotherBtn').onclick = function() {
        modal.hide();
        resetForm();
      };
    } else {
      alert('Error: ' + (result.error || 'Unknown error'));
    }
  } catch (err) {
    alert('Network error. Please try again.');
    console.error(err);
  } finally {
    btn.disabled = false;
    text.textContent = '<i class="bi bi-save me-1"></i>Save Quotation';
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
  recalcTotals();
}

function previewQuote() {
  if (!validateForm()) return;
  const data = collectFormData();
  const itemsHtml = data.items.map(item => `
    <tr><td>${item.description}</td><td>${item.quantity}</td><td>$${item.unitPrice.toFixed(2)}</td><td>$${item.total.toFixed(2)}</td></tr>
  `).join('');
  const html = `
    <div class="p-3 border rounded">
      <h4>Technopaths Entity</h4>
      <h5>Quotation Preview</h5>
      <p><strong>Quote #:</strong> ${document.getElementById('quoteNumber').value}</p>
      <p><strong>Client:</strong> ${data.clientName}</p>
      <table class="table table-bordered"><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>${itemsHtml}</tbody></table>
      <p><strong>Subtotal:</strong> $${data.subtotal.toFixed(2)}</p>
      <p><strong>Tax:</strong> $${data.tax.toFixed(2)}</p>
      <h4>Grand Total: $${data.grandTotal.toFixed(2)}</h4>
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
  try {
    const data = await apiGet('getAllQuotes');
    allQuotes = data || [];
    filterQuotes();
  } catch (err) {
    alert('Failed to load quotations.');
    console.error(err);
  }
}

function filterQuotes() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const status = document.getElementById('statusFilter').value;
  let filtered = allQuotes.filter(q => {
    const matchSearch = q['Client Name'].toLowerCase().includes(search) || q['Quote Number'].toLowerCase().includes(search);
    const matchStatus = status === '' || q['Status'] === status;
    return matchSearch && matchStatus;
  });
  // Sort by date newest first
  filtered.sort((a,b) => new Date(b['Created At']) - new Date(a['Created At']));
  renderTable(filtered);
}

function renderTable(filtered) {
  const totalPages = Math.ceil(filtered.length / perPage);
  if (currentPage > totalPages) currentPage = totalPages || 1;
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
        <td>$${parseFloat(q['Grand Total'] || 0).toFixed(2)}</td>
        <td><span class="badge ${q['Status'] === 'Active' ? 'bg-success' : q['Status'] === 'Expired' ? 'bg-danger' : 'bg-secondary'}">${q['Status'] || 'Draft'}</span></td>
        <td>
          <a href="quote-details.html?id=${q.ID}" class="btn btn-sm btn-outline-info"><i class="bi bi-eye"></i></a>
          <button class="btn btn-sm btn-outline-danger delete-quote" data-id="${q.ID}"><i class="bi bi-trash"></i></button>
        </td>
      </tr>
    `).join('');
  }

  // Pagination
  const pagination = document.getElementById('paginationList');
  pagination.innerHTML = '';
  for (let i = 1; i <= totalPages; i++) {
    const li = document.createElement('li');
    li.className = `page-item ${i === currentPage ? 'active' : ''}`;
    li.innerHTML = `<a class="page-link" href="#" data-page="${i}">${i}</a>`;
    li.querySelector('a').addEventListener('click', function(e) {
      e.preventDefault();
      currentPage = parseInt(this.dataset.page);
      filterQuotes();
    });
    pagination.appendChild(li);
  }

  // Delete buttons
  document.querySelectorAll('.delete-quote').forEach(btn => {
    btn.addEventListener('click', function() {
      const id = this.dataset.id;
      document.getElementById('confirmDeleteBtn').dataset.id = id;
      new bootstrap.Modal(document.getElementById('deleteModal')).show();
    });
  });
}

document.addEventListener('click', function(e) {
  if (e.target.id === 'confirmDeleteBtn') {
    const id = e.target.dataset.id;
    deleteQuote(id);
  }
});

async function deleteQuote(id) {
  try {
    const result = await apiPost('deleteQuote', { id });
    if (result.success) {
      alert('Quotation deleted.');
      loadQuotes();
    } else {
      alert('Delete failed.');
    }
  } catch (err) {
    alert('Error deleting.');
  } finally {
    bootstrap.Modal.getInstance(document.getElementById('deleteModal')).hide();
  }
}

function exportCsv() {
  // Simple CSV export
  const headers = ['Quote Number','Client','Service','Date','Grand Total','Status'];
  const rows = allQuotes.map(q => [q['Quote Number'], q['Client Name'], q['Service'], q['Date Created'], q['Grand Total'], q['Status']]);
  let csv = headers.join(',') + '\n' + rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'quotations.csv';
  a.click();
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
    // Print
    document.getElementById('printBtn').addEventListener('click', function() {
      window.print();
    });
    // PDF
    document.getElementById('pdfBtn').addEventListener('click', function() {
      const element = document.getElementById('quoteDisplay');
      html2pdf().from(element).save(`quote-${quote['Quote Number']}.pdf`);
    });
    // Back
    document.getElementById('backBtn').addEventListener('click', function() {
      window.history.back();
    });
  } catch (err) {
    document.getElementById('quoteDisplay').innerHTML = '<div class="alert alert-danger">Error loading quotation.</div>';
    console.error(err);
  }
}

function renderQuoteDetails(q) {
  const items = q.items || [];
  const itemsHtml = items.map(item => `
    <tr><td>${item['Item Description'] || ''}</td><td>${item['Quantity'] || 0}</td><td>$${parseFloat(item['Unit Price'] || 0).toFixed(2)}</td><td>$${parseFloat(item['Total'] || 0).toFixed(2)}</td></tr>
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
          <p><strong>Subtotal:</strong> $${parseFloat(q['Subtotal'] || 0).toFixed(2)}</p>
          <p><strong>Tax (15%):</strong> $${parseFloat(q['Tax'] || 0).toFixed(2)}</p>
          <h4>Grand Total: $${parseFloat(q['Grand Total'] || 0).toFixed(2)}</h4>
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