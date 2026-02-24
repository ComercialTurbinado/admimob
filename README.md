# admimob (Divulga Imob)

Sistema de gestão para imobiliárias: dashboard executivo, portfólio de clientes, captação de anúncios por link (webhook n8n) e central de produção com envio FireMode para vídeos.

## Requisitos

- Node.js 18+

## Instalação

```bash
npm install
cd client && npm install && cd ..
```

## Uso

1. **Subir API e frontend:**

   ```bash
   npm run dev
   ```

   - API: http://localhost:3333  
   - Painel: http://localhost:5173  

2. **Popular o banco (1 cliente + 1 imóvel de exemplo):**

   ```bash
   npm run seed
   ```

3. **Fluxo no painel**

   - **Dashboard:** KPIs (Leads, Clientes Ativos, Negociações, Vendas Mês), links de pagamento (R$ 65, R$ 297, R$ 497) e grade de **cards de clientes** (logo + nome).
   - **Clique em um cliente:** abre o **Módulo de Captação** (modal). Cole o link do anúncio (ZAP, Viva Real, etc.) e clique em **Importar**. O webhook de captação (n8n) é disparado; se o n8n devolver dados do imóvel, ele é cadastrado no banco. Abaixo, lista de imóveis do cliente com link para **Central de Produção**.
   - **Central de Produção:** edite título, descrição e características (ex.: churrasqueira, ar-condicionado), faça a **curadoria visual** (checkboxes nas fotos para o vídeo de 30s) e **Salvar alterações**. Depois use **FireMode Now** para disparar o webhook de produção (n8n).
   - **Configurações:** altere KPIs, URLs dos links de pagamento e as duas URLs de webhook (captação e produção).
   - **Novo cliente:** cadastro de imobiliária/corretor (nome, logo, status).
   - **Novo anúncio (JSON):** importação em lote colando JSON (objeto ou array de anúncios).

## API (resumo)

- **Dashboard:** `GET /api/dashboard`, `PUT /api/dashboard` (kpis, payment_links, webhook_captacao, webhook_producao)
- **Clientes:** `GET/POST /api/clients`, `GET/PUT/DELETE /api/clients/:id`
- **Listings:** `GET /api/listings?client_id=` (opcional), `GET/POST/PUT/DELETE /api/listings/:id`
- **Captação:** `POST /api/listings/import-from-url` (body: `{ url, client_id }`) — chama webhook e, se a resposta trouxer dados do imóvel, cadastra.
- **Produção:** `POST /api/listings/:id/firemode` — envia o payload (dados + fotos selecionadas) para o webhook de produção.

## Dados

- **clients:** nome, logo_url, status (lead | active | negotiation)
- **listings:** client_id, source_url, raw_data (JSON do anúncio), selected_images, webhook_payload
- **settings:** kpis, payment_links (plan_65, plan_297, plan_497), webhook_captacao, webhook_producao
