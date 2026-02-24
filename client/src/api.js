// Em desenvolvimento: /api (proxy do Vite). Em produção (Amplify): use VITE_API_URL nas variáveis de ambiente do build.
const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '') || '/api';

export const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const API_NOT_RESPONDING_MSG = isLocalhost
  ? 'A API não está respondendo. Execute no terminal: npm run dev'
  : 'A API não está respondendo. No Amplify: adicione a variável de ambiente VITE_API_URL (URL da sua API) e hospede a API em Railway, Render ou similar. Veja o README do projeto.';

export async function parseJsonResponse(res) {
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    throw new Error(API_NOT_RESPONDING_MSG);
  }
  const data = await res.json();
  if (data && data.error) throw new Error(data.error);
  return data;
}

export function apiFriendlyMessage(e) {
  const msg = e?.message || '';
  if (msg.includes('<!DOCTYPE') || msg.includes('Unexpected token')) {
    return API_NOT_RESPONDING_MSG;
  }
  return msg;
}

export { API };
