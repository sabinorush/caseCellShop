import { describe, it, expect } from 'vitest';
import { parseEnv, loadEnv } from './env.js';

describe('parseEnv', () => {
  it('aceita um PORT numérico válido', () => {
    const result = parseEnv({ PORT: '3000' } as NodeJS.ProcessEnv);
    expect(result.ok).toBe(true);
    expect(result.ok && result.env.PORT).toBe(3000);
  });

  it('rejeita quando PORT está ausente', () => {
    const result = parseEnv({} as NodeJS.ProcessEnv);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toContain('PORT');
  });

  it('rejeita PORT não numérico', () => {
    const result = parseEnv({ PORT: 'abc' } as NodeJS.ProcessEnv);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toContain('PORT');
  });

  it('rejeita PORT igual a 0', () => {
    const result = parseEnv({ PORT: '0' } as NodeJS.ProcessEnv);
    expect(result.ok).toBe(false);
  });

  it('rejeita PORT acima de 65535', () => {
    const result = parseEnv({ PORT: '70000' } as NodeJS.ProcessEnv);
    expect(result.ok).toBe(false);
  });

  it('rejeita PORT fracionário', () => {
    const result = parseEnv({ PORT: '3000.5' } as NodeJS.ProcessEnv);
    expect(result.ok).toBe(false);
  });
});

describe('loadEnv', () => {
  it('devolve mensagem citando o caminho quando o arquivo não existe', () => {
    const result = loadEnv('.env.arquivo-que-nao-existe');
    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toContain(
      '.env.arquivo-que-nao-existe',
    );
    expect(!result.ok && result.message).toContain('.env.example');
  });
});
