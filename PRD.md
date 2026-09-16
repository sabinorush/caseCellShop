# CaseCellShop

A CaseCellShop é uma loja de capa para celulares.

## Monorepo
PNPM workspaces com atalhos no package.json usando o --filter para evitar navegar entre pastas antes de executar os scripts

## Front-end
App React + typescript com Vite.
Estilos com css modules.
Zod para validação de formulários.

## Back-end
API RESTful com Node.js e NestJS (nest new e nest generate resource checkout).
Zod para validacoes.

## fora de escopo
- Autenticação
- gateway de pagamento
- Banco de dados persistente
- deploy
- layout muito elaborado, apenas funcionalidade mínima para teste de compra
- docker

## Regras
-  A quantidade solicitada não pode ser maior que o estoque
-  O estoque só é reduzido em uma compra bem-sucedida.
-  O botão de comprar não pode permitir envio duplicado enquanto a compra está em processamento.