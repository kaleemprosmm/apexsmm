let currentAdmin = null;

document.addEventListener('DOMContentLoaded', async () => {
  const isOk = await checkAdminAuth();
  if (!isOk) return;

  loadAdminOverview();
  loadProviderStatus();
  loadAdminOrders();
  loadAdminDeposits();
  loadAdminUsers();
  loadAdminServices();
  loadAdminPaymentSettings();
});

// ==================== AUTH ====================

async function checkAdminAuth() {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) {
      window.location.href = '/';
      return false;
    }
    const data = await res.json();
    if (data.success && data.user && data.user.role === 'admin') {
      currentAdmin = data.user;
      return true;
    } else {
      Swal.fire({
        icon: 'warning',
        title: 'Admin Access Required',
        text: 'You need an administrator account to view this control panel.',
        background: '#111827',
        color: '#f8fafc'
      }).then(() => {
        window.location.href = '/dashboard.html';
      });
      return false;
    }
  } catch (err) {
    window.location.href = '/';
    return false;
  }
}

async function handleLogout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/';
}

// ==================== TABS ====================

function switchAdminTab(tabId) {
  const tabs = ['overview', 'provider', 'orders', 'deposits', 'users', 'services', 'payment-settings'];
  tabs.forEach(t => {
    const el = document.getElementById(`adminTab-${t}`);
    const btn = document.getElementById(`adminTabBtn-${t}`);
    if (el) el.classList.add('hidden');
    if (btn) {
      btn.className = 'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all';
    }
  });

  const activeTab = document.getElementById(`adminTab-${tabId}`);
  const activeBtn = document.getElementById(`adminTabBtn-${tabId}`);
  if (activeTab) activeTab.classList.remove('hidden');
  if (activeBtn) {
    activeBtn.className = 'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold bg-purple-600 text-white shadow-lg shadow-purple-600/30 transition-all';
  }

  if (tabId === 'orders') loadAdminOrders();
  if (tabId === 'deposits') loadAdminDeposits();
  if (tabId === 'users') loadAdminUsers();
  if (tabId === 'services') loadAdminServices();
  if (tabId === 'payment-settings') loadAdminPaymentSettings();
}

// ==================== STATS OVERVIEW ====================

async function loadAdminOverview() {
  try {
    const res = await fetch('/api/admin/stats');
    const data = await res.json();
    if (data.success) {
      document.getElementById('statTotalOrders').textContent = data.stats.totalOrders;
      document.getElementById('statTotalRevenue').textContent = `Rs. ${data.stats.totalRevenue.toLocaleString()}`;
      document.getElementById('statTotalUsers').textContent = data.stats.totalUsers;
      document.getElementById('statPendingDeposits').textContent = data.stats.pendingDeposits;
      document.getElementById('overviewProviderModeBadge').textContent = data.stats.providerMode === 'simulation' ? 'Simulation Mode (Auto Demo)' : 'Live SMM Provider';
    }
  } catch (err) {
    console.error('Stats error:', err);
  }
}

// ==================== PROVIDER API SETUP ====================

function selectProviderPreset(preset) {
  const urlInput = document.getElementById('providerApiUrl');
  if (preset === 'pakistanpanels') urlInput.value = 'https://pakistanpanels.org/api/v2';
  if (preset === 'nawabsmm') urlInput.value = 'https://nawabsmm.com/api/v2';
  if (preset === 'geosmm') urlInput.value = 'https://geosmm.pk/api/v2';
  if (preset === 'jap') urlInput.value = 'https://justanotherpanel.com/api/v2';
  if (preset === 'smmkings') urlInput.value = 'https://smmkings.com/api/v2';
  if (preset === 'peakerr') urlInput.value = 'https://peakerr.com/api/v2';
  if (preset === 'bulkfollows') urlInput.value = 'https://bulkfollows.com/api/v2';
}

async function loadProviderStatus() {
  try {
    const res = await fetch('/api/admin/provider-status');
    const data = await res.json();

    if (data.success) {
      const cfg = data.config;
      // Set radio
      const radio = document.querySelector(`input[name="providerMode"][value="${cfg.mode}"]`);
      if (radio) radio.checked = true;

      document.getElementById('providerApiUrl').value = cfg.apiUrl || '';
      document.getElementById('providerApiKey').value = cfg.apiKey || '';
      document.getElementById('providerAutoOrder').checked = !!cfg.autoOrder;

      // Status text
      const st = data.status;
      if (st.success) {
        document.getElementById('providerLiveStatusText').innerHTML = `<span class="text-emerald-400">Connected (${st.mode.toUpperCase()})</span>`;
        document.getElementById('providerLiveBalanceText').textContent = `$${parseFloat(st.balance).toFixed(2)}`;
      } else {
        document.getElementById('providerLiveStatusText').innerHTML = `<span class="text-rose-400">${st.error || 'Disconnected'}</span>`;
        document.getElementById('providerLiveBalanceText').textContent = `$0.00`;
      }
    }
  } catch (err) {
    console.error('Provider status error:', err);
  }
}

async function saveProviderConfig(e) {
  e.preventDefault();
  const mode = document.querySelector('input[name="providerMode"]:checked').value;
  const apiUrl = document.getElementById('providerApiUrl').value;
  const apiKey = document.getElementById('providerApiKey').value;
  const autoOrder = document.getElementById('providerAutoOrder').checked;

  try {
    const res = await fetch('/api/admin/provider-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, apiUrl, apiKey, autoOrder })
    });
    const data = await res.json();

    if (data.success) {
      Swal.fire({
        icon: 'success',
        title: 'Settings Saved!',
        text: data.testResult.success ? `Connected! Provider Balance: $${data.testResult.balance}` : `Saved, but provider said: ${data.testResult.error}`,
        background: '#111827',
        color: '#f8fafc'
      });
      loadProviderStatus();
      loadAdminOverview();
    }
  } catch (err) {
    Swal.fire({ icon: 'error', title: 'Error', text: err.message });
  }
}

async function testProviderConnection() {
  Swal.fire({
    title: 'Testing Provider Connection...',
    didOpen: () => Swal.showLoading(),
    background: '#111827',
    color: '#f8fafc'
  });

  try {
    const res = await fetch('/api/admin/provider-status');
    const data = await res.json();
    if (data.success && data.status.success) {
      Swal.fire({
        icon: 'success',
        title: 'Connection Successful! ⚡',
        html: `
          <div class="text-sm font-mono text-left bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-1">
            <div><strong>Mode:</strong> ${data.status.mode}</div>
            <div><strong>Available Provider Balance:</strong> <span class="text-emerald-400">$${data.status.balance}</span></div>
            <div><strong>Currency:</strong> ${data.status.currency || 'USD'}</div>
          </div>
        `,
        background: '#111827',
        color: '#f8fafc'
      });
      loadProviderStatus();
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Connection Failed',
        text: data.status?.error || 'Could not connect to provider API',
        background: '#111827',
        color: '#f8fafc'
      });
    }
  } catch (err) {
    Swal.fire({ icon: 'error', title: 'Network Error', text: err.message });
  }
}

// ==================== ADMIN ORDERS ====================

async function loadAdminOrders() {
  const tbody = document.getElementById('adminOrdersTableBody');
  try {
    const res = await fetch('/api/admin/orders');
    const data = await res.json();

    if (data.success) {
      if (data.orders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="py-6 text-center text-slate-500">No orders found.</td></tr>`;
        return;
      }

      tbody.innerHTML = data.orders.map(o => {
        let badgeClass = 'badge-progress';
        if (o.status === 'Completed') badgeClass = 'badge-completed';
        if (o.status === 'Pending') badgeClass = 'badge-pending';
        if (o.status === 'Refunded' || o.status === 'Canceled') badgeClass = 'badge-canceled';

        const shortLink = o.link.length > 20 ? o.link.substring(0, 20) + '...' : o.link;

        return `
          <tr class="hover:bg-slate-800/40">
            <td class="py-3 px-4 font-mono font-bold text-indigo-300">${o.id.replace('ord_', '#')}</td>
            <td class="py-3 px-4 font-bold text-white">${o.username}</td>
            <td class="py-3 px-4 max-w-[150px] truncate" title="${o.serviceName}">${o.serviceName}</td>
            <td class="py-3 px-4 font-mono text-[11px]"><a href="${o.link}" target="_blank" class="text-indigo-400 hover:underline">${shortLink}</a></td>
            <td class="py-3 px-4 font-mono font-bold">${o.quantity.toLocaleString()}</td>
            <td class="py-3 px-4 font-mono font-bold text-emerald-400">Rs. ${o.charge}</td>
            <td class="py-3 px-4"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${badgeClass}">${o.status}</span></td>
            <td class="py-3 px-4 text-right space-x-1">
              <button onclick="changeOrderStatus('${o.id}', 'Completed')" title="Mark Completed" class="px-2 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded hover:bg-emerald-900 text-xs"><i class="fa-solid fa-check"></i></button>
              <button onclick="changeOrderStatus('${o.id}', 'In Progress')" title="Mark In Progress" class="px-2 py-1 bg-blue-950 text-blue-400 border border-blue-800 rounded hover:bg-blue-900 text-xs"><i class="fa-solid fa-play"></i></button>
              <button onclick="refundOrder('${o.id}')" title="Cancel & Refund" class="px-2 py-1 bg-rose-950 text-rose-400 border border-rose-800 rounded hover:bg-rose-900 text-xs"><i class="fa-solid fa-rotate-left"></i></button>
            </td>
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('Admin orders err:', err);
  }
}

async function changeOrderStatus(orderId, status) {
  try {
    const res = await fetch(`/api/admin/orders/${orderId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'setStatus', status })
    });
    const data = await res.json();
    if (data.success) {
      loadAdminOrders();
    }
  } catch (err) {
    console.error(err);
  }
}

async function refundOrder(orderId) {
  const result = await Swal.fire({
    title: 'Refund this order?',
    text: 'The money will be returned immediately to the user balance and order marked Refunded.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Yes, refund',
    background: '#111827',
    color: '#f8fafc'
  });

  if (result.isConfirmed) {
    const res = await fetch(`/api/admin/orders/${orderId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'refund' })
    });
    const data = await res.json();
    if (data.success) {
      Swal.fire({ icon: 'success', title: 'Refunded', text: data.message, background: '#111827', color: '#f8fafc' });
      loadAdminOrders();
      loadAdminOverview();
    }
  }
}

// ==================== PAYMENT APPROVALS ====================

async function loadAdminDeposits() {
  const tbody = document.getElementById('adminDepositsTableBody');
  try {
    const res = await fetch('/api/admin/transactions');
    const data = await res.json();

    if (data.success) {
      if (data.transactions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-slate-500">No payment requests found.</td></tr>`;
        return;
      }

      tbody.innerHTML = data.transactions.map(t => {
        let statusBadge = 'badge-pending';
        if (t.status === 'Approved') statusBadge = 'badge-completed';
        if (t.status === 'Rejected') statusBadge = 'badge-canceled';

        const receiptHtml = t.proof ? `<a href="${t.proof}" target="_blank" class="text-indigo-400 hover:underline"><i class="fa-solid fa-image"></i> View Receipt</a>` : '<span class="text-slate-500 text-[11px]">None</span>';

        return `
          <tr class="hover:bg-slate-800/40">
            <td class="py-3 px-4 font-bold text-white">${t.username}</td>
            <td class="py-3 px-4">${t.method}</td>
            <td class="py-3 px-4 font-bold text-emerald-400 font-mono">Rs. ${t.amount.toLocaleString()}</td>
            <td class="py-3 px-4 font-mono font-bold text-purple-300">${t.trxId}</td>
            <td class="py-3 px-4"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadge}">${t.status}</span></td>
            <td class="py-3 px-4">${receiptHtml}</td>
            <td class="py-3 px-4 text-right">
              ${t.status === 'Pending' ? `
                <button onclick="approveDeposit('${t.id}')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold mr-1">Approve</button>
                <button onclick="rejectDeposit('${t.id}')" class="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-bold">Reject</button>
              ` : `<span class="text-slate-500 text-xs">Processed</span>`}
            </td>
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('Admin deposits err:', err);
  }
}

async function approveDeposit(id) {
  try {
    const res = await fetch(`/api/admin/transactions/${id}/approve`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      Swal.fire({ icon: 'success', title: 'Payment Approved!', text: data.message, background: '#111827', color: '#f8fafc' });
      loadAdminDeposits();
      loadAdminOverview();
      loadAdminUsers();
    }
  } catch (err) {
    Swal.fire({ icon: 'error', title: 'Error', text: err.message });
  }
}

async function rejectDeposit(id) {
  try {
    const res = await fetch(`/api/admin/transactions/${id}/reject`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      loadAdminDeposits();
      loadAdminOverview();
    }
  } catch (err) {
    console.error(err);
  }
}

// ==================== USERS & BALANCES ====================

async function loadAdminUsers() {
  const tbody = document.getElementById('adminUsersTableBody');
  try {
    const res = await fetch('/api/admin/users');
    const data = await res.json();

    if (data.success) {
      tbody.innerHTML = data.users.map(u => `
        <tr class="hover:bg-slate-800/40">
          <td class="py-3 px-4 font-bold text-white flex items-center gap-2">
            <span class="w-2 h-2 rounded-full ${u.role === 'admin' ? 'bg-purple-500' : 'bg-indigo-500'}"></span>
            ${u.username}
          </td>
          <td class="py-3 px-4 text-slate-400">${u.email}</td>
          <td class="py-3 px-4"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${u.role === 'admin' ? 'bg-purple-950 text-purple-300 border border-purple-800' : 'bg-slate-800 text-slate-300'}">${u.role.toUpperCase()}</span></td>
          <td class="py-3 px-4 font-bold text-emerald-400 font-mono">Rs. ${u.balance.toLocaleString()}</td>
          <td class="py-3 px-4 font-mono text-slate-400">Rs. ${u.spent ? u.spent.toLocaleString() : '0'}</td>
          <td class="py-3 px-4 text-right">
            <button onclick="promptUserBalance('${u.id}', '${u.username}', ${u.balance})" class="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold">
              Adjust Balance
            </button>
          </td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('Users err:', err);
  }
}

async function promptUserBalance(userId, username, currentBalance) {
  const { value: formValues } = await Swal.fire({
    title: `Adjust Balance: ${username}`,
    html: `
      <div class="space-y-3 text-left">
        <div class="text-xs text-slate-400">Current Balance: <strong class="text-emerald-400">Rs. ${currentBalance}</strong></div>
        <div>
          <label class="block text-xs font-bold text-slate-300 mb-1">Action</label>
          <select id="swalAction" class="w-full p-2 rounded bg-slate-900 border border-slate-700 text-sm">
            <option value="add">Add (+)</option>
            <option value="deduct">Deduct (-)</option>
            <option value="set">Set Exact Amount</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-300 mb-1">Amount (Rs.)</label>
          <input id="swalAmount" type="number" min="1" placeholder="e.g. 500" class="w-full p-2 rounded bg-slate-900 border border-slate-700 text-sm">
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: 'Update Balance',
    background: '#111827',
    color: '#f8fafc',
    preConfirm: () => {
      return {
        action: document.getElementById('swalAction').value,
        amount: document.getElementById('swalAmount').value
      };
    }
  });

  if (formValues && formValues.amount) {
    try {
      const res = await fetch(`/api/admin/users/${userId}/balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formValues)
      });
      const data = await res.json();
      if (data.success) {
        Swal.fire({ icon: 'success', title: 'Updated!', text: data.message, background: '#111827', color: '#f8fafc' });
        loadAdminUsers();
      }
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message });
    }
  }
}

// ==================== SERVICES & RATES ====================

async function loadAdminServices() {
  const tbody = document.getElementById('adminServicesTableBody');
  try {
    const res = await fetch('/api/services');
    const data = await res.json();

    if (data.success) {
      tbody.innerHTML = data.services.map(s => `
        <tr class="hover:bg-slate-800/40">
          <td class="py-3 px-4 font-mono text-slate-500 text-xs">${s.id.replace('srv_', '#')}</td>
          <td class="py-3 px-4 font-mono font-bold text-amber-400 text-xs">#${s.providerServiceId || '1'}</td>
          <td class="py-3 px-4 font-bold text-white max-w-[200px] truncate" title="${s.name}">${s.name}</td>
          <td class="py-3 px-4 font-bold text-emerald-400 font-mono">Rs. ${s.rate} / 1k</td>
          <td class="py-3 px-4 font-mono text-slate-400">${s.min} / ${s.max}</td>
          <td class="py-3 px-4 text-right">
            <button onclick="promptEditService('${s.id}', '${encodeURIComponent(s.name)}', ${s.rate}, '${s.providerServiceId || '1'}', ${s.min}, ${s.max})" class="px-3 py-1 bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-700/60 rounded-lg text-xs font-bold">
              Edit
            </button>
          </td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('Services err:', err);
  }
}

async function promptEditService(serviceId, encodedName, currentRate, providerServiceId, min, max) {
  const name = decodeURIComponent(encodedName);
  const { value: formValues } = await Swal.fire({
    title: 'Edit Service & Provider Mapping',
    html: `
      <div class="space-y-3 text-left">
        <div>
          <label class="block text-xs font-bold text-slate-300 mb-1">Service Display Name</label>
          <input id="swalSrvName" type="text" value="${name}" class="w-full p-2 rounded bg-slate-900 border border-slate-700 text-xs text-white">
        </div>
        <div>
          <label class="block text-xs font-bold text-amber-400 mb-1">Provider Service ID (Wholesale Website ID)</label>
          <input id="swalProviderId" type="text" value="${providerServiceId}" class="w-full p-2 rounded bg-slate-900 border border-slate-700 text-xs font-mono text-amber-300">
          <span class="text-[10px] text-slate-400">Wholesale website par is service ka jo ID number hai (e.g. 101, 5420)</span>
        </div>
        <div class="grid grid-cols-3 gap-2">
          <div>
            <label class="block text-xs font-bold text-emerald-400 mb-1">Price / 1k (Rs.)</label>
            <input id="swalSrvRate" type="number" value="${currentRate}" class="w-full p-2 rounded bg-slate-900 border border-slate-700 text-xs font-mono text-emerald-300">
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-300 mb-1">Min</label>
            <input id="swalSrvMin" type="number" value="${min}" class="w-full p-2 rounded bg-slate-900 border border-slate-700 text-xs font-mono">
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-300 mb-1">Max</label>
            <input id="swalSrvMax" type="number" value="${max}" class="w-full p-2 rounded bg-slate-900 border border-slate-700 text-xs font-mono">
          </div>
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: 'Save Changes',
    background: '#111827',
    color: '#f8fafc',
    preConfirm: () => {
      return {
        name: document.getElementById('swalSrvName').value,
        providerServiceId: document.getElementById('swalProviderId').value.trim(),
        rate: parseFloat(document.getElementById('swalSrvRate').value),
        min: parseInt(document.getElementById('swalSrvMin').value),
        max: parseInt(document.getElementById('swalSrvMax').value)
      };
    }
  });

  if (formValues) {
    try {
      const res = await fetch(`/api/admin/services/${serviceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formValues)
      });
      const data = await res.json();
      if (data.success) {
        Swal.fire({ icon: 'success', title: 'Service Updated!', background: '#111827', color: '#f8fafc' });
        loadAdminServices();
      }
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message });
    }
  }
}

async function viewProviderLiveServices() {
  Swal.fire({
    title: 'Connecting to Wholesale Provider API...',
    text: 'Fetching services list from provider server...',
    didOpen: () => Swal.showLoading(),
    background: '#111827',
    color: '#f8fafc'
  });

  try {
    const res = await fetch('/api/admin/provider-services');
    const data = await res.json();

    if (data.success && Array.isArray(data.services)) {
      const rows = data.services.slice(0, 30).map(s => `
        <tr class="border-b border-slate-800 text-left text-xs">
          <td class="p-2 font-mono font-bold text-amber-400">#${s.service}</td>
          <td class="p-2 text-white font-medium max-w-[250px] truncate">${s.name}</td>
          <td class="p-2 font-mono text-emerald-400">$${s.rate}</td>
          <td class="p-2 font-mono text-slate-400">${s.min} - ${s.max}</td>
        </tr>
      `).join('');

      Swal.fire({
        title: `Provider Live Services (${data.services.length} Total)`,
        html: `
          <div class="text-xs text-slate-400 mb-2">Aap inme se kisi bhi service ka ID number copy kar ke apne panel ki service mein daal saktay hain:</div>
          <div class="max-h-80 overflow-y-auto rounded-xl border border-slate-800">
            <table class="w-full">
              <thead class="bg-slate-900 text-slate-400 text-[10px] uppercase sticky top-0">
                <tr><th class="p-2">ID</th><th class="p-2">Name</th><th class="p-2">Wholesale Rate</th><th class="p-2">Limits</th></tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        `,
        width: '650px',
        confirmButtonText: 'Done',
        background: '#111827',
        color: '#f8fafc'
      });
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Could Not Fetch Provider Services',
        text: data.error || 'Check your API Key in Provider Settings',
        background: '#111827',
        color: '#f8fafc'
      });
    }
  } catch (err) {
    Swal.fire({ icon: 'error', title: 'Error', text: err.message });
  }
}

async function promptAddNewService() {
  const { value: formValues } = await Swal.fire({
    title: 'Add New SMM Service',
    html: `
      <div class="space-y-3 text-left">
        <div>
          <label class="block text-xs font-bold text-slate-300 mb-1">Platform / Category</label>
          <select id="newSrvCat" class="w-full p-2 rounded bg-slate-900 border border-slate-700 text-xs">
            <option value="cat_tiktok">TikTok Services</option>
            <option value="cat_fb">Facebook Services</option>
            <option value="cat_insta">Instagram Services</option>
            <option value="cat_yt">YouTube Services</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-300 mb-1">Service Name</label>
          <input id="newSrvName" type="text" placeholder="e.g. TikTok Live Stream Views [Instant]" class="w-full p-2 rounded bg-slate-900 border border-slate-700 text-xs">
        </div>
        <div class="grid grid-cols-3 gap-2">
          <div>
            <label class="block text-xs font-bold text-slate-300 mb-1">Rate / 1k (Rs.)</label>
            <input id="newSrvRate" type="number" placeholder="50" class="w-full p-2 rounded bg-slate-900 border border-slate-700 text-xs font-mono">
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-300 mb-1">Min</label>
            <input id="newSrvMin" type="number" value="100" class="w-full p-2 rounded bg-slate-900 border border-slate-700 text-xs font-mono">
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-300 mb-1">Max</label>
            <input id="newSrvMax" type="number" value="100000" class="w-full p-2 rounded bg-slate-900 border border-slate-700 text-xs font-mono">
          </div>
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: 'Add Service',
    background: '#111827',
    color: '#f8fafc',
    preConfirm: () => {
      return {
        categoryId: document.getElementById('newSrvCat').value,
        name: document.getElementById('newSrvName').value,
        rate: document.getElementById('newSrvRate').value,
        min: document.getElementById('newSrvMin').value,
        max: document.getElementById('newSrvMax').value
      };
    }
  });

  if (formValues && formValues.name && formValues.rate) {
    try {
      const res = await fetch('/api/admin/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formValues)
      });
      const data = await res.json();
      if (data.success) {
        Swal.fire({ icon: 'success', title: 'Service Added!', background: '#111827', color: '#f8fafc' });
        loadAdminServices();
      }
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message });
    }
  }
}

// ==================== PAYMENT ACCOUNTS SETTINGS ====================

async function loadAdminPaymentSettings() {
  try {
    const res = await fetch('/api/payment/details');
    const data = await res.json();
    if (data.success && data.paymentDetails) {
      const p = data.paymentDetails;
      if (document.getElementById('settingEpNumber')) {
        document.getElementById('settingEpNumber').value = p.easypaisa?.number || '';
        document.getElementById('settingEpName').value = p.easypaisa?.name || '';

        document.getElementById('settingJcNumber').value = p.jazzcash?.number || '';
        document.getElementById('settingJcName').value = p.jazzcash?.name || '';

        document.getElementById('settingBankTitle').value = p.bank?.title || '';
        document.getElementById('settingBankName').value = p.bank?.name || '';
        document.getElementById('settingBankIban').value = p.bank?.iban || '';
      }
    }
  } catch (err) {
    console.error('Payment settings load err:', err);
  }
}

async function savePaymentSettings(e) {
  e.preventDefault();
  const payload = {
    easypaisa: {
      title: 'Easypaisa Account',
      number: document.getElementById('settingEpNumber').value.trim(),
      name: document.getElementById('settingEpName').value.trim()
    },
    jazzcash: {
      title: 'JazzCash Account',
      number: document.getElementById('settingJcNumber').value.trim(),
      name: document.getElementById('settingJcName').value.trim()
    },
    bank: {
      title: document.getElementById('settingBankTitle').value.trim(),
      name: document.getElementById('settingBankName').value.trim(),
      iban: document.getElementById('settingBankIban').value.trim()
    }
  };

  try {
    const res = await fetch('/api/admin/payment-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      Swal.fire({
        icon: 'success',
        title: 'Accounts Updated! 🎉',
        text: 'Aapke real payment accounts save ho gaye hain. Ab sabhi users ko aapke apne numbers show honge!',
        background: '#111827',
        color: '#f8fafc'
      });
    } else {
      Swal.fire({ icon: 'error', title: 'Error', text: data.error, background: '#111827', color: '#f8fafc' });
    }
  } catch (err) {
    Swal.fire({ icon: 'error', title: 'Error', text: err.message });
  }
}

