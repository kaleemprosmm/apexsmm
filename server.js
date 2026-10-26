const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const db = require('./db');
const providerService = require('./providerService');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'apex-smm-super-secret-key-2026';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Ensure upload folder exists
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage for payment receipts
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, 'receipt_' + Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Auth Middleware
function authenticateToken(req, res, next) {
  const token = req.cookies.smm_token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
  if (!token) {
    return res.status(401).json({ success: false, error: 'Login required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false, error: 'Invalid or expired session' });
    req.user = user;
    next();
  });
}

function requireAdmin(req, res, next) {
  authenticateToken(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied: Admin permissions required' });
    }
    next();
  });
}

// ==================== AUTH ROUTES ====================

app.post('/api/auth/register', (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ success: false, error: 'Please fill all required fields' });
  }

  const data = db.get();
  const existingUser = data.users.find(u => u.username.toLowerCase() === username.toLowerCase() || u.email.toLowerCase() === email.toLowerCase());
  if (existingUser) {
    return res.status(400).json({ success: false, error: 'Username or Email is already registered' });
  }

  const newUser = {
    id: 'usr_' + Date.now(),
    username: username.trim(),
    email: email.trim(),
    passwordHash: bcrypt.hashSync(password, 10),
    role: 'user',
    balance: 0,
    spent: 0,
    createdAt: new Date().toISOString()
  };

  data.users.push(newUser);
  db.save();

  const token = jwt.sign({ id: newUser.id, username: newUser.username, role: newUser.role }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('smm_token', token, { httpOnly: true, maxAge: 7 * 24 * 3600 * 1000 });

  res.json({
    success: true,
    message: 'Account created successfully! Welcome to ApexSMM.',
    user: { id: newUser.id, username: newUser.username, email: newUser.email, role: newUser.role, balance: newUser.balance }
  });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Enter username and password' });
  }

  const data = db.get();
  const user = data.users.find(u => u.username.toLowerCase() === username.toLowerCase() || u.email.toLowerCase() === username.toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(400).json({ success: false, error: 'Invalid username or password' });
  }

  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('smm_token', token, { httpOnly: true, maxAge: 7 * 24 * 3600 * 1000 });

  res.json({
    success: true,
    message: 'Welcome back, ' + user.username,
    user: { id: user.id, username: user.username, email: user.email, role: user.role, balance: user.balance }
  });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  const data = db.get();
  const user = data.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      balance: user.balance,
      spent: user.spent || 0
    }
  });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('smm_token');
  res.json({ success: true, message: 'Logged out successfully' });
});

// ==================== SERVICES & CATEGORIES ====================

app.get('/api/services', (req, res) => {
  const data = db.get();
  res.json({
    success: true,
    categories: data.categories,
    services: data.services.filter(s => s.status === 'active'),
    currency: data.settings.currency,
    currencySymbol: data.settings.currencySymbol
  });
});

app.post('/api/admin/services', requireAdmin, (req, res) => {
  const { categoryId, name, rate, min, max, providerServiceId, description } = req.body;
  if (!categoryId || !name || !rate) {
    return res.status(400).json({ success: false, error: 'Please enter category, service name and rate' });
  }

  const data = db.get();
  const newService = {
    id: 'srv_' + Date.now(),
    categoryId,
    name,
    rate: parseFloat(rate),
    min: parseInt(min) || 100,
    max: parseInt(max) || 100000,
    providerServiceId: providerServiceId || '1',
    description: description || '',
    status: 'active'
  };

  data.services.push(newService);
  db.save();
  res.json({ success: true, message: 'Service added successfully', service: newService });
});

app.put('/api/admin/services/:id', requireAdmin, (req, res) => {
  const data = db.get();
  const srv = data.services.find(s => s.id === req.params.id);
  if (!srv) return res.status(404).json({ success: false, error: 'Service not found' });

  Object.assign(srv, req.body);
  db.save();
  res.json({ success: true, message: 'Service updated', service: srv });
});

app.delete('/api/admin/services/:id', requireAdmin, (req, res) => {
  const data = db.get();
  data.services = data.services.filter(s => s.id !== req.params.id);
  db.save();
  res.json({ success: true, message: 'Service removed' });
});

// ==================== ORDER PLACEMENT & MANAGEMENT ====================

app.post('/api/orders', authenticateToken, async (req, res) => {
  const { serviceId, link, quantity } = req.body;
  const qty = parseInt(quantity);

  if (!serviceId || !link || !qty || qty <= 0) {
    return res.status(400).json({ success: false, error: 'Please fill valid link, service and quantity' });
  }

  const data = db.get();
  const user = data.users.find(u => u.id === req.user.id);
  const service = data.services.find(s => s.id === serviceId);

  if (!service) return res.status(404).json({ success: false, error: 'Service not found' });
  if (qty < service.min || qty > service.max) {
    return res.status(400).json({ success: false, error: `Quantity must be between ${service.min} and ${service.max}` });
  }

  // Calculate charge (rate is per 1000)
  const charge = parseFloat(((qty / 1000) * service.rate).toFixed(2));

  if (user.balance < charge) {
    return res.status(400).json({
      success: false,
      error: `Insufficient balance! Order costs Rs. ${charge}, but your current balance is Rs. ${user.balance}. Please add funds.`
    });
  }

  // Automatically dispatch order to Wholesale SMM Provider / Simulator
  const providerResult = await providerService.placeOrder(service, link, qty);

  if (!providerResult.success) {
    return res.status(400).json({
      success: false,
      error: `Wholesale Provider Error: "${providerResult.error}". (Please check your provider balance on JustAnotherPanel or service ID). Aapka balance mehfooz hai aur nahi kata gaya.`
    });
  }

  // Deduct balance ONLY when order is confirmed by provider
  user.balance = parseFloat((user.balance - charge).toFixed(2));
  user.spent = parseFloat(((user.spent || 0) + charge).toFixed(2));

  const newOrder = {
    id: 'ord_' + Date.now(),
    userId: user.id,
    username: user.username,
    serviceId: service.id,
    serviceName: service.name,
    link: link.trim(),
    quantity: qty,
    charge: charge,
    status: providerResult.status || 'In Progress',
    providerOrderId: providerResult.providerOrderId || null,
    providerError: null,
    startCount: providerResult.startCount || 0,
    remains: qty,
    createdAt: new Date().toISOString()
  };

  data.orders.unshift(newOrder);
  db.save();

  res.json({
    success: true,
    message: 'Order placed & forwarded to wholesale provider successfully! Delivery in progress.',
    order: newOrder,
    remainingBalance: user.balance
  });
});

app.get('/api/orders', authenticateToken, async (req, res) => {
  const data = db.get();
  let userOrders = data.orders.filter(o => o.userId === req.user.id);

  // Sync statuses of active orders
  for (let order of userOrders) {
    if (order.status === 'In Progress' || order.status === 'Pending') {
      await providerService.syncOrderStatus(order);
    }
  }

  res.json({
    success: true,
    orders: userOrders
  });
});

app.get('/api/admin/orders', requireAdmin, async (req, res) => {
  const data = db.get();
  for (let order of data.orders) {
    if (order.status === 'In Progress' || order.status === 'Pending') {
      await providerService.syncOrderStatus(order);
    }
  }

  res.json({
    success: true,
    orders: data.orders
  });
});

app.post('/api/admin/orders/:id/action', requireAdmin, (req, res) => {
  const { action, status } = req.body;
  const data = db.get();
  const order = data.orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

  if (action === 'setStatus' && status) {
    order.status = status;
    if (status === 'Completed') order.remains = 0;
    db.save();
    return res.json({ success: true, message: `Status updated to ${status}`, order });
  }

  if (action === 'refund') {
    const user = data.users.find(u => u.id === order.userId);
    if (user && order.status !== 'Refunded') {
      user.balance += order.charge;
      order.status = 'Refunded';
      db.save();
      return res.json({ success: true, message: `Order refunded Rs. ${order.charge} back to user ${user.username}`, order });
    }
  }

  res.status(400).json({ success: false, error: 'Invalid action' });
});

// ==================== PAYMENTS & DEPOSITS ====================

app.get('/api/payment/details', (req, res) => {
  const data = db.get();
  res.json({
    success: true,
    paymentDetails: data.settings.paymentDetails,
    currency: data.settings.currency,
    currencySymbol: data.settings.currencySymbol
  });
});

app.post('/api/admin/payment-settings', requireAdmin, (req, res) => {
  const { easypaisa, jazzcash, bank, usdt } = req.body;
  const data = db.get();
  if (easypaisa) data.settings.paymentDetails.easypaisa = easypaisa;
  if (jazzcash) data.settings.paymentDetails.jazzcash = jazzcash;
  if (bank) data.settings.paymentDetails.bank = bank;
  if (usdt) data.settings.paymentDetails.usdt = usdt;
  db.save();
  res.json({ success: true, message: 'Payment account details updated successfully!', paymentDetails: data.settings.paymentDetails });
});

app.post('/api/payment/deposit', authenticateToken, upload.single('receipt'), (req, res) => {
  const { method, amount, trxId } = req.body;
  const amt = parseFloat(amount);

  if (!method || !amt || amt <= 0 || !trxId) {
    return res.status(400).json({ success: false, error: 'Please specify payment method, valid amount and Transaction ID (TID)' });
  }

  const data = db.get();
  const newTxn = {
    id: 'txn_' + Date.now(),
    userId: req.user.id,
    username: req.user.username,
    method,
    amount: amt,
    trxId: trxId.trim(),
    proof: req.file ? `/uploads/${req.file.filename}` : null,
    status: 'Pending',
    createdAt: new Date().toISOString()
  };

  data.transactions.unshift(newTxn);
  db.save();

  res.json({
    success: true,
    message: 'Deposit request submitted! Admin will verify and credit your balance within minutes.',
    transaction: newTxn
  });
});

app.get('/api/payment/history', authenticateToken, (req, res) => {
  const data = db.get();
  const txns = data.transactions.filter(t => t.userId === req.user.id);
  res.json({ success: true, transactions: txns });
});

app.get('/api/admin/transactions', requireAdmin, (req, res) => {
  const data = db.get();
  res.json({ success: true, transactions: data.transactions });
});

app.post('/api/admin/transactions/:id/approve', requireAdmin, (req, res) => {
  const data = db.get();
  const txn = data.transactions.find(t => t.id === req.params.id);
  if (!txn) return res.status(404).json({ success: false, error: 'Transaction not found' });
  if (txn.status === 'Approved') return res.status(400).json({ success: false, error: 'Already approved' });

  const user = data.users.find(u => u.id === txn.userId);
  if (user) {
    user.balance = parseFloat((user.balance + txn.amount).toFixed(2));
  }
  txn.status = 'Approved';
  txn.approvedAt = new Date().toISOString();
  db.save();

  res.json({ success: true, message: `Payment of Rs. ${txn.amount} approved and balance added to ${user ? user.username : 'user'}!` });
});

app.post('/api/admin/transactions/:id/reject', requireAdmin, (req, res) => {
  const data = db.get();
  const txn = data.transactions.find(t => t.id === req.params.id);
  if (!txn) return res.status(404).json({ success: false, error: 'Transaction not found' });

  txn.status = 'Rejected';
  db.save();
  res.json({ success: true, message: 'Transaction rejected' });
});

// ==================== ADMIN SETTINGS & PROVIDER API ====================

app.get('/api/admin/provider-status', requireAdmin, async (req, res) => {
  const result = await providerService.getBalance();
  const data = db.get();
  res.json({
    success: true,
    config: data.settings.provider,
    status: result
  });
});

app.get('/api/admin/provider-services', requireAdmin, async (req, res) => {
  const result = await providerService.fetchServices();
  res.json(result);
});

app.post('/api/admin/provider-config', requireAdmin, async (req, res) => {
  const { mode, name, apiUrl, apiKey, autoOrder } = req.body;
  const data = db.get();

  if (mode) data.settings.provider.mode = mode;
  if (name) data.settings.provider.name = name;
  if (apiUrl !== undefined) data.settings.provider.apiUrl = apiUrl.trim();
  if (apiKey !== undefined) data.settings.provider.apiKey = apiKey.trim();
  if (autoOrder !== undefined) data.settings.provider.autoOrder = !!autoOrder;

  db.save();

  // Test newly configured provider
  const testResult = await providerService.getBalance();

  res.json({
    success: true,
    message: 'Provider configuration saved successfully!',
    config: data.settings.provider,
    testResult
  });
});

app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const data = db.get();
  const totalUsers = data.users.length;
  const totalOrders = data.orders.length;
  const totalRevenue = data.orders.reduce((sum, o) => sum + (o.charge || 0), 0);
  const pendingDeposits = data.transactions.filter(t => t.status === 'Pending').length;

  res.json({
    success: true,
    stats: {
      totalUsers,
      totalOrders,
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      pendingDeposits,
      providerBalance: data.settings.provider.balance || 0,
      providerMode: data.settings.provider.mode
    }
  });
});

app.get('/api/admin/users', requireAdmin, (req, res) => {
  const data = db.get();
  const usersClean = data.users.map(u => ({
    id: u.id,
    username: u.username,
    email: u.email,
    role: u.role,
    balance: u.balance,
    spent: u.spent || 0,
    createdAt: u.createdAt
  }));
  res.json({ success: true, users: usersClean });
});

app.post('/api/admin/users/:id/balance', requireAdmin, (req, res) => {
  const { amount, action } = req.body;
  const amt = parseFloat(amount);
  if (isNaN(amt)) return res.status(400).json({ success: false, error: 'Valid amount required' });

  const data = db.get();
  const user = data.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  if (action === 'set') {
    user.balance = amt;
  } else if (action === 'deduct') {
    user.balance = Math.max(0, user.balance - amt);
  } else {
    // Add
    user.balance += amt;
  }
  user.balance = parseFloat(user.balance.toFixed(2));
  db.save();

  res.json({ success: true, message: `Balance for ${user.username} is now Rs. ${user.balance}`, newBalance: user.balance });
});

// ==================== EXTERNAL SMM API v2 (Allow clients to order via API) ====================

app.post('/api/v2', (req, res) => {
  const { action, key, service, link, quantity, order } = req.body;
  const data = db.get();

  // Find user by key (or default admin for demo API)
  const user = data.users.find(u => u.id === key || u.username === key || key === 'demo-api-key');
  if (!user && action !== 'services') {
    return res.status(401).json({ error: 'Incorrect request or invalid API key' });
  }

  if (action === 'services') {
    const list = data.services.map(s => ({
      service: s.id,
      name: s.name,
      type: 'Default',
      category: data.categories.find(c => c.id === s.categoryId)?.name || 'General',
      rate: s.rate,
      min: s.min,
      max: s.max
    }));
    return res.json(list);
  }

  if (action === 'balance') {
    return res.json({ balance: user.balance, currency: data.settings.currency });
  }

  if (action === 'add') {
    const qty = parseInt(quantity);
    const srv = data.services.find(s => s.id === service);
    if (!srv) return res.status(400).json({ error: 'Invalid service' });
    if (qty < srv.min || qty > srv.max) return res.status(400).json({ error: `Quantity must be between ${srv.min} and ${srv.max}` });

    const charge = parseFloat(((qty / 1000) * srv.rate).toFixed(2));
    if (user.balance < charge) return res.status(400).json({ error: 'Not enough funds on balance' });

    user.balance -= charge;
    const newOrd = {
      id: 'ord_' + Date.now(),
      userId: user.id,
      username: user.username,
      serviceId: srv.id,
      serviceName: srv.name,
      link,
      quantity: qty,
      charge,
      status: 'In Progress',
      startCount: 0,
      remains: qty,
      createdAt: new Date().toISOString()
    };
    data.orders.unshift(newOrd);
    db.save();
    return res.json({ order: newOrd.id });
  }

  if (action === 'status') {
    const ord = data.orders.find(o => o.id === order);
    if (!ord) return res.status(404).json({ error: 'Incorrect order ID' });
    return res.json({
      charge: ord.charge,
      start_count: ord.startCount || 0,
      status: ord.status,
      remains: ord.remains || 0,
      currency: data.settings.currency
    });
  }

  res.status(400).json({ error: 'Invalid action parameter' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`🚀 ApexSMM Panel is running live on: http://localhost:${PORT}`);
  console.log(`=======================================================`);
});

module.exports = app;
