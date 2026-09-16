import { Module } from '@nestjs/common';
import { CheckoutService } from './checkout.service.js';
import { CheckoutController } from './checkout.controller.js';
import { ProductsModule } from '../products/products.module.js';

@Module({
  imports: [ProductsModule],
  controllers: [CheckoutController],
  providers: [CheckoutService],
})
export class CheckoutModule {}
