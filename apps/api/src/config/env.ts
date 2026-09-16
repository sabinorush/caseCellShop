import { loadEnvFile } from 'node:process';
import { resolve } from 'node:path';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number('PORT deve ser um número').int('PORT deve ser um número inteiro').min(1, 'PORT deve estar entre 1 e 65535').max(65535, 'PORT deve estar entre 1 e 65535'),
});

export type Env = z.infer<typeof envSchema>;

export type EnvResult =
  | { ok: true; env: Env }
  | { ok: false; message: string };

export function parseEnv(source: NodeJS.ProcessEnv): EnvResult {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    return {
      ok: false,
      message: `Configuração de ambiente inválida:\n${details}\n\nVerifique o arquivo .env (veja .env.example para os valores esperados).`,
    };
  }
  return { ok: true, env: result.data };
}

export function loadEnv(file = '.env'): EnvResult {
  const path = resolve(process.cwd(), file);
  try {
    loadEnvFile(file);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code === 'ENOENT') {
      return {
        ok: false,
        message: `Arquivo de ambiente não encontrado: ${path}\n\nCrie-o a partir do exemplo: cp .env.example .env`,
      };
    }
    return {
      ok: false,
      message: `Não foi possível carregar o arquivo de ambiente (${path}): ${(error as Error).message}`,
    };
  }
  return parseEnv(process.env);
}
