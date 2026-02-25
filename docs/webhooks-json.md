# Estrutura JSON dos webhooks

## 1. Webhook de captação (importar imóvel por link)

**URL configurada em:** Configurações → URL do webhook de captação  
**Quando é chamado:** Ao clicar em "Importar por link" na área do cliente (Adicionar imóvel).

### Importante: usar "Respond to Webhook" no n8n

Para o sistema **receber a resposta** e cadastrar o imóvel automaticamente:

1. No n8n, use o trigger **"Webhook"** com a opção **"Respond to Webhook"** ativada (ou o nó **"Respond to Webhook"**).
2. O fluxo deve **esperar o processamento terminar** e só então enviar a resposta. Se usar só "Webhook" (sem Respond), o n8n devolve na hora algo como `{"message":"Workflow was started"}` e o resto do fluxo roda em segundo plano — aí o sistema não recebe os dados do imóvel.
3. No **final do fluxo**, o nó que responde deve devolver o **corpo em JSON** com o objeto do imóvel (com pelo menos `title` ou `carousel_images`). Esse mesmo JSON é o que o sistema usa para cadastrar o listing.
4. O sistema espera até **2 minutos** pela resposta. Se o fluxo demorar mais, aumente o tempo de timeout no servidor ou otimize o fluxo no n8n.

Resumo: **Respond to Webhook** = n8n só responde quando o fluxo chega ao fim e envia o JSON do imóvel; assim o sistema recebe a resposta e cadastra o imóvel.

### O que o sistema ENVIA para o n8n (POST, JSON)

```json
{
  "url": "https://www.vivareal.com.br/imovel/...",
  "client_id": 1
}
```

| Campo      | Tipo    | Obrigatório | Descrição |
|-----------|---------|-------------|-----------|
| `url`     | string  | Sim         | Link do anúncio (Viva Real, ZAP, etc.) |
| `client_id` | number \| null | Sim    | ID do cliente no sistema (ou `null`) |

---

### O que o n8n pode DEVOLVER para o sistema cadastrar o imóvel

Se a resposta for um **JSON** com pelo menos **`title`** ou **`carousel_images`**, o sistema cadastra o imóvel para o cliente e retorna `201` com o id.

**Opção A – um único imóvel (objeto):**

```json
{
  "title": "Casa com 2 Quartos e 2 banheiros à Venda, 82 m² por R$ 455.000",
  "description": "Casa nova com piscina a venda em Peruíbe...",
  "carousel_images": [
    "https://exemplo.com/foto1.jpg",
    "https://exemplo.com/foto2.jpg"
  ],
  "salePrice": "R$ 455.000",
  "prices": {
    "Venda": "R$ 455.000",
    "Condomínio": "Isento",
    "IPTU": "R$ 160"
  },
  "imobname": "Nome da Imobiliária",
  "logoimob": "https://exemplo.com/logo.png",
  "advertiserCode": "CA2598",
  "vivaRealCode": "2815108622",
  "propertyCodes": "(Código do anunciante: CA2598 | ...)",
  "amenities-list": [
    { "name": "floorSize", "value": "82 m²" },
    { "name": "numberOfRooms", "value": "2 quartos" }
  ]
}
```

**Opção B – array (o sistema usa o primeiro item):**

```json
[
  {
    "title": "Casa com 2 Quartos...",
    "carousel_images": ["https://..."],
    "description": "...",
    "salePrice": "R$ 455.000"
  }
]
```

**Campos usados pelo sistema (mínimo para cadastrar):**

| Campo              | Tipo     | Obrigatório para cadastrar | Descrição |
|--------------------|----------|----------------------------|-----------|
| `title`            | string   | Um de title ou carousel_images | Título do anúncio |
| `carousel_images`  | string[] | Um de title ou carousel_images | URLs das fotos |
| `description`      | string   | Não                        | Descrição |
| `salePrice`        | string   | Não                        | Ex.: "R$ 455.000" |
| `prices`           | object   | Não                        | Venda, Condomínio, IPTU, etc. |
| `imobname`         | string   | Não                        | Nome da imobiliária |
| `logoimob`         | string   | Não                        | URL do logo |
| `advertiserCode`   | string   | Não                        | Código do anunciante |
| `vivaRealCode`     | string   | Não                        | Código Viva Real |
| `propertyCodes`    | string   | Não                        | Texto dos códigos |
| `amenities-list`   | array    | Não                        | Lista de comodidades |

Se a resposta não for JSON ou não tiver `title` nem `carousel_images`, o sistema só considera que o webhook foi disparado e **não** cadastra imóvel.

---

## 2. Webhook de produção (FireMode Now)

**URL configurada em:** Configurações → URL do webhook de produção  
**Quando é chamado:** Ao clicar em "FireMode Now" na Central de Produção do imóvel.

### O que o sistema ENVIA para o n8n (POST, JSON)

O payload é o que foi editado na Central de Produção (ou o padrão abaixo).

**Estrutura padrão (quando não há payload customizado):**

```json
{
  "title": "Casa com 2 Quartos e 2 banheiros à Venda, 82 m² por R$ 455.000",
  "description": "Casa nova com piscina a venda em Peruíbe...",
  "salePrice": "R$ 455.000",
  "prices": {
    "Venda": "R$ 455.000",
    "Condomínio": "Isento",
    "IPTU": "R$ 160"
  },
  "imobname": "Nome da Imobiliária",
  "logoimob": "https://exemplo.com/logo.png",
  "advertiserCode": "CA2598",
  "vivaRealCode": "2815108622",
  "propertyCodes": "(Código do anunciante: CA2598 | ...)",
  "amenities": [
    { "name": "floorSize", "value": "82 m²" },
    { "name": "numberOfRooms", "value": "2 quartos" }
  ],
  "images": [
    "https://exemplo.com/foto1.jpg",
    "https://exemplo.com/foto2.jpg"
  ]
}
```

| Campo             | Tipo    | Descrição |
|-------------------|---------|-----------|
| `title`           | string  | Título do anúncio |
| `description`     | string  | Descrição |
| `salePrice`       | string  | Preço de venda |
| `prices`          | object  | Venda, Condomínio, IPTU |
| `imobname`        | string  | Nome da imobiliária |
| `logoimob`        | string  | URL do logo |
| `advertiserCode`   | string  | Código do anunciante |
| `vivaRealCode`    | string  | Código Viva Real |
| `propertyCodes`   | string  | Texto dos códigos |
| `amenities`       | array   | Comodidades (nome/value) |
| `images`          | string[]| URLs das fotos selecionadas na curadoria |

Se na Central de Produção existir **Payload customizado** (webhook_payload), esse objeto é enviado no lugar do padrão.

**Resposta do n8n:** o sistema não exige formato específico; repassa o corpo da resposta (texto) para o frontend.
