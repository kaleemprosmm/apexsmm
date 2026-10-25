const axios = require('axios');
const db = require('./db');

/**
 * Universal SMM API v2 Connector & Simulator Engine
 */
class ProviderService {
  /**
   * Check connection and get provider balance
   */
  async getBalance() {
    const data = db.get();
    const config = data.settings.provider;

    if (config.mode === 'simulation') {
      return {
        success: true,
        mode: 'simulation',
        balance: config.balance !== undefined ? config.balance : 450.00,
        currency: 'USD',
        message: 'Simulation Mode Active: Ready for instant testing'
      };
    }

    if (!config.apiUrl || !config.apiKey) {
      return {
        success: false,
        error: 'Provider API URL or API Key is missing. Please enter them in Admin Settings.'
      };
    }

    try {
      const params = new URLSearchParams();
      params.append('key', config.apiKey);
      params.append('action', 'balance');

      const response = await axios.post(config.apiUrl, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000
      });

      if (response.data && response.data.balance !== undefined) {
        config.balance = parseFloat(response.data.balance);
        db.save();
        return {
          success: true,
          mode: 'live',
          balance: response.data.balance,
          currency: response.data.currency || 'USD'
        };
      } else {
        return {
          success: false,
          error: response.data?.error || 'Provider rejected request: ' + JSON.stringify(response.data)
        };
      }
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.error || err.message || 'Connection failed to provider'
      };
    }
  }

  /**
   * Fetch full services list from provider
   */
  async fetchServices() {
    const data = db.get();
    const config = data.settings.provider;

    if (config.mode === 'simulation') {
      return {
        success: true,
        services: data.services.map(s => ({
          service: s.providerServiceId || s.id,
          name: s.name,
          rate: (s.rate / 280).toFixed(4),
          min: s.min,
          max: s.max,
          category: 'Simulation Services'
        }))
      };
    }

    if (!config.apiUrl || !config.apiKey) {
      return { success: false, error: 'Provider API key is missing' };
    }

    try {
      const params = new URLSearchParams();
      params.append('key', config.apiKey);
      params.append('action', 'services');

      const response = await axios.post(config.apiUrl, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000
      });

      if (Array.isArray(response.data)) {
        return { success: true, services: response.data };
      } else {
        return { success: false, error: response.data?.error || 'Could not fetch services list' };
      }
    } catch (err) {
      return { success: false, error: err.response?.data?.error || err.message };
    }
  }

  /**
   * Send order to provider (or simulate order)
   */
  async placeOrder(service, link, quantity) {
    const data = db.get();
    const config = data.settings.provider;

    if (config.mode === 'simulation') {
      // Realistic simulation: assign realistic order ID and deduct mock provider cost
      const simOrderId = 'SIM-' + Math.floor(10000 + Math.random() * 90000);
      const estCostUsd = ((quantity / 1000) * (service.rate / (data.settings.exchangeRateUsdToPkr || 280)) * 0.7).toFixed(3);
      if (config.balance >= estCostUsd) {
        config.balance = Math.max(0, parseFloat((config.balance - estCostUsd).toFixed(2)));
        db.save();
      }

      return {
        success: true,
        providerOrderId: simOrderId,
        status: 'In Progress',
        startCount: Math.floor(50 + Math.random() * 500)
      };
    }

    // Live mode
    if (!config.apiUrl || !config.apiKey) {
      return {
        success: false,
        error: 'Provider API is not configured. Please switch to simulation or enter your API key in Admin.'
      };
    }

    try {
      const params = new URLSearchParams();
      params.append('key', config.apiKey);
      params.append('action', 'add');
      params.append('service', service.providerServiceId || '1');
      params.append('link', link);
      params.append('quantity', quantity);

      const response = await axios.post(config.apiUrl, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000
      });

      if (response.data && response.data.order) {
        return {
          success: true,
          providerOrderId: String(response.data.order),
          status: 'In Progress',
          startCount: 0
        };
      } else {
        return {
          success: false,
          error: response.data?.error || 'Provider rejected order: ' + JSON.stringify(response.data)
        };
      }
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.error || err.message || 'Failed to place order with provider'
      };
    }
  }

  /**
   * Sync order status with auto-refund on cancellation
   */
  async syncOrderStatus(order) {
    const data = db.get();
    const config = data.settings.provider;

    // Simulation order sync
    if (order.providerOrderId?.startsWith('SIM-') || config.mode === 'simulation') {
      const orderAgeMinutes = (Date.now() - new Date(order.createdAt).getTime()) / (1000 * 60);
      if (orderAgeMinutes > 2 && order.status !== 'Completed' && order.status !== 'Canceled') {
        order.status = 'Completed';
        order.remains = 0;
        db.save();
      } else if (order.status === 'Pending') {
        order.status = 'In Progress';
        db.save();
      }
      return order;
    }

    // Live sync
    if (!config.apiUrl || !config.apiKey || !order.providerOrderId) return order;

    try {
      const params = new URLSearchParams();
      params.append('key', config.apiKey);
      params.append('action', 'status');
      params.append('order', order.providerOrderId);

      const response = await axios.post(config.apiUrl, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000
      });

      if (response.data && response.data.status) {
        const rawStatus = response.data.status.toLowerCase();
        
        if (rawStatus.includes('complete')) {
          order.status = 'Completed';
          order.remains = 0;
        } else if (rawStatus.includes('process') || rawStatus.includes('progress') || rawStatus.includes('pending')) {
          order.status = 'In Progress';
        } else if (rawStatus.includes('cancel') || rawStatus.includes('refund')) {
          // Auto-refund user if provider canceled order
          if (order.status !== 'Canceled' && order.status !== 'Refunded') {
            order.status = 'Canceled';
            const user = data.users.find(u => u.id === order.userId);
            if (user) {
              user.balance = parseFloat((user.balance + order.charge).toFixed(2));
              user.spent = Math.max(0, parseFloat(((user.spent || 0) - order.charge).toFixed(2)));
            }
          }
        } else if (rawStatus.includes('partial')) {
          order.status = 'Partial';
        }

        if (response.data.start_count !== undefined) order.startCount = parseInt(response.data.start_count);
        if (response.data.remains !== undefined) order.remains = parseInt(response.data.remains);
        db.save();
      }
    } catch (err) {
      console.warn('Status sync error for order', order.id, err.message);
    }

    return order;
  }
}

module.exports = new ProviderService();
