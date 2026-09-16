import { loadEnvFile } from 'node:process';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

loadEnvFile('.env');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
