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

## Deploy da API no Railway

1. Acesse [railway.com/new](https://railway.com/new) e faça login (GitHub é o mais simples).

2. **Create new project** → **Deploy from GitHub repo** → escolha o repositório do projeto (ex.: `ComercialTurbinado/admimob`). Se não aparecer, autorize o Railway no GitHub em **Configure GitHub App**.

3. Depois que o projeto for criado, clique no **service** (o retângulo do deploy). Em **Settings**:
   - **Build Command:** use `npm run build:api` (evita build do frontend; só a API sobe aqui).
   - **Start Command:** já usa `npm start` por padrão (ou `node server/index.js`).
   - **Root Directory:** deixe em branco (raiz do repo).

4. **Variables:** clique em **Variables** (ou **Variables** na aba do service) e adicione:
   - `TURSO_DATABASE_URL` = `libsql://firemode-imob-comercialturbinado.aws-us-east-1.turso.io` (ou a URL do seu banco Turso).
   - `TURSO_AUTH_TOKEN` = (o token JWT do Turso).

5. **Domínio público:** em **Settings** do service, em **Networking** → **Generate Domain**. O Railway vai gerar uma URL tipo `https://seu-projeto.up.railway.app`. Anote essa URL.

6. No **Amplify**, nas variáveis de ambiente do **build** do frontend, adicione:
   - `VITE_API_URL` = URL do Railway **sem** `/api` no final (ex.: `https://admimob-production.up.railway.app`). O app acrescenta `/api` às requisições.

7. Dê um **novo build** no Amplify. O painel passará a usar a API no Railway.

O servidor já usa `process.env.PORT`; o Railway injeta a porta automaticamente.

## Deploy no Amplify (frontend) + API em outro serviço

O **Amplify** só publica o frontend (build estático). A **API Node/Express não roda no Amplify**. Para o painel funcionar em produção:

1. **Hospedar a API** em um serviço que rode Node.js — ver acima **Deploy da API no Railway**, ou:
   - **Render** (render.com) — Web Service, build `npm install`, start `node server/index.js`, e as mesmas env do Turso.

2. **No Amplify**, nas variáveis de ambiente do **build** do frontend, adicione:
   - `VITE_API_URL` = URL base da sua API (ex.: `https://seu-app.railway.app`), **sem** barra no final.

3. Faça um **novo build** no Amplify. O frontend passará a chamar essa URL em todas as requisições `/api/*`.

O banco já é o **Turso** (configurado no servidor da API via `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN`). Não é preciso configurar banco no Amplify.

## Dados

- **clients:** nome, logo_url, status (lead | active | negotiation)
- **listings:** client_id, source_url, raw_data (JSON do anúncio), selected_images, webhook_payload
- **settings:** kpis, payment_links (plan_65, plan_297, plan_497), webhook_captacao, webhook_producao
