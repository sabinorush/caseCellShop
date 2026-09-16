import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
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

  it('GET /health devolve status ok', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(response.body.status).toBe('ok');
    expect(typeof response.body.uptime).toBe('number');
  });

  it('POST /checkout com payload válido devolve 201', async () => {
    const products = await request(app.getHttpServer()).get('/products');
    const product = products.body[0];

    const response = await request(app.getHttpServer())
      .post('/checkout')
      .set('Idempotency-Key', randomUUID())
      .send({ productId: product.id, quantity: 1 })
      .expect(201);

    expect(response.body).toHaveProperty('orderId');
    expect(response.body.remainingStock).toBe(product.stock - 1);
  });

  it('POST /checkout com payload inválido devolve 400', async () => {
    await request(app.getHttpServer())
      .post('/checkout')
      .set('Idempotency-Key', randomUUID())
      .send({ quantity: 0 })
      .expect(400);
  });

  it('POST /checkout com estoque insuficiente devolve 409', async () => {
    const products = await request(app.getHttpServer()).get('/products');
    const outOfStock = products.body.find((p: { stock: number }) => p.stock === 0);

    await request(app.getHttpServer())
      .post('/checkout')
      .set('Idempotency-Key', randomUUID())
      .send({ productId: outOfStock.id, quantity: 1 })
      .expect(409);
  });

  it('POST /checkout com produto inexistente devolve 404', async () => {
    await request(app.getHttpServer())
      .post('/checkout')
      .set('Idempotency-Key', randomUUID())
      .send({ productId: 'produto-inexistente', quantity: 1 })
      .expect(404);
  });

  it('POST /checkout sem Idempotency-Key devolve 400', async () => {
    const products = await request(app.getHttpServer()).get('/products');
    const product = products.body[0];

    await request(app.getHttpServer())
      .post('/checkout')
      .send({ productId: product.id, quantity: 1 })
      .expect(400);
  });

  it('POST /checkout com Idempotency-Key que não é UUID devolve 400', async () => {
    const products = await request(app.getHttpServer()).get('/products');
    const product = products.body[0];

    await request(app.getHttpServer())
      .post('/checkout')
      .set('Idempotency-Key', 'nao-e-um-uuid')
      .send({ productId: product.id, quantity: 1 })
      .expect(400);
  });

  it('repetir a mesma Idempotency-Key devolve o mesmo pedido e decrementa o estoque uma única vez', async () => {
    const products = await request(app.getHttpServer()).get('/products');
    const product = products.body[0];
    const key = randomUUID();
    const payload = { productId: product.id, quantity: 1 };

    const first = await request(app.getHttpServer())
      .post('/checkout')
      .set('Idempotency-Key', key)
      .send(payload)
      .expect(201);

    const second = await request(app.getHttpServer())
      .post('/checkout')
      .set('Idempotency-Key', key)
      .send(payload)
      .expect(201);

    expect(second.body.orderId).toBe(first.body.orderId);
    expect(second.body.remainingStock).toBe(first.body.remainingStock);

    const afterProducts = await request(app.getHttpServer()).get('/products');
    const afterProduct = afterProducts.body.find((p: { id: string }) => p.id === product.id);
    expect(afterProduct.stock).toBe(product.stock - 1);
  });

  it('Idempotency-Keys diferentes geram compras independentes', async () => {
    const products = await request(app.getHttpServer()).get('/products');
    const product = products.body[0];
    const payload = { productId: product.id, quantity: 1 };

    const first = await request(app.getHttpServer())
      .post('/checkout')
      .set('Idempotency-Key', randomUUID())
      .send(payload)
      .expect(201);

    const second = await request(app.getHttpServer())
      .post('/checkout')
      .set('Idempotency-Key', randomUUID())
      .send(payload)
      .expect(201);

    expect(second.body.orderId).not.toBe(first.body.orderId);

    const afterProducts = await request(app.getHttpServer()).get('/products');
    const afterProduct = afterProducts.body.find((p: { id: string }) => p.id === product.id);
    expect(afterProduct.stock).toBe(product.stock - 2);
  });

  it('reusar a mesma Idempotency-Key com um pedido diferente devolve 422', async () => {
    const products = await request(app.getHttpServer()).get('/products');
    const product = products.body[0];
    const key = randomUUID();

    await request(app.getHttpServer())
      .post('/checkout')
      .set('Idempotency-Key', key)
      .send({ productId: product.id, quantity: 1 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/checkout')
      .set('Idempotency-Key', key)
      .send({ productId: product.id, quantity: 2 })
      .expect(422);
  });
});
