import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API, parseJsonResponse, apiFriendlyMessage } from '../api';

const DEFAULT_DATA = {
  payment_links: { plan_65: '', plan_297: '', plan_497: '' },
  webhook_captacao: '',
  webhook_producao: '',
  plans: [
    { id: '297', label: 'R$ 297', price: 297, credit_label: 'Vídeos simples', credit_count: 5, payment_url: '' },
    { id: '497', label: 'R$ 497', price: 497, credit_label: 'Vídeos simples', credit_count: 10, payment_url: '' },
    { id: '997', label: 'R$ 997', price: 997, credit_label: 'Vídeos com narração', credit_count: 10, payment_url: '' },
  ],
};

export default function Config() {
  const [data, setData] = useState(DEFAULT_DATA);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(API + '/dashboard')
      .then(parseJsonResponse)
      .then((d) => {
        const plans = Array.isArray(d.plans) ? d.plans.map((p) => ({ ...p, payment_url: p.payment_url ?? '' })) : DEFAULT_DATA.plans;
        setData({
          payment_links: d.payment_links || DEFAULT_DATA.payment_links,
          webhook_captacao: d.webhook_captacao ?? '',
          webhook_producao: d.webhook_producao ?? '',
          plans,
        });
      })
      .catch(() => {
        setMsg('Não foi possível carregar do servidor. Você pode editar e salvar quando a API estiver rodando.');
      })
      .finally(() => setLoading(false));
  }, []);

  function update(field, key, value) {
    if (!data) return;
    if (field === 'payment_links') setData({ ...data, payment_links: { ...data.payment_links, [key]: value } });
    else setData({ ...data, [field]: value });
  }

  function updatePlan(index, key, value) {
    if (!data) return;
    const plans = [...(data.plans || [])];
    if (!plans[index]) return;
    plans[index] = { ...plans[index], [key]: value };
    setData({ ...data, plans });
  }

  function addPlan() {
    const plans = [...(data?.plans || []), { id: '', label: '', price: 0, credit_label: '', credit_count: 0, payment_url: '' }];
    setData({ ...data, plans });
  }

  function removePlan(index) {
    const plans = (data.plans || []).filter((_, i) => i !== index);
    setData({ ...data, plans });
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(API + '/dashboard', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_links: data.payment_links,
          webhook_captacao: data.webhook_captacao,
          webhook_producao: data.webhook_producao,
          plans: data.plans,
        }),
      });
      await parseJsonResponse(res);
      setMsg('Configurações salvas com sucesso.');
    } catch (e) {
      setMsg('Erro: ' + apiFriendlyMessage(e));
    } finally {
      setSaving(false);
    }
  }

  const plans = data.plans || [];

  return (
    <>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/">← Dashboard</Link>
      </div>

      {loading && <p className="muted" style={{ marginBottom: '1rem' }}>Carregando dados do servidor...</p>}

      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ marginBottom: '0.25rem' }}>Configurações</h1>
        <p style={{ color: 'var(--muted)', margin: 0 }}>
          Gerencie indicadores do dashboard, planos, links de pagamento e webhooks (n8n) em um só lugar.
        </p>
      </div>

      {/* 1. Planos + créditos + link de pagamento */}
      <section className="card config-section">
        <h2 className="config-section-title">1. Planos e links de pagamento</h2>
        <p className="config-section-desc">
          Cada plano aparece no cadastro do cliente (select) e controla os créditos (ex.: 10 vídeos simples).
          Se preencher <strong>Link de pagamento</strong>, um botão com esse valor aparece no dashboard para gerar cobrança.
        </p>
        <div className="config-plans-table-wrap">
          <table className="config-plans-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Label</th>
                <th>Preço (R$)</th>
                <th>Tipo de crédito</th>
                <th>Qtd. créditos</th>
                <th>Link de pagamento (URL)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p, index) => (
                <tr key={index}>
                  <td>
                    <input
                      value={p.id || ''}
                      onChange={(e) => updatePlan(index, 'id', e.target.value)}
                      placeholder="497"
                      className="config-input-inline"
                    />
                  </td>
                  <td>
                    <input
                      value={p.label || ''}
                      onChange={(e) => updatePlan(index, 'label', e.target.value)}
                      placeholder="R$ 497"
                      className="config-input-inline"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={p.price ?? ''}
                      onChange={(e) => updatePlan(index, 'price', Number(e.target.value) || 0)}
                      placeholder="497"
                      className="config-input-inline"
                    />
                  </td>
                  <td>
                    <input
                      value={p.credit_label || ''}
                      onChange={(e) => updatePlan(index, 'credit_label', e.target.value)}
                      placeholder="Vídeos simples"
                      className="config-input-inline"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      value={p.credit_count ?? ''}
                      onChange={(e) => updatePlan(index, 'credit_count', Number(e.target.value) || 0)}
                      placeholder="10"
                      className="config-input-inline"
                    />
                  </td>
                  <td>
                    <input
                      type="url"
                      value={p.payment_url ?? ''}
                      onChange={(e) => updatePlan(index, 'payment_url', e.target.value)}
                      placeholder="https://..."
                      className="config-input-inline config-input-url"
                    />
                  </td>
                  <td>
                    <button type="button" className="btn btn-danger" style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem' }} onClick={() => removePlan(index)}>
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" className="btn" onClick={addPlan} style={{ marginTop: '0.75rem' }}>
          + Adicionar plano
        </button>
      </section>

      {/* 3. Webhooks */}
      <section className="card config-section">
        <h2 className="config-section-title">2. Webhooks (n8n)</h2>
        <p className="config-section-desc">
          URLs dos fluxos no n8n. <strong>Captação</strong>: ao colar o link do anúncio e clicar em Importar, o sistema envia essa URL. <strong>Produção</strong>: ao clicar em FireMode Now na Central de Produção, o payload é enviado para essa URL.
        </p>
        <div className="form-group">
          <label>URL do webhook de captação (importar anúncio por link)</label>
          <input
            type="url"
            value={data.webhook_captacao ?? ''}
            onChange={(e) => update('webhook_captacao', null, e.target.value)}
            placeholder="https://seu-n8n.com/webhook/..."
          />
        </div>
        <div className="form-group">
          <label>URL do webhook de produção (FireMode Now)</label>
          <input
            type="url"
            value={data.webhook_producao ?? ''}
            onChange={(e) => update('webhook_producao', null, e.target.value)}
            placeholder="https://seu-n8n.com/webhook/..."
          />
        </div>
      </section>

      {msg && (
        <p style={{ color: msg.startsWith('Erro') ? 'var(--danger)' : 'var(--success)', marginBottom: '1rem' }}>
          {msg}
        </p>
      )}
      <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
        {saving ? 'Salvando...' : 'Salvar todas as configurações'}
      </button>
    </>
  );
}
