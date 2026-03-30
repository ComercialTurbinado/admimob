import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { API, parseJsonResponse, apiFriendlyMessage } from '../api';
import PageHeader from '../components/PageHeader';

const FIELDS = [
  { key: 'name',            label: 'Nome (imobiliária ou corretor)', required: true },
  { key: 'logo_url',        label: 'URL do logo', type: 'url' },
  { key: 'status',          label: 'Status', type: 'select', options: [
    { value: 'lead',        label: 'Lead' },
    { value: 'active',      label: 'Cliente ativo' },
    { value: 'negotiation', label: 'Negociação' },
  ]},
  { key: 'plan',            label: 'Plano', type: 'plan_select' },
  { key: 'credits_remaining', label: 'Créditos restantes', type: 'number' },
  { key: 'contact_name',   label: 'Nome do contato / responsável' },
  { key: 'email',          label: 'E-mail', type: 'email' },
  { key: 'phone',          label: 'Telefone principal' },
  { key: 'whatsapp',       label: 'WhatsApp (com DDD, só números)', placeholder: '13999991234' },
  { key: 'phone_secondary',label: 'Telefone secundário' },
  { key: 'document',       label: 'CPF ou CNPJ' },
  { key: 'creci',          label: 'CRECI' },
  { key: 'address',        label: 'Endereço' },
  { key: 'city',           label: 'Cidade' },
  { key: 'state',          label: 'Estado (UF)' },
  { key: 'zip',            label: 'CEP' },
  { key: 'website',        label: 'Site', type: 'url' },
  { key: 'instagram',      label: 'Instagram (ex: @handle)' },
  { key: 'facebook',       label: 'Facebook' },
  { key: 'slug',           label: 'Slug do catálogo', hint: 'Identificador único na URL. Ex: "regina-guerreiro" → /catalogo/regina-guerreiro', type: 'slug' },
  { key: 'custom_domain',  label: 'Domínio próprio (opcional)', hint: 'Ex: imoveis.minhaempresa.com.br — aponte um CNAME para o servidor e preencha aqui.' },
  { key: 'notes',          label: 'Observações', type: 'textarea' },
];

const SECTIONS = [
  { title: 'Dados básicos',    keys: ['name', 'logo_url', 'status', 'plan', 'credits_remaining', 'contact_name'] },
  { title: 'Contato',          keys: ['email', 'phone', 'whatsapp', 'phone_secondary'] },
  { title: 'Documentação',     keys: ['document', 'creci'] },
  { title: 'Endereço',         keys: ['address', 'city', 'state', 'zip'] },
  { title: 'Redes e site',     keys: ['website', 'instagram', 'facebook'] },
  { title: '🌐 Catálogo público', keys: ['slug', 'custom_domain'] },
  { title: 'Observações',      keys: ['notes'] },
];

const initial = () => FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: f.type === 'number' ? '' : '' }), {});

export default function ClienteForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const [form, setForm] = useState(initial);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(API + '/dashboard')
      .then(parseJsonResponse)
      .then((d) => setPlans(Array.isArray(d.plans) ? d.plans : []))
      .catch(() => setPlans([]));
  }, []);

  useEffect(() => {
    if (isEdit && id) {
      fetch(API + '/clients/' + id)
        .then(parseJsonResponse)
        .then((c) => {
          const next = initial();
          FIELDS.forEach((f) => {
            const v = c[f.key];
            next[f.key] = v === null || v === undefined ? '' : v;
          });
          setForm(next);
        })
        .catch((e) => setError(e.message));
    }
  }, [id, isEdit]);

  function update(key, value) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'plan' && (plans || []).length) {
        const p = plans.find((x) => String(x.id) === String(value));
        if (p && (prev.credits_remaining === '' || prev.credits_remaining === undefined)) next.credits_remaining = p.credit_count ?? '';
      }
      return next;
    });
  }

  function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const url = isEdit ? API + '/clients/' + id : API + '/clients';
    const method = isEdit ? 'PUT' : 'POST';
    const body = { ...form };
    if (body.credits_remaining === '' || body.credits_remaining === undefined) body.credits_remaining = null;
    else body.credits_remaining = Number(body.credits_remaining) || 0;
    fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(parseJsonResponse)
      .then(() => navigate('/'))
      .catch((e) => setError(apiFriendlyMessage(e)))
      .finally(() => setLoading(false));
  }

  function renderField(field) {
    const { key, label, type, options, required, placeholder, hint } = field;
    const value = form[key] ?? '';
    const common = {
      value,
      onChange: (e) => update(key, e.target.value),
      id: key,
    };
    if (type === 'plan_select') {
      const planValue = value === null || value === undefined ? '' : String(value);
      return (
        <select {...common} value={planValue}>
          <option value="">Selecione o plano</option>
          {(plans || []).map((p) => (
            <option key={String(p.id)} value={String(p.id)}>
              {p.label || p.id} — {p.credit_label || ''} ({p.credit_count ?? 0} créditos)
            </option>
          ))}
        </select>
      );
    }
    if (type === 'select') {
      return (
        <select {...common}>
          <option value="">Selecione</option>
          {(options || []).map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      );
    }
    if (type === 'textarea') {
      return <textarea {...common} rows={4} placeholder={placeholder || label} />;
    }
    if (type === 'number') {
      return <input type="number" min={0} {...common} id={key} placeholder={placeholder || label} />;
    }
    if (type === 'slug') {
      // Normaliza slug em tempo real
      const handleSlug = (e) => {
        const raw = e.target.value
          .toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9-]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-/, '');
        update(key, raw);
      };
      const catalogBase = (import.meta.env.VITE_CATALOG_URL || import.meta.env.VITE_API_URL || 'http://localhost:3333').replace(/\/api$/, '').replace(/\/$/, '');
      return (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', background: 'var(--surface)' }}>
            <span style={{ padding: '0 0.6rem', color: 'var(--muted)', fontSize: '0.82rem', whiteSpace: 'nowrap', borderRight: '1px solid var(--border)', userSelect: 'none' }}>
              /catalogo/
            </span>
            <input
              type="text"
              value={value}
              onChange={handleSlug}
              id={key}
              placeholder="slug-do-cliente"
              style={{ border: 'none', background: 'transparent', color: 'var(--text)', padding: '0.5rem 0.6rem', flex: 1, font: 'inherit', fontSize: '0.9rem', outline: 'none' }}
            />
          </div>
          {value && (
            <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.35rem' }}>
              URL: <code style={{ fontSize: '0.78rem' }}>{catalogBase}/catalogo/{value}</code>
            </p>
          )}
        </div>
      );
    }
    const inputType = type === 'url' ? 'url' : type === 'email' ? 'email' : 'text';
    return (
      <div>
        <input type={inputType} {...common} required={required} placeholder={placeholder || label} />
        {hint && <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.3rem' }}>{hint}</p>}
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={isEdit ? 'Editar cliente' : 'Novo cliente'}
        subtitle={isEdit ? 'Atualize os dados cadastrais' : 'Preencha os dados para criar o perfil público'}
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Clientes', to: '/clientes' },
          { label: isEdit ? 'Editar' : 'Novo cliente' },
        ]}
      />

      <form onSubmit={submit}>
        {SECTIONS.map((sec) => (
          <div key={sec.title} className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1rem', color: 'var(--muted)' }}>
              {sec.title}
            </h3>
            <div style={{ display: 'grid', gap: '1rem' }}>
              {sec.keys.map((key) => {
                const field = FIELDS.find((f) => f.key === key);
                if (!field) return null;
                return (
                  <div key={key} className="form-group">
                    <label htmlFor={key}>{field.label}{field.required ? ' *' : ''}</label>
                    {renderField(field)}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {error && <p style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</p>}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
          <button type="button" className="btn" onClick={() => navigate('/')}>
            Cancelar
          </button>
        </div>
      </form>
    </>
  );
}
