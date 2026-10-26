let currentUser = null;
let allCategories = [];
let allServices = [];
let activePlatformFilter = 'all';

document.addEventListener('DOMContentLoaded', async () => {
  const authed = await initAuth();
  if (!authed) return;

  await loadServicesAndCategories();
  loadUserOrders();
  loadPaymentDetails();

  // Check if a service was pre-selected from landing page
  const preSelectedId = sessionStorage.getItem('selectedServiceId');
  if (preSelectedId) {
    sessionStorage.removeItem('selectedServiceId');
    selectServiceById(preSelectedId);
  }
});

// ==================== AUTH & USER INIT ====================

async function initAuth() {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) {
      window.location.href = '/';
      return false;
    }
    const data = await res.json();
    if (data.success && data.user) {
      currentUser = data.user;
      updateUserUI();
      return true;
    } else {
      window.location.href = '/';
      return false;
    }
  } catch (err) {
    window.location.href = '/';
    return false;
  }
}

function updateUserUI() {
  document.getElementById('navUsername').textContent = currentUser.username;
  document.getElementById('userBalanceText').textContent = `Rs. ${currentUser.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  document.getElementById('userSpentText').textContent = `Rs. ${(currentUser.spent || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  document.getElementById('userApiKey').value = currentUser.id;

  if (currentUser.role === 'admin') {
    document.getElementById('adminLinkBtn').classList.remove('hidden');
  }
}

async function handleLogout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/';
}

// ==================== TABS NAVIGATION ====================

function switchTab(tabId) {
  const tabs = ['new-order', 'order-history', 'add-funds', 'services-list', 'api-doc'];
  tabs.forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    const btn = document.getElementById(`tabBtn-${t}`);
    if (el) el.classList.add('hidden');
    if (btn) {
      btn.className = 'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all';
    }
  });

  const activeTab = document.getElementById(`tab-${tabId}`);
  const activeBtn = document.getElementById(`tabBtn-${tabId}`);
  if (activeTab) activeTab.classList.remove('hidden');
  if (activeBtn) {
    activeBtn.className = 'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 transition-all';
  }

  if (tabId === 'order-history') loadUserOrders();
  if (tabId === 'add-funds') loadDepositHistory();
}

// ==================== SERVICES & CATEGORIES ====================

async function loadServicesAndCategories() {
  try {
    const res = await fetch('/api/services');
    const data = await res.json();
    if (data.success) {
      allCategories = data.categories;
      allServices = data.services;

      populateCategoriesDropdown();
      populateServicesDropdown();
      renderDashboardServicesTable();
    }
  } catch (err) {
    console.error('Error fetching services:', err);
  }
}

function filterByPlatform(platform) {
  activePlatformFilter = platform;
  
  // Highlight clicked platform button
  document.querySelectorAll('.platform-btn').forEach(btn => {
    btn.className = 'platform-btn px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-all';
  });
  event.currentTarget.className = 'platform-btn px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white transition-all';

  populateCategoriesDropdown();
  populateServicesDropdown();
}

function populateCategoriesDropdown() {
  const catSelect = document.getElementById('orderCategory');
  let filteredCats = allCategories;

  if (activePlatformFilter === 'tiktok') filteredCats = allCategories.filter(c => c.id.includes('tiktok'));
  else if (activePlatformFilter === 'fb') filteredCats = allCategories.filter(c => c.id.includes('fb'));
  else if (activePlatformFilter === 'insta') filteredCats = allCategories.filter(c => c.id.includes('insta'));
  else if (activePlatformFilter === 'yt') filteredCats = allCategories.filter(c => c.id.includes('yt'));

  catSelect.innerHTML = filteredCats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  onCategoryChange();
}

function onCategoryChange() {
  const selectedCatId = document.getElementById('orderCategory').value;
  const srvSelect = document.getElementById('orderService');

  const filteredServices = allServices.filter(s => s.categoryId === selectedCatId);
  srvSelect.innerHTML = filteredServices.map(s => `
    <option value="${s.id}">${s.name} - (Rs. ${s.rate}/k)</option>
  `).join('');

  onServiceChange();
}

function onServiceChange() {
  const srvId = document.getElementById('orderService').value;
  const srv = allServices.find(s => s.id === srvId);
  if (!srv) return;

  document.getElementById('minMaxIndicator').textContent = `Min: ${srv.min.toLocaleString()} - Max: ${srv.max.toLocaleString()}`;
  document.getElementById('serviceDescription').textContent = srv.description || 'Super fast automatic processing.';
  document.getElementById('calcRate').textContent = `Rs. ${srv.rate.toFixed(2)}`;

  const qtyInput = document.getElementById('orderQuantity');
  if (!qtyInput.value || parseInt(qtyInput.value) < srv.min) {
    qtyInput.value = srv.min;
  }
  calculateCharge();
}

function selectServiceById(serviceId) {
  const srv = allServices.find(s => s.id === serviceId);
  if (!srv) return;

  document.getElementById('orderCategory').value = srv.categoryId;
  onCategoryChange();
  document.getElementById('orderService').value = srv.id;
  onServiceChange();
}

function setQuantity(val) {
  document.getElementById('orderQuantity').value = val;
  calculateCharge();
}

function calculateCharge() {
  const srvId = document.getElementById('orderService').value;
  const srv = allServices.find(s => s.id === srvId);
  const qty = parseInt(document.getElementById('orderQuantity').value) || 0;

  document.getElementById('calcQuantity').textContent = qty.toLocaleString();

  if (!srv || qty <= 0) {
    document.getElementById('calcTotalCharge').textContent = 'Rs. 0.00';
    return;
  }

  const total = ((qty / 1000) * srv.rate).toFixed(2);
  document.getElementById('calcTotalCharge').textContent = `Rs. ${parseFloat(total).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

// ==================== SUBMIT NEW ORDER ====================

async function submitNewOrder(e) {
  e.preventDefault();
  const serviceId = document.getElementById('orderService').value;
  const link = document.getElementById('orderLink').value;
  const quantity = parseInt(document.getElementById('orderQuantity').value);

  const submitBtn = document.getElementById('submitOrderBtn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i> Forwarding to API...`;

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceId, link, quantity })
    });
    const data = await res.json();

    if (data.success) {
      currentUser.balance = data.remainingBalance;
      currentUser.spent = (currentUser.spent || 0) + data.order.charge;
      updateUserUI();

      Swal.fire({
        icon: 'success',
        title: 'Order Placed & Auto-Started!',
        html: `
          <div class="text-left text-xs space-y-2 mt-3 font-mono bg-slate-900 p-4 rounded-xl border border-slate-800">
            <div><strong>Order ID:</strong> ${data.order.id}</div>
            <div><strong>Service:</strong> ${data.order.serviceName}</div>
            <div><strong>Quantity:</strong> ${data.order.quantity.toLocaleString()}</div>
            <div><strong>Charge:</strong> Rs. ${data.order.charge}</div>
            <div class="text-emerald-400"><strong>Status:</strong> ${data.order.status}</div>
          </div>
        `,
        confirmButtonText: 'View Order History',
        background: '#111827',
        color: '#f8fafc'
      }).then(() => {
        document.getElementById('orderLink').value = '';
        switchTab('order-history');
      });
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Order Failed',
        text: data.error,
        background: '#111827',
        color: '#f8fafc'
      });
    }
  } catch (err) {
    Swal.fire({ icon: 'error', title: 'Network Error', text: err.message });
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<i class="fa-solid fa-paper-plane mr-2"></i> Submit Order & Auto Start`;
  }
}

// ==================== USER ORDER LOGS ====================

async function loadUserOrders() {
  const tbody = document.getElementById('ordersTableBody');
  try {
    const res = await fetch('/api/orders');
    const data = await res.json();

    if (data.success) {
      document.getElementById('userTotalOrders').textContent = data.orders.length;

      if (data.orders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-slate-500">No orders placed yet. Place your first order!</td></tr>`;
        return;
      }

      tbody.innerHTML = data.orders.map(o => {
        let badgeClass = 'badge-progress';
        if (o.status === 'Completed') badgeClass = 'badge-completed';
        if (o.status === 'Pending') badgeClass = 'badge-pending';
        if (o.status === 'Canceled' || o.status === 'Refunded') badgeClass = 'badge-canceled';

        const shortLink = o.link.length > 25 ? o.link.substring(0, 25) + '...' : o.link;
        const dateStr = new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });

        return `
          <tr class="hover:bg-slate-800/40 transition-colors">
            <td class="py-3 px-4 font-mono font-bold text-indigo-300">${o.id.replace('ord_', '#')}</td>
            <td class="py-3 px-4 font-medium text-white max-w-[200px] truncate" title="${o.serviceName}">${o.serviceName}</td>
            <td class="py-3 px-4">
              <a href="${o.link}" target="_blank" class="text-indigo-400 hover:underline flex items-center gap-1 font-mono text-[11px]">
                ${shortLink} <i class="fa-solid fa-up-right-from-square text-[9px]"></i>
              </a>
            </td>
            <td class="py-3 px-4 font-mono font-bold">${o.quantity.toLocaleString()}</td>
            <td class="py-3 px-4 font-mono font-bold text-emerald-400">Rs. ${o.charge.toFixed(2)}</td>
            <td class="py-3 px-4 font-mono text-slate-400">${o.startCount || 0} / ${o.remains ?? o.quantity}</td>
            <td class="py-3 px-4">
              <span class="px-2.5 py-1 rounded-full text-[11px] font-bold ${badgeClass}">
                ${o.status}
              </span>
            </td>
            <td class="py-3 px-4 text-right text-slate-400 text-[11px]">${dateStr}</td>
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('Error fetching orders:', err);
  }
}

// ==================== PAYMENTS & DEPOSITS ====================

async function loadPaymentDetails() {
  const grid = document.getElementById('paymentAccountsGrid');
  try {
    const res = await fetch('/api/payment/details');
    const data = await res.json();
    if (data.success && data.paymentDetails) {
      const p = data.paymentDetails;
      grid.innerHTML = `
        <div class="glass-card rounded-2xl p-5 border border-slate-800 relative">
          <div class="flex items-center gap-2 mb-3">
            <span class="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center font-bold">EP</span>
            <div class="font-bold text-sm text-white">${p.easypaisa.title}</div>
          </div>
          <div class="text-xs text-slate-400">Title: <strong class="text-white">${p.easypaisa.name}</strong></div>
          <div class="text-sm font-mono font-bold text-emerald-400 mt-1 flex items-center justify-between">
            <span>${p.easypaisa.number}</span>
            <button onclick="copyToClipboard('${p.easypaisa.number}')" class="text-xs text-slate-400 hover:text-white"><i class="fa-regular fa-copy"></i></button>
          </div>
        </div>

        <div class="glass-card rounded-2xl p-5 border border-slate-800 relative">
          <div class="flex items-center gap-2 mb-3">
            <span class="w-8 h-8 rounded-lg bg-rose-600/20 text-rose-400 flex items-center justify-center font-bold">JC</span>
            <div class="font-bold text-sm text-white">${p.jazzcash.title}</div>
          </div>
          <div class="text-xs text-slate-400">Title: <strong class="text-white">${p.jazzcash.name}</strong></div>
          <div class="text-sm font-mono font-bold text-rose-400 mt-1 flex items-center justify-between">
            <span>${p.jazzcash.number}</span>
            <button onclick="copyToClipboard('${p.jazzcash.number}')" class="text-xs text-slate-400 hover:text-white"><i class="fa-regular fa-copy"></i></button>
          </div>
        </div>

        <div class="glass-card rounded-2xl p-5 border border-slate-800 relative">
          <div class="flex items-center gap-2 mb-3">
            <span class="w-8 h-8 rounded-lg bg-cyan-600/20 text-cyan-400 flex items-center justify-center font-bold"><i class="fa-solid fa-building-columns"></i></span>
            <div class="font-bold text-sm text-white">${p.bank.title}</div>
          </div>
          <div class="text-xs text-slate-400">Title: <strong class="text-white">${p.bank.name}</strong></div>
          <div class="text-xs text-slate-300 mt-1 font-mono flex items-center justify-between">
            <span>A/C: <strong>${p.bank.number}</strong></span>
            <button onclick="copyToClipboard('${p.bank.number}')" class="text-xs text-slate-400 hover:text-white" title="Copy Account No"><i class="fa-regular fa-copy"></i></button>
          </div>
          <div class="text-xs font-mono font-bold text-cyan-300 mt-1 flex items-center justify-between">
            <span class="truncate mr-2">IBAN: ${p.bank.iban}</span>
            <button onclick="copyToClipboard('${p.bank.iban}')" class="text-xs text-slate-400 hover:text-white" title="Copy IBAN"><i class="fa-regular fa-copy"></i></button>
          </div>
        </div>
      `;
    }
  } catch (err) {
    console.error('Error payment details:', err);
  }
}

async function submitDeposit(e) {
  e.preventDefault();
  const method = document.getElementById('depositMethod').value;
  const amount = document.getElementById('depositAmount').value;
  const trxId = document.getElementById('depositTrxId').value;
  const receiptFile = document.getElementById('depositReceipt').files[0];

  const formData = new FormData();
  formData.append('method', method);
  formData.append('amount', amount);
  formData.append('trxId', trxId);
  if (receiptFile) formData.append('receipt', receiptFile);

  try {
    const res = await fetch('/api/payment/deposit', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    if (data.success) {
      Swal.fire({
        icon: 'success',
        title: 'Deposit Submitted!',
        text: data.message,
        background: '#111827',
        color: '#f8fafc'
      });
      document.getElementById('depositAmount').value = '';
      document.getElementById('depositTrxId').value = '';
      loadDepositHistory();
    } else {
      Swal.fire({ icon: 'error', title: 'Error', text: data.error, background: '#111827', color: '#f8fafc' });
    }
  } catch (err) {
    Swal.fire({ icon: 'error', title: 'Error', text: err.message });
  }
}

async function loadDepositHistory() {
  const tbody = document.getElementById('depositHistoryBody');
  try {
    const res = await fetch('/api/payment/history');
    const data = await res.json();

    if (data.success) {
      if (data.transactions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-slate-500">No deposit requests yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = data.transactions.map(t => {
        let statusBadge = 'badge-pending';
        if (t.status === 'Approved') statusBadge = 'badge-completed';
        if (t.status === 'Rejected') statusBadge = 'badge-canceled';

        return `
          <tr class="hover:bg-slate-800/40">
            <td class="py-3 px-4 font-mono font-bold text-white">${t.trxId}</td>
            <td class="py-3 px-4">${t.method}</td>
            <td class="py-3 px-4 font-bold text-emerald-400 font-mono">Rs. ${t.amount.toLocaleString()}</td>
            <td class="py-3 px-4"><span class="px-2.5 py-1 rounded-full text-[10px] font-bold ${statusBadge}">${t.status}</span></td>
            <td class="py-3 px-4 text-right text-slate-400 text-[11px]">${new Date(t.createdAt).toLocaleDateString()}</td>
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('Error deposit history:', err);
  }
}

// ==================== DASHBOARD SERVICES TABLE ====================

function renderDashboardServicesTable() {
  const tbody = document.getElementById('dashboardServicesTableBody');
  if (!tbody) return;

  tbody.innerHTML = allServices.map(s => `
    <tr class="hover:bg-slate-800/40">
      <td class="py-3 px-4 font-mono text-slate-500 text-xs">${s.id.replace('srv_', '#')}</td>
      <td class="py-3 px-4 font-bold text-white">${s.name}</td>
      <td class="py-3 px-4 font-bold text-emerald-400 font-mono">Rs. ${s.rate}</td>
      <td class="py-3 px-4 font-mono text-slate-400">${s.min.toLocaleString()} / ${s.max.toLocaleString()}</td>
      <td class="py-3 px-4 text-right">
        <button onclick="selectServiceById('${s.id}'); switchTab('new-order');" class="px-3 py-1 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white">Order</button>
      </td>
    </tr>
  `).join('');
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
  Swal.fire({
    icon: 'success',
    title: 'Copied to clipboard!',
    timer: 900,
    showConfirmButton: false,
    background: '#111827',
    color: '#f8fafc'
  });
}
