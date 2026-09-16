import { Body, Controller, Headers, Post } from '@nestjs/common';
import { CheckoutService } from './checkout.service.js';
import { checkoutSchema, idempotencyKeySchema, type CheckoutDto } from './checkout.schema.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import type { CheckoutResult } from './checkout-result.types.js';

// @Headers(), diferente de @Body()/@Param()/@Query(), não aceita um pipe como
// segundo argumento — o valor precisa ser validado manualmente no corpo do
// handler. Reaproveita o mesmo ZodValidationPipe usado no @Body().
const idempotencyKeyPipe = new ZodValidationPipe(idempotencyKeySchema, 'Idempotency-Key inválido');

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post()
  purchase(
    @Body(new ZodValidationPipe(checkoutSchema)) dto: CheckoutDto,
    @Headers('idempotency-key') rawIdempotencyKey: string | undefined,
  ): CheckoutResult {
    const idempotencyKey = idempotencyKeyPipe.transform(rawIdempotencyKey) as string;
    return this.checkoutService.purchase(dto, idempotencyKey);
  }
}
