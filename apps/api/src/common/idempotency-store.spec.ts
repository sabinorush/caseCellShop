import { describe, it, expect } from 'vitest';
import { IdempotencyStore } from './idempotency-store.js';

describe('IdempotencyStore', () => {
  it('devolve "new" na primeira vez que uma chave é usada', () => {
    const store = new IdempotencyStore<string>();
    expect(store.begin('key-1', 'fp-1')).toEqual({ status: 'new' });
  });

  it('devolve "in-flight" enquanto a chave não foi completada', () => {
    const store = new IdempotencyStore<string>();
    store.begin('key-1', 'fp-1');
    expect(store.begin('key-1', 'fp-1')).toEqual({ status: 'in-flight' });
  });

  it('devolve "replayed" com o valor salvo após complete()', () => {
    const store = new IdempotencyStore<string>();
    store.begin('key-1', 'fp-1');
    store.complete('key-1', 'resultado-original');

    expect(store.begin('key-1', 'fp-1')).toEqual({
      status: 'replayed',
      value: 'resultado-original',
    });
  });

  it('devolve "fingerprint-mismatch" quando a mesma chave é usada para outro pedido', () => {
    const store = new IdempotencyStore<string>();
    store.begin('key-1', 'fp-1');
    store.complete('key-1', 'resultado-original');

    expect(store.begin('key-1', 'fp-2')).toEqual({ status: 'fingerprint-mismatch' });
  });

  it('mismatch também é detectado enquanto a chave ainda está em voo', () => {
    const store = new IdempotencyStore<string>();
    store.begin('key-1', 'fp-1');

    expect(store.begin('key-1', 'fp-2')).toEqual({ status: 'fingerprint-mismatch' });
  });

  it('release() libera a chave para um novo begin', () => {
    const store = new IdempotencyStore<string>();
    store.begin('key-1', 'fp-1');
    store.release('key-1');

    expect(store.begin('key-1', 'fp-1')).toEqual({ status: 'new' });
  });

  it('trata uma entrada expirada por TTL como se fosse nova', async () => {
    const store = new IdempotencyStore<string>({ ttlMs: 1 });
    store.begin('key-1', 'fp-1');
    store.complete('key-1', 'resultado-original');

    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(store.begin('key-1', 'fp-1')).toEqual({ status: 'new' });
  });

  it('descarta a entrada mais antiga ao ultrapassar o teto de entradas', () => {
    const store = new IdempotencyStore<string>({ maxEntries: 2 });
    store.begin('key-1', 'fp-1');
    store.begin('key-2', 'fp-2');
    store.begin('key-3', 'fp-3'); // teto ultrapassado: key-1 (a mais antiga) é descartada

    // key-2 e key-3 continuam guardadas.
    expect(store.begin('key-2', 'fp-2')).toEqual({ status: 'in-flight' });
    expect(store.begin('key-3', 'fp-3')).toEqual({ status: 'in-flight' });
    // key-1 foi descartada: volta a ser "new".
    expect(store.begin('key-1', 'fp-1')).toEqual({ status: 'new' });
  });
});
