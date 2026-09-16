import { Body, Controller, Post, UsePipes } from '@nestjs/common';
import { CheckoutService } from './checkout.service.js';
import { checkoutSchema, type CheckoutDto } from './checkout.schema.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import type { CheckoutResult } from './checkout-result.types.js';

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(checkoutSchema))
  purchase(@Body() dto: CheckoutDto): CheckoutResult {
    return this.checkoutService.purchase(dto);
  }
}
