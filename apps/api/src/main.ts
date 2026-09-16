import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { loadEnv } from './config/env.js';

async function bootstrap() {
  const envResult = loadEnv();
  if (!envResult.ok) {
    console.error(envResult.message);
    process.exitCode = 1;
    return;
  }
  const { env } = envResult;

  try {
    const app = await NestFactory.create(AppModule);
    app.enableCors();
    await app.listen(env.PORT);
    console.log(`API ouvindo em http://localhost:${env.PORT}`);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code === 'EADDRINUSE') {
      console.error(`A porta ${env.PORT} já está em uso. Encerre o processo que a está usando ou defina outra PORT no .env.`);
    } else {
      console.error('Falha ao iniciar a API:', error);
    }
    process.exitCode = 1;
  }
}
await bootstrap();
