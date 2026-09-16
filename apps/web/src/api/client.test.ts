import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiError, getProducts, postCheckout } from './client';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function textResponse(status: number, body: string): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain' } });
}

/** Aguarda a promise rejeitar com um ApiError e o devolve tipado. */
async function expectApiError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
  }
  throw new Error('esperava que a chamada rejeitasse com ApiError');
}

const validProduct = {
  id: 'case-iphone-15-silicone',
  name: 'Capa iPhone 15 Silicone',
  model: 'iPhone 15',
  priceCents: 4990,
  stock: 5,
};

const validCheckoutResult = {
  orderId: 'a1b2c3d4-0000-0000-0000-000000000000',
  productId: validProduct.id,
  productName: validProduct.name,
  quantity: 1,
  unitPriceCents: 4990,
  totalCents: 4990,
  remainingStock: 4,
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getProducts', () => {
  it('devolve a lista de produtos no caminho feliz', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, [validProduct]));

    const products = await getProducts();

    expect(products).toEqual([validProduct]);
    expect(fetch).toHaveBeenCalledWith(
      '/api/products',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it.each([502, 503, 504])(
    'HTTP %d vira mensagem de instabilidade, retryable e sem ler o corpo',
    async (status) => {
      const response = textResponse(status, '<html>Bad Gateway</html>');
      const jsonSpy = vi.spyOn(response, 'json');
      vi.mocked(fetch).mockResolvedValue(response);

      const error = await expectApiError(getProducts());

      expect(error.kind).toBe('unavailable');
      expect(error.status).toBe(status);
      expect(error.retryable).toBe(true);
      expect(error.message).toBe(
        'Estamos com instabilidade no servidor. Tente novamente em alguns instantes.',
      );
      expect(jsonSpy).not.toHaveBeenCalled();
    },
  );

  it('outros 5xx viram mensagem genérica de servidor e são retryable', async () => {
    vi.mocked(fetch).mockResolvedValue(textResponse(500, 'internal error'));

    const error = await expectApiError(getProducts());

    expect(error.kind).toBe('http');
    expect(error.status).toBe(500);
    expect(error.retryable).toBe(true);
    expect(error.message).toBe(
      'Ocorreu um erro no servidor. Tente novamente em alguns instantes.',
    );
  });

  it('falha de rede (fetch rejeita) vira mensagem de conexão', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('fetch failed'));

    const error = await expectApiError(getProducts());

    expect(error.kind).toBe('network');
    expect(error.retryable).toBe(true);
    expect(error.message).toBe(
      'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
    );
    expect(error.cause).toBeInstanceOf(TypeError);
  });

  it('timeout do cliente (AbortSignal.timeout) vira mensagem de timeout', async () => {
    vi.mocked(fetch).mockRejectedValue(
      new DOMException('The operation timed out.', 'TimeoutError'),
    );

    const error = await expectApiError(getProducts());

    expect(error.kind).toBe('timeout');
    expect(error.retryable).toBe(true);
    expect(error.message).toBe('O servidor demorou para responder. Tente novamente.');
  });

  it('payload 200 fora do schema vira invalid-response', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, [{ id: 'sem-os-outros-campos' }]));

    const error = await expectApiError(getProducts());

    expect(error.kind).toBe('invalid-response');
    expect(error.retryable).toBe(false);
    expect(error.message).toBe('Recebemos uma resposta inesperada do servidor.');
  });

  it('corpo 200 não-JSON vira invalid-response', async () => {
    vi.mocked(fetch).mockResolvedValue(textResponse(200, 'não é json'));

    const error = await expectApiError(getProducts());

    expect(error.kind).toBe('invalid-response');
  });

  it('404 preserva a mensagem do back e não é retryable', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(404, {
        statusCode: 404,
        message: 'Produto "x" não encontrado',
        error: 'Not Found',
      }),
    );

    const error = await expectApiError(getProducts());

    expect(error.kind).toBe('http');
    expect(error.status).toBe(404);
    expect(error.retryable).toBe(false);
    expect(error.message).toBe('Produto "x" não encontrado');
  });

  it('409 preserva a mensagem do back e não é retryable', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(409, {
        statusCode: 409,
        message: 'Estoque insuficiente para "Capa X": solicitado 5, disponível 2',
        error: 'Conflict',
      }),
    );

    const error = await expectApiError(getProducts());

    expect(error.status).toBe(409);
    expect(error.retryable).toBe(false);
    expect(error.message).toContain('Estoque insuficiente');
  });

  it('400 com { message, issues } do ZodValidationPipe expõe os issues', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(400, {
        message: 'Dados inválidos',
        issues: [{ path: 'quantity', message: 'quantity deve ser maior que zero' }],
      }),
    );

    const error = await expectApiError(getProducts());

    expect(error.status).toBe(400);
    expect(error.message).toBe('Dados inválidos');
    expect(error.issues).toEqual([
      { path: 'quantity', message: 'quantity deve ser maior que zero' },
    ]);
  });

  it('400 com message como array (formato padrão do Nest) usa o primeiro item', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(400, { statusCode: 400, message: ['campo obrigatório'], error: 'Bad Request' }),
    );

    const error = await expectApiError(getProducts());

    expect(error.message).toBe('campo obrigatório');
  });
});

describe('postCheckout', () => {
  it('envia productId/quantity e devolve o resultado no caminho feliz', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(201, validCheckoutResult));

    const result = await postCheckout(validProduct.id, 1);

    expect(result).toEqual(validCheckoutResult);
    expect(fetch).toHaveBeenCalledWith(
      '/api/checkout',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: validProduct.id, quantity: 1 }),
      }),
    );
  });

  it('503 vira mensagem de instabilidade', async () => {
    vi.mocked(fetch).mockResolvedValue(textResponse(503, ''));

    const error = await expectApiError(postCheckout(validProduct.id, 1));

    expect(error.kind).toBe('unavailable');
    expect(error.retryable).toBe(true);
  });
});
