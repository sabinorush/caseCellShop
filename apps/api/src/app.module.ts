import { Module } from '@nestjs/common';
import { ProductsModule } from './products/products.module.js';
import { CheckoutModule } from './checkout/checkout.module.js';

@Module({
  imports: [ProductsModule, CheckoutModule],
})
export class AppModule {}
