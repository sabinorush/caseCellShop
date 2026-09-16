# CaseCellShop

Loja de capas para celular construída como estudo de caso de um fluxo de compra correto: sem
sobrevenda de estoque e sem compra duplicada por clique repetido. Não é uma loja completa —
autenticação, gateway de pagamento, banco de dados persistente, deploy e um layout elaborado estão
fora de escopo (ver [PRD.md](./PRD.md)). As decisões técnicas não óbvias e seus trade-offs estão
registradas em [DECISIONS.md](./DECISIONS.md).

## Regras de negócio

- A quantidade solicitada não pode ser maior que o estoque disponível.
- O estoque só é reduzido em uma compra bem-sucedida.
- O botão de comprar não permite envio duplicado enquanto a compra está em processamento.

## Stack

| Camada    | Tecnologias |
|-----------|-------------|
| Front-end | React 19 + TypeScript + Vite, CSS Modules, Zod |
| Back-end  | NestJS (Node.js, ESM), Zod, sem banco de dados (catálogo em memória) |
| Testes    | Vitest (unitário e e2e na API) |
| Monorepo  | PNPM workspaces |

## Estrutura

```
apps/
  api/   API REST (NestJS) — produtos, checkout e health check
  web/   SPA (React + Vite) que consome a API
```

## Pré-requisitos

- Node.js compatível com as devDependencies (`@types/node ^24`)
- [pnpm](https://pnpm.io/)

## Configuração

Cada app lê variáveis de ambiente validadas com Zod e recusa iniciar com uma mensagem de erro clara
se a configuração estiver ausente ou inválida. Copie os exemplos antes de rodar:

```bash
cp apps/api/.env.example apps/api/.env   # PORT=3000
cp apps/web/.env.example apps/web/.env   # API_URL=http://localhost:3000
```

`API_URL` é o destino do proxy `/api` do servidor de desenvolvimento do Vite (o front nunca chama a
API diretamente — todas as chamadas passam por `/api/*`, que é reescrito removendo o prefixo).

## Instalação

```bash
pnpm install
```

## Rodando em desenvolvimento

Na raiz do repositório (os scripts usam `--filter`, então não é preciso navegar entre pastas):

```bash
pnpm dev        # API + web em paralelo
pnpm dev:api    # apenas a API (nest start --watch)
pnpm dev:web    # apenas o front (vite)
```

Por padrão a API sobe em `http://localhost:3000` e o front em `http://localhost:5173` (proxying
`/api` para a API).

## Build

```bash
pnpm build        # ambos os apps
pnpm build:api
pnpm build:web
```

## Testes

```bash
pnpm test            # testes unitários dos dois apps
pnpm test:api        # unitários da API (vitest run)
pnpm test:api:e2e     # e2e da API (vitest run --config ./vitest.config.e2e.ts)
pnpm test:web        # unitários do front
```

Testes unitários da API usam o padrão `*.spec.ts`; os e2e usam `*.e2e-spec.ts` (em `apps/api/test/`)
e rodam com uma config separada do Vitest.

Para rodar um arquivo específico:

```bash
pnpm --filter @casecellshop/api exec vitest run src/checkout/checkout.service.spec.ts
pnpm --filter @casecellshop/web exec vitest run src/api/idempotency.test.ts
```

## Lint

```bash
pnpm lint   # oxlint nos dois apps
```

## API

Catálogo de produtos e estoque vivem em memória (`apps/api/src/products/products.data.ts`) — o
estado reseta a cada reinício da API.

### `GET /products`

Lista os produtos disponíveis.

### `POST /checkout`

Efetua uma compra. Corpo (`application/json`):

```json
{ "productId": "case-iphone-15-silicone", "quantity": 1 }
```

Requer o header `Idempotency-Key` com um UUID. O mesmo par chave + `productId:quantity` reenviado
devolve o resultado já processado em vez de comprar de novo; a mesma chave com um pedido diferente
retorna erro. Uma chave em processamento retorna `409 Conflict` se reenviada antes de terminar, e
`409 Conflict` também é retornado quando o estoque é insuficiente.

Resposta em caso de sucesso:

```json
{
  "orderId": "…",
  "productId": "case-iphone-15-silicone",
  "productName": "Capa de Silicone",
  "quantity": 1,
  "unitPriceCents": 4990,
  "totalCents": 4990,
  "remainingStock": 11
}
```

### `GET /health`

Health check simples (`status`, `uptime`, `timestamp`).

## Como a idempotência é garantida

- O front (`apps/web/src/api/idempotency.ts`) gera uma `Idempotency-Key` (UUID) por tentativa de
  compra. A mesma chave é reaproveitada em um retry apenas quando o pedido (`productId` +
  `quantity`) não mudou e o erro anterior foi de um tipo "recuperável" (rede, timeout, servidor
  indisponível, 5xx) — ver `apps/web/src/api/client.ts` (`ApiError.retryable`). Erros definitivos
  (ex.: validação, estoque insuficiente) geram uma chave nova na próxima tentativa.
- O botão de compra (`apps/web/src/components/BuyForm.tsx`) fica desabilitado enquanto a compra
  está em andamento, evitando duplo clique.
- Na API, `CheckoutService` (`apps/api/src/checkout/checkout.service.ts`) usa um
  `IdempotencyStore` em memória (`apps/api/src/common/idempotency-store.ts`) para: reprocessar uma
  chave nova, bloquear (`409`) uma chave já em voo, devolver o resultado já processado para uma
  chave concluída com o mesmo pedido, e rejeitar (`422`) uma chave reusada com um pedido diferente.
