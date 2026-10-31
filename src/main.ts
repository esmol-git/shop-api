import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { configureApp } from './configure-app.js';

import { configureSwagger } from
  './infrastructure/http/swagger.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks();
  configureApp(app);

  if (process.env.SWAGGER_ENABLED === 'true') {
    configureSwagger(app);
  }

  await app.listen(process.env.PORT ?? 3000);
}

await bootstrap();