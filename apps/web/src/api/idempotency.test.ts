import { describe, it, expect, vi } from 'vitest';
import { checkoutFingerprint, resolveAttempt } from './idempotency';

describe('checkoutFingerprint', () => {
  it('combina productId e quantity', () => {
    expect(checkoutFingerprint('case-x', 2)).toBe('case-x:2');
  });

  it('quantidades diferentes geram fingerprints diferentes', () => {
    expect(checkoutFingerprint('case-x', 1)).not.toBe(checkoutFingerprint('case-x', 2));
  });
});

describe('resolveAttempt', () => {
  it('gera uma chave nova quando não há tentativa corrente', () => {
    const newKey = vi.fn().mockReturnValue('key-1');

    const attempt = resolveAttempt(null, 'case-x:1', newKey);

    expect(attempt).toEqual({ key: 'key-1', fingerprint: 'case-x:1' });
    expect(newKey).toHaveBeenCalledOnce();
  });

  it('reusa a chave corrente quando o fingerprint não mudou', () => {
    const current = { key: 'key-1', fingerprint: 'case-x:1' };
    const newKey = vi.fn().mockReturnValue('key-2');

    const attempt = resolveAttempt(current, 'case-x:1', newKey);

    expect(attempt).toBe(current);
    expect(newKey).not.toHaveBeenCalled();
  });

  it('gera uma chave nova quando o fingerprint mudou', () => {
    const current = { key: 'key-1', fingerprint: 'case-x:1' };
    const newKey = vi.fn().mockReturnValue('key-2');

    const attempt = resolveAttempt(current, 'case-x:2', newKey);

    expect(attempt).toEqual({ key: 'key-2', fingerprint: 'case-x:2' });
    expect(newKey).toHaveBeenCalledOnce();
  });
});
