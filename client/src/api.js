const API = '/api';

export async function parseJsonResponse(res) {
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    throw new Error('A API não está respondendo. Execute no terminal: npm run dev');
  }
  const data = await res.json();
  if (data && data.error) throw new Error(data.error);
  return data;
}

export function apiFriendlyMessage(e) {
  const msg = e?.message || '';
  if (msg.includes('<!DOCTYPE') || msg.includes('Unexpected token')) {
    return 'A API não está respondendo. Execute no terminal: npm run dev';
  }
  return msg;
}

export { API };
