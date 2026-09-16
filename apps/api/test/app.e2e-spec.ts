import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';

describe('App (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /products devolve a lista de produtos', async () => {
    const response = await request(app.getHttpServer())
      .get('/products')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body[0]).toHaveProperty('id');
    expect(response.body[0]).toHaveProperty('stock');
  });

  it('POST /checkout com payload válido devolve 201', async () => {
    const products = await request(app.getHttpServer()).get('/products');
    const product = products.body[0];

    const response = await request(app.getHttpServer())
      .post('/checkout')
      .send({ productId: product.id, quantity: 1 })
      .expect(201);

    expect(response.body).toHaveProperty('orderId');
    expect(response.body.remainingStock).toBe(product.stock - 1);
  });

  it('POST /checkout com payload inválido devolve 400', async () => {
    await request(app.getHttpServer())
      .post('/checkout')
      .send({ quantity: 0 })
      .expect(400);
  });

  it('POST /checkout com estoque insuficiente devolve 409', async () => {
    const products = await request(app.getHttpServer()).get('/products');
    const outOfStock = products.body.find((p: { stock: number }) => p.stock === 0);

    await request(app.getHttpServer())
      .post('/checkout')
      .send({ productId: outOfStock.id, quantity: 1 })
      .expect(409);
  });

  it('POST /checkout com produto inexistente devolve 404', async () => {
    await request(app.getHttpServer())
      .post('/checkout')
      .send({ productId: 'produto-inexistente', quantity: 1 })
      .expect(404);
  });
});
