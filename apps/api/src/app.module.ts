import { Module } from '@nestjs/common';
import { ProductsModule } from './products/products.module.js';
import { CheckoutModule } from './checkout/checkout.module.js';
import { HealthModule } from './health/health.module.js';

@Module({
  imports: [ProductsModule, CheckoutModule, HealthModule],
})
export class AppModule {}
