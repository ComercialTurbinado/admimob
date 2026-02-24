// Em desenvolvimento: /api (proxy do Vite). Em produção (Amplify): use VITE_API_URL nas variáveis de ambiente do build.
const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '') || '/api';

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
    return import.meta.env.VITE_API_URL
      ? 'A API não está respondendo. Verifique a URL em Amplify (VITE_API_URL) e se o servidor da API está no ar.'
      : 'A API não está respondendo. Execute no terminal: npm run dev';
  }
  return msg;
}

export { API };
