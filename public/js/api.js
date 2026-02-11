// API Wrapper Functions

const API = {
  // Generic fetch wrapper
  async request(url, options = {}) {
    try {
      const response = await fetch(url, options);
      return { response, ok: response.ok };
    } catch (error) {
      console.error('API Request Error:', error);
      return { response: null, ok: false, error };
    }
  },

  // GET request
  async get(endpoint) {
    const { response, ok } = await this.request(endpoint);
    if (ok) {
      return await response.json();
    }
    return null;
  },

  // POST request
  async post(endpoint, data) {
    const { response, ok } = await this.request(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return { response, ok };
  },

  // PUT request
  async put(endpoint, data) {
    const { response, ok } = await this.request(endpoint, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return { response, ok };
  },

  // DELETE request
  async delete(endpoint) {
    const { response, ok } = await this.request(endpoint, {
      method: 'DELETE'
    });
    return { response, ok };
  },

  // Devices API
  devices: {
    getAll: () => API.get('/devices'),
    getById: (id) => API.get(`/devices/${id}`),
    delete: (id) => API.delete(`/devices/${id}`),
    getRules: (id) => API.get(`/device_rules/${id}/rules`),
    saveRules: (id, rules) => API.post(`/device_rules/${id}/rules`, rules)
  },

  // Users API
  users: {
    getAll: () => API.get('/users'),
    create: (data) => API.post('/users', data),
    delete: (id) => API.delete(`/users/${id}`)
  },

  // QR Codes API
  qrcodes: {
    getAll: () => API.get('/qrcodes'),
    createBulk: (count) => API.post('/qrcodes/bulk', { count }),
    assignDevice: (qrId, data) => API.post(`/qrcodes/${qrId}/assign_device`, data),
    changeCity: (qrId, cityId) => API.post(`/qrcodes/${qrId}/change_city`, { city_id: cityId })
  },

  // System Groups API
  groups: {
    getAll: (cityId) => API.get('/system_groups' + (cityId ? `?cityId=${cityId}` : '')),
    getQRCodes: (id) => API.get(`/system_groups/${id}/qrcodes`),
    create: (data) => API.post('/system_groups', data),
    update: (id, data) => API.put(`/system_groups/${id}`, data),
    delete: (id) => API.delete(`/system_groups/${id}`),
    assignQRCodes: (id, qr_ids) => API.post(`/system_groups/${id}/assign_qrcodes`, { qr_ids })
  },

  // Cities API
  cities: {
    getAll: () => API.get('/cities')
  },

  // Logs API
  logs: {
    get: (params) => API.get('/logs?' + new URLSearchParams(params).toString())
  },

  // Calendar API
  calendar: {
    getMonth: (year, month) => API.get(`/calendar/month?year=${year}&month=${month}`)
  }
};