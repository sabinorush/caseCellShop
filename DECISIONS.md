# Decisões Técnicas

Este documento registra as decisões técnicas não óbvias do projeto — o "porque X e não Y" — e os
trade-offs aceitos conscientemente. Decisões impostas diretamente pelo [PRD.md](./PRD.md) (NestJS,
Zod, CSS Modules, monorepo pnpm, ausência de auth/pagamento/DB persistente/Docker/deploy) não são
repetidas aqui por não serem escolha livre.

O histórico completo de prompts e a evolução de cada decisão (incluindo perguntas que a IA fez e as
respostas dadas) está preservado em [`ai/`](./ai/), uma sessão por arquivo:

- `2026-09-16-073628-conversa-inicial.txt` — setup do monorepo e implementação inicial do fluxo de compra.
- `2026-09-16-083409-tratativa-insponibilidade-api.txt` — validação de ambiente na API e tratamento de indisponibilidade (502/503/504) no front.
- `2026-09-16-092008-validacoes-adicionais-idempotencia.txt` — idempotência do checkout e health check.

Este arquivo é o resumo curado dessas sessões; consulte-as quando precisar do raciocínio completo ou
do prompt exato que originou uma mudança.

---

## 1. Idempotência via header `Idempotency-Key` + store em memória (não Redis)

**Problema:** a única proteção contra compra duplicada era o `isSubmitting` do `BuyForm` — estado de
UI, não do servidor. Isso não cobre o caso mais provável de duplicação: um retry após timeout ou erro
de rede. O `client.ts` aborta requisições em 8s e a própria UI incentiva o retry (mensagens de erro
"tente novamente" + botão de retry); se a API já tinha processado a compra e só a resposta se perdeu,
repetir a requisição debitava o estoque duas vezes.

**Decisão:** o front gera um `Idempotency-Key` (UUID) por tentativa de compra e envia no header. O
back (`IdempotencyStore` em `apps/api/src/common/idempotency-store.ts`) guarda `key → fingerprint +
resultado`: repetir a mesma chave com o mesmo pedido (`productId:quantity`) devolve o resultado já
processado sem tocar no estoque de novo.

**Por que não Redis:** o PRD exclui banco persistente e o projeto roda como instância única — Redis
resolveria um problema (idempotência sobreviver a restart/múltiplas instâncias) que este projeto não
tem. Um `Map` em memória no mesmo processo, no mesmo espírito do catálogo de produtos, é suficiente.

**Trade-off aceito:** a store não sobrevive a um restart da API (verificado manualmente: reiniciar e
repetir a mesma chave gera uma compra nova). TTL de 10 min e teto de 1000 entradas evitam vazamento de
memória, com limpeza preguiçosa (sem `setInterval`, para não segurar o event loop nem vazar timers
entre testes).

## 2. Checagem + decremento de estoque em bloco síncrono (sem lock explícito)

**Decisão:** `ProductsService.decreaseStock()` verifica `quantity > stock` e decrementa no mesmo bloco
síncrono, sem `await` no meio. Como o Node processa cada requisição cooperativamente e não há ponto de
suspensão nessa função, duas chamadas concorrentes nunca intercalam entre a checagem e a escrita — a
operação é efetivamente atômica sem precisar de mutex/lock.

**Por que não um lock explícito:** seria complexidade desnecessária para o que o event loop do Node já
garante de graça, dado que a operação inteira é síncrona.

**Verificação:** testado com 10 requisições simultâneas contra estoque de 5 — exatamente 5 sucessos
(201) e 5 falhas (409), estoque final em 0, nunca negativo.

**Trade-off aceito:** essa garantia depende da operação inteira ser síncrona. Se o checkout ganhar um
`await` no meio (ex.: chamada a um gateway de pagamento real), a atomicidade se perde e passaria a
precisar de um lock de verdade. `CheckoutService.purchase()` já isola essa checagem de idempotência
antes da chamada síncrona a `execute()` justamente pensando nesse cenário futuro.

## 3. Falha de negócio libera a chave de idempotência (não fica "queimada")

**Decisão:** se `execute()` lança (ex.: `InsufficientStockError`), `CheckoutService.purchase()` chama
`idempotency.release(key)` antes de repropagar o erro, em vez de guardar o erro como resultado.

**Por que:** guardar o erro prenderia o cliente a um 409 que pode não ser mais verdade (ex.: o cliente
corrige a quantidade e tenta de novo com a mesma chave — situação comum, já que o front só troca de
chave quando o *fingerprint* muda). Liberar a chave permite que a mesma tentativa seja reprocessada do
zero.

**Efeito colateral aceito:** o estado `in-flight` do store hoje nunca é observável de fato, porque
`purchase()` é 100% síncrono (begin/complete acontecem no mesmo tick — a mesma propriedade da decisão
#2). O caminho foi mantido porque passa a ser relevante no dia em que o checkout virar assíncrono, a um
custo de poucas linhas hoje.

## 4. `422` para chave reciclada, `409` para estoque insuficiente

**Decisão:** reusar um `Idempotency-Key` já usado, mas com um pedido diferente (`productId`/`quantity`
diferentes), retorna `422 Unprocessable Entity` — distinto do `409 Conflict` usado para estoque
insuficiente e para uma chave ainda em processamento.

**Por que não os dois em 409:** são erros de natureza diferente — 409 é conflito de estado do
domínio (o servidor "não pode" naquele momento); reciclar uma chave para outro pedido é erro de uso do
cliente (a chave, por contrato, identifica *uma* tentativa de *um* pedido). Separar os status ajuda um
consumidor da API a distinguir "tente de novo mais tarde" de "seu client está com bug". No front os
dois caem no mesmo tratamento genérico de 4xx (`retryable: false`), então a separação não pesa na UI.

## 5. Taxonomia de erro no client web (`kind` + `retryable`)

**Problema:** falha de rede (`fetch` rejeita) e payload fora do schema (Zod) vazavam como
`TypeError`/`ZodError` crus até a UI, caindo num fallback genérico. Um 502 do proxy (corpo vazio,
`text/plain`) virava a mensagem "Erro inesperado (HTTP 502)" — sem explicação e sem saída.

**Decisão:** `ApiError` ganhou `kind` (`network` | `timeout` | `unavailable` | `http` |
`invalid-response`) e `retryable`. 502/503/504 nunca tentam ler o corpo da resposta (é tipicamente
HTML/vazio de um proxy/gateway, não JSON da API) e viram direto a mensagem de instabilidade; timeout de
cliente (`AbortSignal.timeout`) e falha de `fetch` são tratados explicitamente em vez de vazar como
exceções nativas.

**Por que expor `retryable` em vez de decidir no componente:** centraliza a regra "esse tipo de erro
vale a pena tentar de novo" num único lugar (o client), em vez de cada chamador (`App.tsx`,
`BuyForm.tsx`) reimplementar a mesma checagem de status/kind. É também o sinal que decide se o
`Idempotency-Key` da tentativa é reaproveitado (decisão #1) ou descartado.

## 6. Proxy do Vite sintetiza 502/504 com corpo JSON em desenvolvimento

**Problema:** para testar as mensagens de indisponibilidade (decisão #5) sem simular, seria preciso
derrubar a API de verdade a cada teste manual — e mesmo assim o proxy padrão do Vite devolve um 502
`text/plain` vazio, diferente do que um reverse proxy real devolveria em produção.

**Decisão:** um handler de erro no proxy (`apps/web/vite.config.ts`) classifica o código de erro do
socket — `ECONNREFUSED`/`ENOTFOUND`/etc. → 502 (API fora do ar), `ETIMEDOUT`/`ECONNRESET`/etc. → 504
(não respondeu a tempo) — e responde com um corpo JSON (`{ statusCode, message }`), só em dev.

**Por que isso é seguro:** só existe dentro de `server.proxy`, que não roda em build de produção; é
puramente uma ferramenta de desenvolvimento/teste, não um comportamento de runtime da aplicação.

## 7. Validação de ambiente com early return (não deixar o processo estourar)

**Problema:** `main.ts` chamava `loadEnvFile('.env')` no topo do módulo sem tratamento. Como só
`.env.example` é versionado, clonar o repo e rodar `pnpm dev:api` sem copiar o `.env` gerava um erro
`ENOENT` com stack trace do Node, sem nenhuma pista do que fazer. Um `PORT` inválido só quebraria mais
adiante, com erro obscuro do `listen()`.

**Decisão:** `loadEnv()`/`parseEnv()` (`apps/api/src/config/env.ts`) validam com Zod antes de criar a
aplicação Nest; `bootstrap()` faz early return com `process.exitCode = 1` e uma mensagem em pt-BR
citando o caminho absoluto do arquivo esperado e sugerindo `cp .env.example .env`.

**Por que "falhar sempre" em vez de usar um `PORT` default:** decisão explícita — preferir uma falha
imediata e legível a um comportamento "mágico" (porta default silenciosa) que mascara configuração
ausente.

## 8. Preço em centavos (inteiro), não ponto flutuante

**Decisão:** `Product.priceCents` e todo o cálculo de total (`unitPriceCents * quantity`) usam inteiros
representando centavos, nunca `number` fracionário representando reais.

**Por que:** operações com float em valores monetários acumulam erro de arredondamento (`0.1 + 0.2 !==
0.3`); trabalhar em centavos inteiros elimina a classe de bug inteira sem precisar de uma lib de
precisão decimal, adequado ao escopo do projeto.

## 9. Sem teste de componente React — lógica extraída para funções puras testáveis

**Decisão:** não há `jsdom`/Testing Library no projeto. A regra de negócio mais sensível do front — qual
`Idempotency-Key` usar numa tentativa (`resolveAttempt`) — foi extraída para `apps/web/src/api/
idempotency.ts`, uma função pura sem dependência de React, testada diretamente com Vitest em ambiente
`node`. `BuyForm.tsx`/`App.tsx` foram verificados manualmente no navegador (fluxo de compra, duplo
clique, estoque esgotado, indisponibilidade, retry) durante cada sessão de desenvolvimento.

**Trade-off aceito:** não há regressão automática de UI — uma mudança futura em `BuyForm.tsx` pode
quebrar o comportamento visual/de interação sem que a suíte de testes acuse. Mitigado parcialmente por
manter a lógica não trivial fora do componente.

## 10. Vitest em vez de Jest — não foi decisão, foi descoberta de scaffold

Registrado para não parecer uma escolha deliberada: o plano inicial previa Jest (padrão histórico do
Nest CLI). Ao rodar `nest new`, a versão instalada do `@nestjs/cli` já gerava o projeto com Vitest por
padrão. Manteve-se Vitest — mesma cobertura de testes planejada, só o runner mudou — em vez de forçar
Jest contra o scaffold atual.

---

## Fora de escopo — decisão consciente, não esquecimento

Identificados durante o planejamento e deliberadamente não implementados, por não serem pedidos pelo
PRD nem necessários no tamanho atual do projeto:

- **Rate limiting** (`@nestjs/throttler`) no endpoint de checkout.
- **Filtro de exceção global** do Nest (hoje cada serviço lança a exceção HTTP específica direto).
- **Persistência de pedidos** — `CheckoutResult` é devolvido e esquecido; não há histórico de compras.
- **Header de resposta `Idempotency-Replayed`** — se uma resposta veio de replay já é observável pelo
  `orderId`/`remainingStock` repetidos, sem precisar de um header dedicado.
- **Pacote compartilhado de schemas** entre `apps/api` e `apps/web` — os schemas Zod de produto/checkout
  hoje são duplicados (um em cada app) porque nunca divergiram o suficiente para justificar extrair um
  pacote `packages/shared` só para isso.
