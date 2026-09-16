export type BeginResult<T> =
  | { status: 'new' }
  | { status: 'in-flight' }
  | { status: 'replayed'; value: T }
  | { status: 'fingerprint-mismatch' };

interface Entry<T> {
  status: 'in-flight' | 'completed';
  fingerprint: string;
  createdAt: number;
  value?: T;
}

interface IdempotencyStoreOptions {
  /** Tempo de vida de uma entrada antes de ser tratada como expirada (ms). */
  ttlMs?: number;
  /** Número máximo de entradas guardadas simultaneamente. */
  maxEntries?: number;
}

const DEFAULT_TTL_MS = 10 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 1000;

/**
 * Store de idempotência em memória, pensado para uma única instância do processo
 * (sem Redis). Garante que repetir a mesma chave devolve o mesmo resultado em vez
 * de reprocessar a operação.
 *
 * Sem `setInterval`: a limpeza por TTL é preguiçosa (roda no início de `begin`) e a
 * evicção por teto acontece na inserção, evitando segurar o event loop ou vazar
 * timers entre testes.
 */
export class IdempotencyStore<T> {
  private readonly entries = new Map<string, Entry<T>>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(options?: IdempotencyStoreOptions) {
    this.ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
    this.maxEntries = options?.maxEntries ?? DEFAULT_MAX_ENTRIES;
  }

  begin(key: string, fingerprint: string): BeginResult<T> {
    this.evictExpired();

    const existing = this.entries.get(key);
    if (!existing) {
      this.insert(key, { status: 'in-flight', fingerprint, createdAt: Date.now() });
      return { status: 'new' };
    }

    if (existing.fingerprint !== fingerprint) {
      return { status: 'fingerprint-mismatch' };
    }

    if (existing.status === 'in-flight') {
      return { status: 'in-flight' };
    }

    return { status: 'replayed', value: existing.value as T };
  }

  complete(key: string, value: T): void {
    const existing = this.entries.get(key);
    if (!existing) return;
    existing.status = 'completed';
    existing.value = value;
  }

  release(key: string): void {
    this.entries.delete(key);
  }

  private insert(key: string, entry: Entry<T>): void {
    if (this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey !== undefined) this.entries.delete(oldestKey);
    }
    this.entries.set(key, entry);
  }

  /** Remove, em ordem de inserção, as entradas expiradas encontradas no início do Map. */
  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (now - entry.createdAt < this.ttlMs) break;
      this.entries.delete(key);
    }
  }
}
