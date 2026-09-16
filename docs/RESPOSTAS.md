# Parte 1.A

## Problema 1 - Leitura inicial dos problemas

**Causa provável:** a loja deve estar chamando o ERP toda vez que alguém abre a vitrine. Com muito mais gente acessando ao mesmo tempo, isso deve estar sobrecarregando o ERP e deixando a resposta lenta.
**Impacto:** o cliente demora pra ver os produtos e pode desistir antes mesmo de olhar o catálogo perde venda logo no início.
**Primeira hipótese:** eu mediria quanto tempo a chamada pro ERP está levando (com log simples ou alguma ferramenta de monitoramento) pra confirmar se o gargalo é mesmo esse. Se for, a primeira ideia seria guardar esses dados em cache por um tempinho, pra não precisar chamar o ERP toda hora que alguém acessa a página.

## Problema 2 - Inconsistência de estoque
  
**Causa provável:** acho que quando duas pessoas compram ao mesmo tempo, o sistema primeiro checa se tem estoque e só depois desconta. Como são dois passos separados, pode acontecer de as duas compras passarem pela checagem antes de qualquer uma descontar.
**Impacto:** a loja vende produto que não tem, precisa cancelar pedido ou atrasar entrega, e o cliente fica chateado.
**Primeira hipótese:** eu tentaria reproduzir isso na prática (duas compras ao mesmo tempo pro mesmo produto com só 1 em estoque) pra confirmar o problema. Depois veria se dá pra fazer a checagem e o desconto do estoque numa única operação, sem separar em duas etapas.

## Problema 3 - Resiliência do checkout

**Causa provável:** o checkout deve estar esperando o ERP terminar todo o processamento (inclusive faturamento) antes de responder pro cliente. Se isso demora demais, a requisição estoura o tempo limite.
**Impacto:** o cliente não sabe se a compra foi concluída, pode tentar de novo e acabar comprando duas vezes, ou simplesmente desiste.
**Primeira hipótese:** eu olharia os logs pra ver se o pedido chegou a ser criado no ERP mesmo com o timeout (às vezes deu timeout na resposta, mas o processamento continuou do outro lado). Uma ideia seria responder pro cliente mais rápido, dizendo "recebemos seu pedido", e processar o resto depois.

## 1. Infraestrutura e serviços de apoio

Pra não depender do ERP em toda requisição, eu usaria:

**Cache:** guardar os dados de produto/preço/estoque por um tempo curto, pra vitrine não precisar chamar o ERP toda vez que alguém acessa.
**Fila (mensageria):** em vez do checkout esperar o ERP responder na hora, colocar o pedido numa fila e processar em segundo plano. O cliente recebe uma confirmação de que o pedido foi recebido, sem precisar esperar tudo terminar.
Balanceador de carga: com mais acesso, teria mais de uma instância da API da loja rodando, e um balanceador distribuindo as requisições entre elas.

O principal cuidado com essa ideia é que os dados em cache podem ficar um pouco desatualizados então eu não confiaria só no cache pra aprovar uma compra, só pra mostrar a vitrine mais rápido.

## 3. SDD - Contrato do POST /checkout

Recebe:
```json
{ "productId": "capa-001", "quantity": 2 }
```
productId: obrigatório, tem que existir.
quantity: número inteiro, maior que zero, e não pode passar do estoque disponível.

Sucesso → 201 Created, com os dados da compra:
```json
{
  "orderId": "...",
  "productId": "capa-001",
  "quantity": 2,
  "unitPriceCents": 3990,
  "totalCents": 7980,
  "remainingStock": 8
}
```
Uso centavos em vez de valor decimal pra evitar problema de arredondamento.

Erro:

400: dados inválidos (quantidade zero/negativa, campo faltando).
404: produto não existe.
409: não tem estoque suficiente.

Por que definir isso antes de programar: assim front e back combinam antes o formato de request/resposta, cada um pode trabalhar na sua parte sem esperar o outro terminar, e dá pra pensar nos casos de erro com calma em vez de descobrir "ah, esqueci desse caso" no meio do código.

## 4. TDD: Testes do POST /checkout

Cenários que eu escreveria:

Compra válida com estoque suficiente → sucesso, estoque desconta certinho.
Quantidade inválida (zero, negativa, texto no lugar de número) → 400, estoque não muda.
Produto que não existe → 404.
Quantidade maior que o estoque disponível → 409, estoque não muda.
Duas compras ao mesmo tempo disputando a última unidade → só uma passa, a outra recebe erro.

Vantagem de escrever antes de implementar: obriga a pensar em como o código deveria se comportar antes de sair escrevendo, incluindo os casos de erro que às vezes a gente só lembra depois. E depois, toda vez que eu mexer em algo, rodo os testes de novo pra ter certeza que não quebrei nada que já funcionava.

## 5. Uso de IA: Problema 2 (furo de estoque)

Prompts que eu daria:

"Explica por que duas compras ao mesmo tempo podem conseguir comprar a última unidade de um produto, mesmo com o sistema checando o estoque antes de aprovar a compra."

"Pra uma API em Node.js com NestJS, com produtos guardados em memória (sem banco), como eu garanto que o estoque nunca fica negativo mesmo se duas compras chegarem ao mesmo tempo?"

"Que testes eu deveria escrever pra ter certeza que isso funciona, incluindo o caso de duas compras simultâneas?"

"Revisa esse código e me diz se ainda dá pra vender mais do que tem estoque em algum cenário que eu não pensei."

Eu testaria o que a IA sugerir antes de usar, e tentaria entender o porquê da solução. Não colocaria no código algo que eu não consigo explicar depois.

Também poderia utilizar ferramentas de SDD como openspec, iniciando com openspec change new fix-stock-issue, e depois iria iterar com a IA para gerar um proposal, revisar a proposta, gerar o código e os testes, e revisar tudo antes de aprovar. Assim a IA ajuda a acelerar o processo, mas não substitui a revisão humana.