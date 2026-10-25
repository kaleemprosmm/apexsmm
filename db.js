const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_FILE = path.join(__dirname, 'data.json');

// Default initial dataset
const defaultData = {
  settings: {
    siteName: 'ApexSMM - Automated Social Media Marketing Panel',
    currency: 'PKR',
    currencySymbol: 'Rs.',
    exchangeRateUsdToPkr: 280,
    provider: {
      mode: 'simulation', // 'simulation' or 'live'
      name: 'Smart Simulation Provider (Instant Auto-Delivery)',
      apiUrl: 'https://justanotherpanel.com/api/v2',
      apiKey: '',
      autoOrder: true,
      balance: 450.00
    },
    paymentDetails: {
      easypaisa: { title: 'Easypaisa Account', number: '03109792960', name: 'Kaleemullah' },
      jazzcash: { title: 'Easypaisa / Microfinance', number: '03109792960', name: 'Kaleemullah' },
      bank: { title: 'UBL (United Bank Limited)', number: '1098269477546', name: 'Kaleemullah', iban: 'PK76UNIL0109000269477546' },
      usdt: { title: 'USDT (TRC-20)', address: 'TYDzsxdczEfxxxxxxSAMPLEADDRESSxxxxxx' }
    }
  },
  users: [
    {
      id: 'usr_admin',
      username: 'kaleempro',
      email: 'kaleempro@apex-smm.com',
      passwordHash: bcrypt.hashSync('nimko1122@toto', 10),
      role: 'admin',
      balance: 100000,
      spent: 0,
      createdAt: new Date().toISOString()
    },
    {
      id: 'usr_demo',
      username: 'salman',
      email: 'salman@example.com',
      passwordHash: bcrypt.hashSync('123456', 10),
      role: 'user',
      balance: 5000,
      spent: 0,
      createdAt: new Date().toISOString()
    }
  ],
  categories: [
    { id: 'cat_tiktok', name: 'TikTok Services (Ultra Fast)', icon: 'fab fa-tiktok' },
    { id: 'cat_fb', name: 'Facebook Growth & Monetization', icon: 'fab fa-facebook' },
    { id: 'cat_insta', name: 'Instagram Followers & Likes', icon: 'fab fa-instagram' },
    { id: 'cat_yt', name: 'YouTube Watchtime & Views', icon: 'fab fa-youtube' }
  ],
  services: [
    {
      id: 'srv_101',
      categoryId: 'cat_tiktok',
      name: 'TikTok Video Views - Super Fast [Instant Start] ⚡',
      rate: 25, // PKR per 1000
      min: 500,
      max: 1000000,
      providerServiceId: '101',
      description: 'Instant start. Paste video link. 100% safe for monetization and FYP algorithm.',
      status: 'active'
    },
    {
      id: 'srv_102',
      categoryId: 'cat_tiktok',
      name: 'TikTok Real Followers - Non-Drop [HQ Profiles] 👤',
      rate: 390,
      min: 100,
      max: 50000,
      providerServiceId: '102',
      description: 'Real looking profiles with avatars and bio. Non-drop 30 days guaranteed.',
      status: 'active'
    },
    {
      id: 'srv_103',
      categoryId: 'cat_tiktok',
      name: 'TikTok Video Likes - High Speed [Organic Flow] ❤️',
      rate: 110,
      min: 100,
      max: 100000,
      providerServiceId: '103',
      description: 'Helps get your video pushed onto the For You Page (FYP).',
      status: 'active'
    },
    {
      id: 'srv_201',
      categoryId: 'cat_fb',
      name: 'Facebook Page Followers / Likes - Premium Non-Drop 🌟',
      rate: 450,
      min: 100,
      max: 50000,
      providerServiceId: '201',
      description: 'Works on both Facebook Pages and Profiles. High retention.',
      status: 'active'
    },
    {
      id: 'srv_202',
      categoryId: 'cat_fb',
      name: 'Facebook Video Views [60k Minutes Monetization eligible] 📺',
      rate: 90,
      min: 1000,
      max: 500000,
      providerServiceId: '202',
      description: 'Safe watch time minutes for in-stream ads eligibility.',
      status: 'active'
    },
    {
      id: 'srv_203',
      categoryId: 'cat_fb',
      name: 'Facebook Post Reactions / Likes [Love, Care, Like] 👍',
      rate: 140,
      min: 50,
      max: 20000,
      providerServiceId: '203',
      description: 'Organic mix reactions to increase post engagement.',
      status: 'active'
    },
    {
      id: 'srv_301',
      categoryId: 'cat_insta',
      name: 'Instagram Followers - Instant Start [Refill 30 Days] 📸',
      rate: 280,
      min: 100,
      max: 50000,
      providerServiceId: '301',
      description: 'Speed: 5k-10k per day. Quality: Mixed Global.',
      status: 'active'
    },
    {
      id: 'srv_401',
      categoryId: 'cat_yt',
      name: 'YouTube High Retention Video Views [Non-Drop] 🎬',
      rate: 350,
      min: 1000,
      max: 100000,
      providerServiceId: '401',
      description: 'Views with 3-5 minutes average watch duration. Safe for Adsense.',
      status: 'active'
    }
  ],
  orders: [
    {
      id: 'ord_1001',
      userId: 'usr_demo',
      username: 'salman',
      serviceId: 'srv_101',
      serviceName: 'TikTok Video Views - Super Fast [Instant Start] ⚡',
      link: 'https://www.tiktok.com/@sample/video/7123456789',
      quantity: 10000,
      charge: 250,
      status: 'Completed',
      providerOrderId: 'SIM-98213',
      startCount: 154,
      remains: 0,
      createdAt: new Date(Date.now() - 3600000 * 5).toISOString()
    }
  ],
  transactions: [
    {
      id: 'txn_5001',
      userId: 'usr_demo',
      username: 'salman',
      method: 'JazzCash',
      amount: 5250,
      status: 'Approved',
      trxId: 'JC9876543210',
      proof: null,
      createdAt: new Date(Date.now() - 3600000 * 6).toISOString()
    }
  ]
};

// In-memory cache
let cachedData = null;

function loadData() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2), 'utf-8');
      cachedData = JSON.parse(JSON.stringify(defaultData));
    } else {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      cachedData = JSON.parse(content);
    }
  } catch (err) {
    console.error('Error loading DB file:', err);
    if (!cachedData) cachedData = JSON.parse(JSON.stringify(defaultData));
  }
  return cachedData;
}

function saveData() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(cachedData, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving DB file:', err);
  }
}

// Initialize on require
loadData();

module.exports = {
  get: () => cachedData || loadData(),
  save: () => saveData(),
  reload: () => loadData()
};
