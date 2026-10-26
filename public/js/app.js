// Shared App & Landing Page JS
let allServices = [];

document.addEventListener('DOMContentLoaded', () => {
  loadPublicServices();
  checkCurrentUser();
});

async function checkCurrentUser() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.user) {
        // Update any auth button on landing page if already logged in
        const authBtnArea = document.querySelector('header .flex.items-center.gap-3');
        if (authBtnArea) {
          authBtnArea.innerHTML = `
            <a href="/dashboard.html" class="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 flex items-center gap-2">
              <i class="fa-solid fa-gauge-high"></i> Go to Dashboard (${data.user.username})
            </a>
          `;
        }
      }
    }
  } catch (e) {
    // Guest user
  }
}

async function loadPublicServices() {
  const tbody = document.getElementById('servicesTableBody');
  if (!tbody) return;

  try {
    const res = await fetch('/api/services');
    const data = await res.json();

    if (data.success) {
      allServices = data.services;
      renderServices(allServices, data.categories, data.currencySymbol || 'Rs.');
    }
  } catch (err) {
    console.error('Error loading services:', err);
    tbody.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-red-400">Failed to load services</td></tr>`;
  }
}

function renderServices(services, categories = [], currencySymbol = 'Rs.') {
  const tbody = document.getElementById('servicesTableBody');
  if (!tbody) return;

  if (services.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-500">No matching services found</td></tr>`;
    return;
  }

  tbody.innerHTML = services.map(s => {
    return `
      <tr class="hover:bg-slate-800/40 transition-colors">
        <td class="py-4 px-6 text-slate-500 font-mono text-xs">${s.id.replace('srv_', '#')}</td>
        <td class="py-4 px-6">
          <div class="font-bold text-white">${s.name}</div>
          <div class="text-xs text-slate-400 mt-0.5">${s.description || 'Fast auto-delivery'}</div>
        </td>
        <td class="py-4 px-6">
          <span class="font-extrabold text-emerald-400 text-base">${currencySymbol} ${s.rate}</span>
        </td>
        <td class="py-4 px-6 text-slate-400 text-xs">
          ${s.min.toLocaleString()} / ${s.max.toLocaleString()}
        </td>
        <td class="py-4 px-6">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-950/80 text-indigo-300 border border-indigo-800/50">
            <i class="fa-solid fa-bolt text-indigo-400 text-[10px]"></i> Instant Start
          </span>
        </td>
        <td class="py-4 px-6 text-right">
          <button onclick="orderService('${s.id}')" class="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-all shadow-md shadow-indigo-600/20">
            Order Now
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function filterServices() {
  const query = document.getElementById('serviceSearch').value.toLowerCase();
  const filtered = allServices.filter(s => 
    s.name.toLowerCase().includes(query) || 
    (s.description && s.description.toLowerCase().includes(query)) ||
    s.id.toLowerCase().includes(query)
  );
  renderServices(filtered);
}

function orderService(serviceId) {
  sessionStorage.setItem('selectedServiceId', serviceId);
  window.location.href = '/dashboard.html';
}

// Modal handling
function openAuthModal(tab = 'login') {
  const modal = document.getElementById('authModal');
  modal.classList.remove('hidden');
  switchAuthTab(tab);
}

function closeAuthModal() {
  document.getElementById('authModal').classList.add('hidden');
}

function switchAuthTab(tab) {
  const loginForm = document.getElementById('loginForm');
  const regForm = document.getElementById('registerForm');
  const tabLogin = document.getElementById('tabLogin');
  const tabReg = document.getElementById('tabRegister');

  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    regForm.classList.add('hidden');
    tabLogin.className = 'flex-1 py-2 rounded-lg text-sm font-bold text-white bg-indigo-600 transition-all';
    tabReg.className = 'flex-1 py-2 rounded-lg text-sm font-semibold text-slate-400 hover:text-white transition-all';
  } else {
    loginForm.classList.add('hidden');
    regForm.classList.remove('hidden');
    tabReg.className = 'flex-1 py-2 rounded-lg text-sm font-bold text-white bg-emerald-600 transition-all';
    tabLogin.className = 'flex-1 py-2 rounded-lg text-sm font-semibold text-slate-400 hover:text-white transition-all';
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (data.success) {
      Swal.fire({
        icon: 'success',
        title: 'Logged In!',
        text: data.message,
        timer: 1200,
        showConfirmButton: false,
        background: '#111827',
        color: '#f8fafc'
      }).then(() => {
        if (data.user.role === 'admin') {
          window.location.href = '/admin.html';
        } else {
          window.location.href = '/dashboard.html';
        }
      });
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Login Failed',
        text: data.error,
        background: '#111827',
        color: '#f8fafc'
      });
    }
  } catch (err) {
    Swal.fire({ icon: 'error', title: 'Error', text: err.message });
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const username = document.getElementById('regUsername').value;
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    const data = await res.json();

    if (data.success) {
      Swal.fire({
        icon: 'success',
        title: 'Account Created! 🎉',
        text: data.message,
        background: '#111827',
        color: '#f8fafc'
      }).then(() => {
        window.location.href = '/dashboard.html';
      });
    } else {
      Swal.fire({ icon: 'error', title: 'Registration Failed', text: data.error, background: '#111827', color: '#f8fafc' });
    }
  } catch (err) {
    Swal.fire({ icon: 'error', title: 'Error', text: err.message });
  }
}

// 1-Click Fast Login
async function quickLogin(username, password) {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.success) {
      if (data.user.role === 'admin') {
        window.location.href = '/admin.html';
      } else {
        window.location.href = '/dashboard.html';
      }
    } else {
      Swal.fire({ icon: 'error', title: 'Login Error', text: data.error });
    }
  } catch (err) {
    Swal.fire({ icon: 'error', title: 'Error', text: err.message });
  }
}
