import { ServerResponse } from "node:http";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { z } from "zod";

// Códigos de erro de socket que indicam "servidor não respondeu a tempo",
// em vez de "servidor não está no ar" — viram 504 em vez de 502.
const TIMEOUT_ERROR_CODES = new Set(["ETIMEDOUT", "ECONNRESET", "ECONNABORTED"]);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const apiUrlResult = z
    .string({ error: "API_URL não está definida" })
    .url("API_URL deve ser uma URL válida")
    .safeParse(env.API_URL);
  if (!apiUrlResult.success) {
    throw new Error(
      `Configuração inválida em apps/web/.env: ${apiUrlResult.error.issues[0]?.message}.\n` +
        "Verifique o arquivo .env (veja .env.example para os valores esperados).",
    );
  }
  const apiUrl = apiUrlResult.data;

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api": {
          target: apiUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
          timeout: 10_000,
          proxyTimeout: 10_000,
          // Simula, em dev, o que um reverse proxy de produção devolveria
          // quando a API está indisponível: 502 (fora do ar) ou 504
          // (não respondeu a tempo), sempre com um corpo JSON — em vez do
          // 502 text/plain vazio que o Vite devolve por padrão.
          configure: (proxy) => {
            proxy.on("error", (err, _req, res) => {
              if (!(res instanceof ServerResponse)) {
                // Erro numa conexão de websocket: não há resposta HTTP a montar.
                res.destroy();
                return;
              }
              if (res.headersSent || res.writableEnded) {
                res.end();
                return;
              }
              const code = (err as NodeJS.ErrnoException).code ?? "";
              const status = TIMEOUT_ERROR_CODES.has(code) ? 504 : 502;
              res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
              res.end(JSON.stringify({ statusCode: status, message: "API indisponível" }));
            });
          },
        },
      },
    },
  };
});
