import { Controller, Get } from '@nestjs/common';
import { ProductsService } from './products.service.js';
import type { Product } from './product.types.js';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(): Product[] {
    return this.productsService.findAll();
  }
}
