/* ==========================================================================
   UZU UNION BANK — API Client
   Centralized HTTP client for all backend API calls.
   ========================================================================== */

const ApiClient = (() => {
  const BASE = '/api';

  async function request(method, path, body = null) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    const token = sessionStorage.getItem('uzu_token');
    if (token) {
      opts.headers['Authorization'] = `Bearer ${token}`;
    }
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${BASE}${path}`, opts);
    const data = await res.json();

    if (!res.ok) {
      const err = new Error(data.error || `Request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    login: (email, password) => request('POST', '/auth/login', { email, password }),
    register: (data) => request('POST', '/auth/register', data),
    getProfile: () => request('GET', '/auth/me'),
    getStatus: () => request('GET', '/status'),
  };
})();