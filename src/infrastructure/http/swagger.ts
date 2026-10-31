import type { INestApplication } from '@nestjs/common';

import {
  DocumentBuilder,
  SwaggerModule,
} from '@nestjs/swagger';

export function createOpenApiDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Shop API')
    .setVersion('0.0.1')
    .setDescription(
      [
        'API каталога товаров и учёта остатков.',
        '',
        '## Цена',
        '- Цена передаётся в копейках.',
        '- null означает, что цена не назначена.',
        '- Нулевая цена допустима.',
        '',
        '## Учёт остатков',
        '- tracked: false и quantity: null — учёт отключён.',
        '- tracked: true и quantity: 0 — учёт включён, товара нет.',
        '- Приход добавляет количество к текущему остатку.',
        '- Списание уменьшает текущий остаток.',
        '- Приход и списание не устанавливают итоговый остаток.',
        '',
        '## Идемпотентность',
        '- Приход и списание требуют заголовок Idempotency-Key.',
        '- Значение ключа — UUID v4.',
        '- Для новой бизнес-операции нужен новый ключ.',
        '- Для повтора операции используются прежний ключ и параметры.',
        '- Точный повтор успешной операции возвращает 204 без повторного изменения.',
        '- Повтор ключа с другим товаром, количеством или направлением возвращает 409.',
        '- Бизнес-отказ не сохраняет ключ операции.',
        '- Успешные ключи хранятся без автоматического удаления.',
        '',
        '## Ограничения',
        '- Количество прихода и списания должно быть положительным целым числом.',
        '- Максимальный остаток — 2147483647.',
        '- Приход и списание требуют включённого учёта.',
        '- Списание не может сделать остаток отрицательным.',
      ].join('\n'),
    )
    .addTag('products', 'Каталог товаров, цены и учёт остатков')
    .build();

  return SwaggerModule.createDocument(app, config);
}

export function configureSwagger(app: INestApplication): void {
  const document = createOpenApiDocument(app);

  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: '/docs-json',
    customSiteTitle: 'Shop API — документация',
    swaggerOptions: {
      docExpansion: 'none',
      displayRequestDuration: true,
    },
  });
}