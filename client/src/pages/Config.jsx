import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API, parseJsonResponse, apiFriendlyMessage } from '../api';
import PageHeader from '../components/PageHeader';

const DEFAULT_DATA = {
  payment_links: { plan_65: '', plan_297: '', plan_497: '' },
  webhook_captacao: '',
  webhook_producao: '',
  webhook_materiais: '',
  webhook_frames_save: '',
  webhook_frames_done: '',
  browserless_ws_url: '',
  webhook_montar_mp4: '',
  webhook_logo: '',
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
          webhook_materiais: d.webhook_materiais ?? '',
          webhook_frames_save: d.webhook_frames_save ?? '',
          webhook_frames_done: d.webhook_frames_done ?? '',
          browserless_ws_url: d.browserless_ws_url ?? '',
          webhook_montar_mp4: d.webhook_montar_mp4 ?? '',
          webhook_logo: d.webhook_logo ?? '',
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
          webhook_materiais: data.webhook_materiais,
          webhook_frames_save: data.webhook_frames_save,
          webhook_frames_done: data.webhook_frames_done,
          browserless_ws_url: data.browserless_ws_url,
          webhook_montar_mp4: data.webhook_montar_mp4,
          webhook_logo: data.webhook_logo,
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
      <PageHeader
        title="Configurações"
        subtitle="Planos, links de pagamento, webhooks e indicadores do dashboard"
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Configurações' }]}
      />
      {loading && <p className="muted" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>Carregando dados do servidor...</p>}

      {/* 1. Poster animado — captura de frames */}
      <section className="card config-section">
        <h2 className="config-section-title">2. Poster animado — captura de frames</h2>
        <p className="config-section-desc">
          Fluxo do botão <strong>"Enviar frames ao webhook"</strong> na página Materiais (layouts Opção 1 / Opção 2):<br />
          Serviço de captura abre a página do poster → tira prints frame a frame → envia cada frame → ao terminar notifica e solicita montagem do MP4.
        </p>
        <div className="form-group">
          <label><span className="config-field-name">[1 — Serviço de captura]</span> URL do serviço que abre o navegador headless</label>
          <input
            name="browserless_ws_url"
            type="text"
            value={data.browserless_ws_url ?? ''}
            onChange={(e) => update('browserless_ws_url', null, e.target.value)}
            placeholder="https://capture-service.../open"
          />
          <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: '0.25rem 0 0' }}>
            Railway envia a URL do poster para este serviço; ele abre a página no Chrome (Puppeteer/CDP) e captura os frames nativamente. Se vazio, abre um popup no próprio navegador do usuário.
          </p>
        </div>
        <div className="form-group">
          <label><span className="config-field-name">[2 — Salvar frame]</span> Webhook que recebe cada frame individualmente</label>
          <input
            name="webhook_frames_save"
            type="url"
            value={data.webhook_frames_save ?? ''}
            onChange={(e) => update('webhook_frames_save', null, e.target.value)}
            placeholder="https://n8n.../webhook/salvar-frame-poster"
          />
          <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: '0.25rem 0 0' }}>
            Chamado uma vez por frame. Payload: <code>frame_number</code>, <code>total_frames</code>, <code>frame_name</code>, <code>image_base64</code>, <code>listing_id</code>, <code>imobname</code>, <code>advertiserCode</code>, <code>fps</code>, <code>timestamp_ms</code>, <code>render_source</code>.
          </p>
        </div>
        <div className="form-group">
          <label><span className="config-field-name">[3 — Conclusão]</span> Webhook chamado quando todos os frames foram enviados</label>
          <input
            name="webhook_frames_done"
            type="url"
            value={data.webhook_frames_done ?? ''}
            onChange={(e) => update('webhook_frames_done', null, e.target.value)}
            placeholder="https://n8n.../webhook/frames-done"
          />
          <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: '0.25rem 0 0' }}>
            Opcional. POST com <code>listing_id</code>, <code>imobname</code>, <code>advertiserCode</code>, <code>frames_sent</code>, <code>total_frames</code>, <code>fps</code>, <code>duration_ms</code>, <code>render_source</code>, <code>status: "done"</code>.
          </p>
        </div>
        <div className="form-group">
          <label><span className="config-field-name">[4 — Montar MP4]</span> Webhook para solicitar a montagem dos frames em vídeo</label>
          <input
            name="webhook_montar_mp4"
            type="url"
            value={data.webhook_montar_mp4 ?? ''}
            onChange={(e) => update('webhook_montar_mp4', null, e.target.value)}
            placeholder="https://n8n.../webhook/montar-video-poster"
          />
          <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: '0.25rem 0 0' }}>
            Opcional. Mesmo payload de [Conclusão] acrescido de <code>action: "montar_mp4"</code>. Acionar o ffmpeg-api para juntar os frames em MP4.
          </p>
        </div>
      </section>

      {/* 3. Captação, produção e materiais */}
      <section className="card config-section">
        <h2 className="config-section-title">3. Captação, produção e materiais</h2>
        <p className="config-section-desc">
          Webhooks dos demais fluxos automáticos da plataforma.
        </p>
        <div className="form-group">
          <label><span className="config-field-name">[Captação]</span> Importar anúncio por link</label>
          <input
            name="webhook_captacao"
            type="url"
            value={data.webhook_captacao ?? ''}
            onChange={(e) => update('webhook_captacao', null, e.target.value)}
            placeholder="https://n8n.../webhook/..."
          />
          <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: '0.25rem 0 0' }}>
            Chamado em <strong>Adicionar imóvel → Importar por link</strong>. Recebe o link do anúncio e <code>client_id</code>; deve responder com os dados do imóvel para cadastro automático.
          </p>
        </div>
        <div className="form-group">
          <label><span className="config-field-name">[Produção]</span> FireMode Now</label>
          <input
            name="webhook_producao"
            type="url"
            value={data.webhook_producao ?? ''}
            onChange={(e) => update('webhook_producao', null, e.target.value)}
            placeholder="https://seu-n8n.com/webhook/..."
          />
          <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: '0.25rem 0 0' }}>
            Chamado pelo botão FireMode Now. Inicia o fluxo de produção completo do imóvel.
          </p>
        </div>
        <div className="form-group">
          <label><span className="config-field-name">[Materiais]</span> Listar arquivos gerados do imóvel</label>
          <input
            name="webhook_materiais"
            type="url"
            value={data.webhook_materiais ?? ''}
            onChange={(e) => update('webhook_materiais', null, e.target.value)}
            placeholder="https://n8n.../webhook/listagem-materiais"
          />
          <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: '0.25rem 0 0' }}>
            Ao abrir a página <strong>Materiais</strong>, envia <code>imobname</code> e <code>advertiserCode</code>. Deve responder com array de arquivos no formato S3 (<code>Key</code>, <code>LastModified</code>, <code>Size</code>, <code>url</code>).
          </p>
        </div>
        <div className="form-group">
          <label><span className="config-field-name">[Logo]</span> Enviar logo do cliente para o storage</label>
          <input
            name="webhook_logo"
            type="url"
            value={data.webhook_logo ?? ''}
            onChange={(e) => update('webhook_logo', null, e.target.value)}
            placeholder="https://n8n.../webhook/logo"
          />
          <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: '0.25rem 0 0' }}>
            Chamado em <strong>Área do cliente → Enviar logo</strong>. Envia <code>client_id</code>, <code>client_name</code>, <code>logo_url</code>.
          </p>
        </div>
      </section>

      {/* 4. Planos e links de pagamento */}
      <section className="card config-section">
        <h2 className="config-section-title">4. Planos e links de pagamento</h2>
        <p className="config-section-desc">
          Cada plano aparece no cadastro do cliente e controla a quantidade de créditos disponíveis.
          O <strong>Link de pagamento</strong> exibe um botão no dashboard para gerar cobrança.
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
                      name={`plan_${index}_id`}
                      value={p.id || ''}
                      onChange={(e) => updatePlan(index, 'id', e.target.value)}
                      placeholder="497"
                      className="config-input-inline"
                    />
                  </td>
                  <td>
                    <input
                      name={`plan_${index}_label`}
                      value={p.label || ''}
                      onChange={(e) => updatePlan(index, 'label', e.target.value)}
                      placeholder="R$ 497"
                      className="config-input-inline"
                    />
                  </td>
                  <td>
                    <input
                      name={`plan_${index}_price`}
                      type="number"
                      value={p.price ?? ''}
                      onChange={(e) => updatePlan(index, 'price', Number(e.target.value) || 0)}
                      placeholder="497"
                      className="config-input-inline"
                    />
                  </td>
                  <td>
                    <input
                      name={`plan_${index}_credit_label`}
                      value={p.credit_label || ''}
                      onChange={(e) => updatePlan(index, 'credit_label', e.target.value)}
                      placeholder="Vídeos simples"
                      className="config-input-inline"
                    />
                  </td>
                  <td>
                    <input
                      name={`plan_${index}_credit_count`}
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
                      name={`plan_${index}_payment_url`}
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
