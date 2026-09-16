import type { ZodType } from 'zod';
import {
  checkoutResultSchema,
  productListSchema,
  type CheckoutResult,
  type Product,
} from './schemas';

export type ApiErrorKind = 'network' | 'timeout' | 'unavailable' | 'http' | 'invalid-response';

export interface ApiErrorIssue {
  path: string;
  message: string;
}

interface ApiErrorOptions {
  kind: ApiErrorKind;
  status?: number;
  issues?: ApiErrorIssue[];
  cause?: unknown;
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly issues?: ApiErrorIssue[];
  /** true quando faz sentido a UI oferecer "tentar novamente". */
  readonly retryable: boolean;

  constructor(message: string, options: ApiErrorOptions) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'ApiError';
    this.kind = options.kind;
    this.status = options.status;
    this.issues = options.issues;
    this.retryable =
      options.kind === 'network' ||
      options.kind === 'timeout' ||
      options.kind === 'unavailable' ||
      (options.kind === 'http' && (options.status ?? 0) >= 500);
  }
}

const MESSAGES = {
  unavailable: 'Estamos com instabilidade no servidor. Tente novamente em alguns instantes.',
  serverError: 'Ocorreu um erro no servidor. Tente novamente em alguns instantes.',
  network: 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
  timeout: 'O servidor demorou para responder. Tente novamente.',
  invalidResponse: 'Recebemos uma resposta inesperada do servidor.',
} as const;

const REQUEST_TIMEOUT_MS = 8_000;

// 502/503/504: erros de gateway/proxy. O corpo (quando existe) costuma ser
// HTML ou texto sem relação com a API, então nem tentamos lê-lo.
const GATEWAY_STATUS_CODES = new Set([502, 503, 504]);

async function toHttpError(response: Response): Promise<ApiError> {
  if (GATEWAY_STATUS_CODES.has(response.status)) {
    return new ApiError(MESSAGES.unavailable, { kind: 'unavailable', status: response.status });
  }
  if (response.status >= 500) {
    return new ApiError(MESSAGES.serverError, { kind: 'http', status: response.status });
  }

  try {
    const body = await response.json();
    // O back devolve `message` como string (404/409) ou array (400 padrão
    // do Nest); `issues` só existe no 400 do ZodValidationPipe.
    const message = Array.isArray(body?.message)
      ? body.message[0]
      : typeof body?.message === 'string'
        ? body.message
        : undefined;
    const issues: ApiErrorIssue[] | undefined = Array.isArray(body?.issues)
      ? body.issues
      : undefined;
    if (typeof message === 'string') {
      return new ApiError(message, { kind: 'http', status: response.status, issues });
    }
  } catch {
    // resposta sem corpo JSON legível
  }
  return new ApiError(`Erro inesperado (HTTP ${response.status})`, {
    kind: 'http',
    status: response.status,
  });
}

async function request<T>(path: string, schema: ZodType<T>, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new ApiError(MESSAGES.timeout, { kind: 'timeout', cause: error });
    }
    throw new ApiError(MESSAGES.network, { kind: 'network', cause: error });
  }

  if (!response.ok) {
    throw await toHttpError(response);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch (error) {
    throw new ApiError(MESSAGES.invalidResponse, { kind: 'invalid-response', cause: error });
  }

  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new ApiError(MESSAGES.invalidResponse, {
      kind: 'invalid-response',
      cause: parsed.error,
    });
  }
  return parsed.data;
}

export function getProducts(): Promise<Product[]> {
  return request('/api/products', productListSchema);
}

export function postCheckout(productId: string, quantity: number): Promise<CheckoutResult> {
  return request('/api/checkout', checkoutResultSchema, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId, quantity }),
  });
}
