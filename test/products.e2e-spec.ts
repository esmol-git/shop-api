import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';
import { PrismaService } from
  '../src/infrastructure/database/prisma/prisma.service.js';
import { randomUUID } from 'node:crypto';
import { Product } from
  '../src/modules/catalog/domain/product.js';
import { StockQuantity } from
'../src/modules/catalog/domain/value-objects/stock-quantity.js';
import { PRODUCT_REPOSITORY } from
  '../src/modules/catalog/application/ports/product.repository.js';
import type { ProductRepository } from
  '../src/modules/catalog/application/ports/product.repository.js';
  import { StockMovementQuantity } from
  '../src/modules/catalog/domain/value-objects/stock-movement-quantity.js';
import {
  STOCK_MOVEMENT_REPOSITORY,
  type StockMovementRepository,
} from '../src/modules/catalog/application/ports/stock-movement.repository.js';

describe('Products (e2e)', () => {
  describe('Идемпотентный приход', () => {
    async function withProduct(
      stockQuantity: number | null,
      run: (
        id: string,
        repository: StockMovementRepository,
      ) => Promise<void>,
    ): Promise<void> {
      const id = randomUUID();
  
      try {
        await prisma.product.create({
          data: {
            id,
            name: 'E2E идемпотентный приход',
            slug: `e2e-${randomUUID()}`,
            priceInKopecks: 199_900,
            stockQuantity,
          },
        });
  
        const repository = app.get<StockMovementRepository>(
          STOCK_MOVEMENT_REPOSITORY,
        );
  
        await run(id, repository);
      } finally {
        await prisma.stockMovement.deleteMany({
          where: {
            productId: id,
          },
        });
  
        await prisma.product.deleteMany({
          where: { id },
        });
      }
    }
    it('выполняет приход один раз и распознаёт повтор', async () => {
      await withProduct(10, async (id, repository) => {
        const idempotencyKey = randomUUID();
    
        const input = {
          idempotencyKey,
          productId: id,
          quantity: StockMovementQuantity.create(5),
        };
    
        const first = await repository.increaseStockOnce(input);
        const repeated = await repository.increaseStockOnce(input);
    
        expect(first).toBe('applied');
        expect(repeated).toBe('replayed');
    
        const product = await prisma.product.findUnique({
          where: { id },
          select: {
            stockQuantity: true,
          },
        });
    
        expect(product).toEqual({
          stockQuantity: 15,
        });
    
        const movements = await prisma.stockMovement.findMany({
          where: {
            productId: id,
          },
        });
    
        expect(movements).toHaveLength(1);
    
        expect(movements[0]).toMatchObject({
          idempotencyKey,
          productId: id,
          direction: 'INCREASE',
          quantity: 5,
        });
      });
    });
    it('не сохраняет ключ при отсутствии товара', async () => {
      const repository = app.get<StockMovementRepository>(
        STOCK_MOVEMENT_REPOSITORY,
      );
    
      const idempotencyKey = randomUUID();
      const productId = randomUUID();
    
      try {
        const result = await repository.increaseStockOnce({
          idempotencyKey,
          productId,
          quantity: StockMovementQuantity.create(5),
        });
    
        expect(result).toBe('rejected');
    
        const movement = await prisma.stockMovement.findUnique({
          where: {
            idempotencyKey,
          },
        });
    
        expect(movement).toBeNull();
      } finally {
        await prisma.stockMovement.deleteMany({
          where: {
            idempotencyKey,
          },
        });
      }
    });
    it('позволяет повторить операцию после устранения причины отказа', async () => {
      await withProduct(null, async (id, repository) => {
        const input = {
          idempotencyKey: randomUUID(),
          productId: id,
          quantity: StockMovementQuantity.create(5),
        };
    
        expect(
          await repository.increaseStockOnce(input),
        ).toBe('rejected');
    
        await prisma.product.update({
          where: { id },
          data: {
            stockQuantity: 0,
          },
        });
    
        expect(
          await repository.increaseStockOnce(input),
        ).toBe('applied');
    
        const product = await prisma.product.findUnique({
          where: { id },
          select: {
            stockQuantity: true,
          },
        });
    
        expect(product).toEqual({
          stockQuantity: 5,
        });
    
        expect(
          await prisma.stockMovement.count({
            where: {
              idempotencyKey: input.idempotencyKey,
            },
          }),
        ).toBe(1);
      });
    });
    it('выполняет только один приход при конкурентном повторе ключа', async () => {
      await withProduct(10, async (id, repository) => {
        const input = {
          idempotencyKey: randomUUID(),
          productId: id,
          quantity: StockMovementQuantity.create(5),
        };
    
        const results = await Promise.all([
          repository.increaseStockOnce(input),
          repository.increaseStockOnce(input),
        ]);
    
        expect(
          results.filter((result) => result === 'applied'),
        ).toHaveLength(1);
    
        expect(
          results.filter((result) => result === 'replayed'),
        ).toHaveLength(1);
    
        const product = await prisma.product.findUnique({
          where: { id },
          select: {
            stockQuantity: true,
          },
        });
    
        expect(product).toEqual({
          stockQuantity: 15,
        });
    
        expect(
          await prisma.stockMovement.count({
            where: {
              idempotencyKey: input.idempotencyKey,
            },
          }),
        ).toBe(1);
      });
    });
    it.each([
      {
        title: 'другое количество',
        changeProduct: false,
        quantity: 7,
      },
      {
        title: 'другой товар',
        changeProduct: true,
        quantity: 5,
      },
    ])(
      'отклоняет повторное использование ключа: $title',
      async ({ changeProduct, quantity }) => {
        await withProduct(10, async (id, repository) => {
          const idempotencyKey = randomUUID();
    
          const first = await repository.increaseStockOnce({
            idempotencyKey,
            productId: id,
            quantity: StockMovementQuantity.create(5),
          });
    
          expect(first).toBe('applied');
    
          const conflictingProductId = changeProduct
            ? randomUUID()
            : id;
    
          const result = await repository.increaseStockOnce({
            idempotencyKey,
            productId: conflictingProductId,
            quantity: StockMovementQuantity.create(quantity),
          });
    
          expect(result).toBe('key-conflict');
    
          const product = await prisma.product.findUnique({
            where: { id },
            select: {
              stockQuantity: true,
            },
          });
    
          expect(product).toEqual({
            stockQuantity: 15,
          });
    
          expect(
            await prisma.stockMovement.count({
              where: {
                idempotencyKey,
              },
            }),
          ).toBe(1);
        });
      },
    );
    it.each([
      {
        title: 'учёт отключён',
        initial: null,
        incoming: 5,
      },
      {
        title: 'будет превышен максимум',
        initial: 2_147_483_643,
        incoming: 5,
      },
    ])(
      'откатывает запись операции при отказе: $title',
      async ({ initial, incoming }) => {
        await withProduct(initial, async (id, repository) => {
          const idempotencyKey = randomUUID();
    
          const result = await repository.increaseStockOnce({
            idempotencyKey,
            productId: id,
            quantity: StockMovementQuantity.create(incoming),
          });
    
          expect(result).toBe('rejected');
    
          const movement = await prisma.stockMovement.findUnique({
            where: {
              idempotencyKey,
            },
          });
    
          expect(movement).toBeNull();
    
          const product = await prisma.product.findUnique({
            where: { id },
            select: {
              stockQuantity: true,
            },
          });
    
          expect(product).toEqual({
            stockQuantity: initial,
          });
        });
      },
    );
    // Следующие тесты добавляем сюда.
  });
  describe('HTTP идемпотентный приход', () => {
    async function withProduct(
      run: (id: string) => Promise<void>,
    ): Promise<void> {
      const id = randomUUID();
  
      try {
        await prisma.product.create({
          data: {
            id,
            name: 'E2E HTTP идемпотентный приход',
            slug: `e2e-${randomUUID()}`,
            priceInKopecks: 199_900,
            stockQuantity: 10,
          },
        });
  
        await run(id);
      } finally {
        try {
          await prisma.stockMovement.deleteMany({
            where: {
              productId: id,
            },
          });
        } finally {
          await prisma.product.deleteMany({
            where: { id },
          });
        }
      }
    }
  
    async function expectState(
      id: string,
      quantity: number,
      movementCount: number,
    ): Promise<void> {
      const product = await prisma.product.findUnique({
        where: { id },
        select: {
          name: true,
          priceInKopecks: true,
          stockQuantity: true,
        },
      });
  
      expect(product).toEqual({
        name: 'E2E HTTP идемпотентный приход',
        priceInKopecks: 199_900,
        stockQuantity: quantity,
      });
  
      expect(
        await prisma.stockMovement.count({
          where: {
            productId: id,
          },
        }),
      ).toBe(movementCount);
  
      const response = await request(app.getHttpServer())
        .get(`/products/${id}`)
        .expect(200);
  
      expect(response.body.inventory).toEqual({
        tracked: true,
        quantity,
      });
    }
    it('возвращает 204 при повторе без повторного прихода', async () => {
      await withProduct(async (id) => {
        const key = randomUUID();
    
        const first = await request(app.getHttpServer())
          .post(`/products/${id}/inventory/increase`)
          .set('Idempotency-Key', key)
          .send({ quantity: 5 })
          .expect(204);
    
        const repeated = await request(app.getHttpServer())
          .post(`/products/${id}/inventory/increase`)
          .set('Idempotency-Key', key)
          .send({ quantity: 5 })
          .expect(204);
    
        expect(first.text).toBe('');
        expect(repeated.text).toBe('');
    
        await expectState(id, 15, 1);
      });
    });
    it('возвращает 409 при повторном ключе с другим количеством', async () => {
      await withProduct(async (id) => {
        const key = randomUUID();
    
        await request(app.getHttpServer())
          .post(`/products/${id}/inventory/increase`)
          .set('Idempotency-Key', key)
          .send({ quantity: 5 })
          .expect(204);
    
        const response = await request(app.getHttpServer())
          .post(`/products/${id}/inventory/increase`)
          .set('Idempotency-Key', key)
          .send({ quantity: 7 })
          .expect(409);
    
        expect(response.body.message).toBe(
          'Idempotency-Key уже использован для другой операции',
        );
    
        await expectState(id, 15, 1);
    
        const movement = await prisma.stockMovement.findUnique({
          where: {
            idempotencyKey: key,
          },
        });
    
        expect(movement).toMatchObject({
          productId: id,
          direction: 'INCREASE',
          quantity: 5,
        });
      });
    });
    it('возвращает 409 при использовании ключа для другого товара', async () => {
      await withProduct(async (firstId) => {
        await withProduct(async (secondId) => {
          const key = randomUUID();
    
          await request(app.getHttpServer())
            .post(`/products/${firstId}/inventory/increase`)
            .set('Idempotency-Key', key)
            .send({ quantity: 5 })
            .expect(204);
    
          const response = await request(app.getHttpServer())
            .post(`/products/${secondId}/inventory/increase`)
            .set('Idempotency-Key', key)
            .send({ quantity: 5 })
            .expect(409);
    
          expect(response.body.message).toBe(
            'Idempotency-Key уже использован для другой операции',
          );
    
          await expectState(firstId, 15, 1);
          await expectState(secondId, 10, 0);
        });
      });
    });
    it('выполняет новый приход с новым ключом', async () => {
      await withProduct(async (id) => {
        const firstKey = randomUUID();
        const secondKey = randomUUID();
    
        await request(app.getHttpServer())
          .post(`/products/${id}/inventory/increase`)
          .set('Idempotency-Key', firstKey)
          .send({ quantity: 5 })
          .expect(204);
    
        await request(app.getHttpServer())
          .post(`/products/${id}/inventory/increase`)
          .set('Idempotency-Key', secondKey)
          .send({ quantity: 5 })
          .expect(204);
    
        await expectState(id, 20, 2);
      });
    });
    it('выполняет один приход при двух конкурентных HTTP-запросах с одним ключом', async () => {
      await withProduct(async (id) => {
        const key = randomUUID();
    
        const responses = await Promise.all([
          request(app.getHttpServer())
            .post(`/products/${id}/inventory/increase`)
            .set('Idempotency-Key', key)
            .send({ quantity: 5 })
            .expect(204),
    
          request(app.getHttpServer())
            .post(`/products/${id}/inventory/increase`)
            .set('Idempotency-Key', key)
            .send({ quantity: 5 })
            .expect(204),
        ]);
    
        for (const response of responses) {
          expect(response.text).toBe('');
        }
    
        await expectState(id, 15, 1);
      });
    });
    it.each([
      {
        title: 'заголовок отсутствует',
        key: undefined,
      },
      {
        title: 'заголовок не является UUID',
        key: 'not-a-uuid',
      },
    ])(
      'возвращает 400, если $title',
      async ({ key }) => {
        await withProduct(async (id) => {
          const pendingRequest = request(app.getHttpServer())
            .post(`/products/${id}/inventory/increase`);
    
          if (key !== undefined) {
            pendingRequest.set('Idempotency-Key', key);
          }
    
          const response = await pendingRequest
            .send({ quantity: 5 })
            .expect(400);
    
          expect(response.body.message).toBe(
            'Заголовок Idempotency-Key должен содержать UUID v4',
          );
    
          await expectState(id, 10, 0);
        });
      },
    );

    // Следующие тесты добавляем сюда.
  });
  describe('HTTP идемпотентное списание', () => {
    async function withProduct(
      run: (id: string) => Promise<void>,
    ): Promise<void> {
      const id = randomUUID();

      try {
        await prisma.product.create({
          data: {
            id,
            name: 'E2E HTTP идемпотентное списание',
            slug: `e2e-${randomUUID()}`,
            priceInKopecks: 199_900,
            stockQuantity: 10,
          },
        });

        await run(id);
      } finally {
        try {
          await prisma.stockMovement.deleteMany({
            where: {
              productId: id,
            },
          });
        } finally {
          await prisma.product.deleteMany({
            where: { id },
          });
        }
      }
    }

    async function expectState(
      id: string,
      quantity: number,
      movementCount: number,
    ): Promise<void> {
      const product = await prisma.product.findUnique({
        where: { id },
        select: {
          name: true,
          priceInKopecks: true,
          stockQuantity: true,
        },
      });

      expect(product).toEqual({
        name: 'E2E HTTP идемпотентное списание',
        priceInKopecks: 199_900,
        stockQuantity: quantity,
      });

      expect(
        await prisma.stockMovement.count({
          where: {
            productId: id,
          },
        }),
      ).toBe(movementCount);

      const response = await request(app.getHttpServer())
        .get(`/products/${id}`)
        .expect(200);

      expect(response.body.inventory).toEqual({
        tracked: true,
        quantity,
      });
    }

    it('возвращает 204 при повторе без повторного списания', async () => {
      await withProduct(async (id) => {
        const key = randomUUID();

        const first = await request(app.getHttpServer())
          .post(`/products/${id}/inventory/decrease`)
          .set('Idempotency-Key', key)
          .send({ quantity: 5 })
          .expect(204);

        const repeated = await request(app.getHttpServer())
          .post(`/products/${id}/inventory/decrease`)
          .set('Idempotency-Key', key)
          .send({ quantity: 5 })
          .expect(204);

        expect(first.text).toBe('');
        expect(repeated.text).toBe('');

        await expectState(id, 5, 1);
      });
    });

    it('возвращает 409 при повторном ключе с другим количеством', async () => {
      await withProduct(async (id) => {
        const key = randomUUID();

        await request(app.getHttpServer())
          .post(`/products/${id}/inventory/decrease`)
          .set('Idempotency-Key', key)
          .send({ quantity: 5 })
          .expect(204);

        const response = await request(app.getHttpServer())
          .post(`/products/${id}/inventory/decrease`)
          .set('Idempotency-Key', key)
          .send({ quantity: 7 })
          .expect(409);

        expect(response.body.message).toBe(
          'Idempotency-Key уже использован для другой операции',
        );

        await expectState(id, 5, 1);

        const movement = await prisma.stockMovement.findUnique({
          where: {
            idempotencyKey: key,
          },
        });

        expect(movement).toMatchObject({
          productId: id,
          direction: 'DECREASE',
          quantity: 5,
        });
      });
    });

    it('возвращает 409 при использовании ключа для другого товара', async () => {
      await withProduct(async (firstId) => {
        await withProduct(async (secondId) => {
          const key = randomUUID();

          await request(app.getHttpServer())
            .post(`/products/${firstId}/inventory/decrease`)
            .set('Idempotency-Key', key)
            .send({ quantity: 5 })
            .expect(204);

          const response = await request(app.getHttpServer())
            .post(`/products/${secondId}/inventory/decrease`)
            .set('Idempotency-Key', key)
            .send({ quantity: 5 })
            .expect(409);

          expect(response.body.message).toBe(
            'Idempotency-Key уже использован для другой операции',
          );

          await expectState(firstId, 5, 1);
          await expectState(secondId, 10, 0);
        });
      });
    });

    it('выполняет новое списание с новым ключом', async () => {
      await withProduct(async (id) => {
        const firstKey = randomUUID();
        const secondKey = randomUUID();

        await request(app.getHttpServer())
          .post(`/products/${id}/inventory/decrease`)
          .set('Idempotency-Key', firstKey)
          .send({ quantity: 5 })
          .expect(204);

        await request(app.getHttpServer())
          .post(`/products/${id}/inventory/decrease`)
          .set('Idempotency-Key', secondKey)
          .send({ quantity: 5 })
          .expect(204);

        await expectState(id, 0, 2);
      });
    });

    it('выполняет одно списание при двух конкурентных HTTP-запросах с одним ключом', async () => {
      await withProduct(async (id) => {
        const key = randomUUID();

        const responses = await Promise.all([
          request(app.getHttpServer())
            .post(`/products/${id}/inventory/decrease`)
            .set('Idempotency-Key', key)
            .send({ quantity: 5 })
            .expect(204),

          request(app.getHttpServer())
            .post(`/products/${id}/inventory/decrease`)
            .set('Idempotency-Key', key)
            .send({ quantity: 5 })
            .expect(204),
        ]);

        for (const response of responses) {
          expect(response.text).toBe('');
        }

        await expectState(id, 5, 1);
      });
    });

    it.each([
      {
        title: 'заголовок отсутствует',
        key: undefined,
      },
      {
        title: 'заголовок не является UUID',
        key: 'not-a-uuid',
      },
    ])(
      'возвращает 400, если $title',
      async ({ key }) => {
        await withProduct(async (id) => {
          const pendingRequest = request(app.getHttpServer())
            .post(`/products/${id}/inventory/decrease`);

          if (key !== undefined) {
            pendingRequest.set('Idempotency-Key', key);
          }

          const response = await pendingRequest
            .send({ quantity: 5 })
            .expect(400);

          expect(response.body.message).toBe(
            'Заголовок Idempotency-Key должен содержать UUID v4',
          );

          await expectState(id, 10, 0);
        });
      },
    );
  });
  describe('Идемпотентное списание', () => {
    async function withProduct(
      stockQuantity: number | null,
      run: (
        id: string,
        repository: StockMovementRepository,
      ) => Promise<void>,
    ): Promise<void> {
      const id = randomUUID();
  
      try {
        await prisma.product.create({
          data: {
            id,
            name: 'E2E идемпотентное списание',
            slug: `e2e-${randomUUID()}`,
            priceInKopecks: 199_900,
            stockQuantity,
          },
        });
  
        const repository = app.get<StockMovementRepository>(
          STOCK_MOVEMENT_REPOSITORY,
        );
  
        await run(id, repository);
      } finally {
        try {
          await prisma.stockMovement.deleteMany({
            where: {
              productId: id,
            },
          });
        } finally {
          await prisma.product.deleteMany({
            where: { id },
          });
        }
      }
    }
  
    async function expectState(
      id: string,
      quantity: number | null,
      movementCount: number,
    ): Promise<void> {
      const product = await prisma.product.findUnique({
        where: { id },
        select: {
          name: true,
          priceInKopecks: true,
          stockQuantity: true,
        },
      });
  
      expect(product).toEqual({
        name: 'E2E идемпотентное списание',
        priceInKopecks: 199_900,
        stockQuantity: quantity,
      });
  
      expect(
        await prisma.stockMovement.count({
          where: {
            productId: id,
          },
        }),
      ).toBe(movementCount);
    }
    it('списывает последнюю единицу и распознаёт повтор', async () => {
      await withProduct(1, async (id, repository) => {
        const input = {
          idempotencyKey: randomUUID(),
          productId: id,
          quantity: StockMovementQuantity.create(1),
        };
    
        expect(
          await repository.decreaseStockOnce(input),
        ).toBe('applied');
    
        expect(
          await repository.decreaseStockOnce(input),
        ).toBe('replayed');
    
        await expectState(id, 0, 1);
    
        const movement = await prisma.stockMovement.findUnique({
          where: {
            idempotencyKey: input.idempotencyKey,
          },
        });
    
        expect(movement).toMatchObject({
          productId: id,
          direction: 'DECREASE',
          quantity: 1,
        });
      });
    });
    it('не позволяет использовать ключ прихода для списания', async () => {
      await withProduct(10, async (id, repository) => {
        const input = {
          idempotencyKey: randomUUID(),
          productId: id,
          quantity: StockMovementQuantity.create(5),
        };
    
        expect(
          await repository.increaseStockOnce(input),
        ).toBe('applied');
    
        expect(
          await repository.decreaseStockOnce(input),
        ).toBe('key-conflict');
    
        await expectState(id, 15, 1);
    
        const movement = await prisma.stockMovement.findUnique({
          where: {
            idempotencyKey: input.idempotencyKey,
          },
        });
    
        expect(movement).toMatchObject({
          direction: 'INCREASE',
          quantity: 5,
        });
      });
    });
    it('отклоняет повтор ключа списания с другим количеством', async () => {
      await withProduct(10, async (id, repository) => {
        const idempotencyKey = randomUUID();
    
        expect(
          await repository.decreaseStockOnce({
            idempotencyKey,
            productId: id,
            quantity: StockMovementQuantity.create(3),
          }),
        ).toBe('applied');
    
        expect(
          await repository.decreaseStockOnce({
            idempotencyKey,
            productId: id,
            quantity: StockMovementQuantity.create(4),
          }),
        ).toBe('key-conflict');
    
        await expectState(id, 7, 1);
    
        const movement = await prisma.stockMovement.findUnique({
          where: {
            idempotencyKey,
          },
        });
    
        expect(movement).toMatchObject({
          direction: 'DECREASE',
          quantity: 3,
        });
      });
    });
    it('не сохраняет ключ списания для отсутствующего товара', async () => {
      await withProduct(10, async (id, repository) => {
        await prisma.product.delete({
          where: { id },
        });
    
        const idempotencyKey = randomUUID();
    
        const result = await repository.decreaseStockOnce({
          idempotencyKey,
          productId: id,
          quantity: StockMovementQuantity.create(1),
        });
    
        expect(result).toBe('rejected');
    
        expect(
          await prisma.stockMovement.findUnique({
            where: {
              idempotencyKey,
            },
          }),
        ).toBeNull();
    
        expect(
          await prisma.product.findUnique({
            where: { id },
          }),
        ).toBeNull();
      });
    });
    it('списывает один раз при конкурентном повторе одного ключа', async () => {
      await withProduct(1, async (id, repository) => {
        const input = {
          idempotencyKey: randomUUID(),
          productId: id,
          quantity: StockMovementQuantity.create(1),
        };
    
        const results = await Promise.all([
          repository.decreaseStockOnce(input),
          repository.decreaseStockOnce(input),
        ]);
    
        expect(
          results.filter((result) => result === 'applied'),
        ).toHaveLength(1);
    
        expect(
          results.filter((result) => result === 'replayed'),
        ).toHaveLength(1);
    
        await expectState(id, 0, 1);
      });
    });
    it('выполняет только одно списание последней единицы с разными ключами', async () => {
      await withProduct(1, async (id, repository) => {
        const firstKey = randomUUID();
        const secondKey = randomUUID();
    
        const results = await Promise.all([
          repository.decreaseStockOnce({
            idempotencyKey: firstKey,
            productId: id,
            quantity: StockMovementQuantity.create(1),
          }),
    
          repository.decreaseStockOnce({
            idempotencyKey: secondKey,
            productId: id,
            quantity: StockMovementQuantity.create(1),
          }),
        ]);
    
        expect(
          results.filter((result) => result === 'applied'),
        ).toHaveLength(1);
    
        expect(
          results.filter((result) => result === 'rejected'),
        ).toHaveLength(1);
    
        await expectState(id, 0, 1);
    
        const appliedIndex = results.findIndex(
          (result) => result === 'applied',
        );
    
        const appliedKey = [firstKey, secondKey][appliedIndex];
    
        const movements = await prisma.stockMovement.findMany({
          where: {
            productId: id,
          },
        });
    
        expect(movements).toHaveLength(1);
    
        expect(movements[0]).toMatchObject({
          idempotencyKey: appliedKey,
          direction: 'DECREASE',
          quantity: 1,
        });
      });
    });
    it.each([
      {
        title: 'учёт отключён',
        initial: null,
        outgoing: 1,
      },
      {
        title: 'нулевой остаток',
        initial: 0,
        outgoing: 1,
      },
      {
        title: 'остатка недостаточно',
        initial: 2,
        outgoing: 3,
      },
    ])(
      'откатывает ключ при отказе: $title',
      async ({ initial, outgoing }) => {
        await withProduct(initial, async (id, repository) => {
          const idempotencyKey = randomUUID();
    
          const result = await repository.decreaseStockOnce({
            idempotencyKey,
            productId: id,
            quantity: StockMovementQuantity.create(outgoing),
          });
    
          expect(result).toBe('rejected');
    
          await expectState(id, initial, 0);
    
          expect(
            await prisma.stockMovement.findUnique({
              where: {
                idempotencyKey,
              },
            }),
          ).toBeNull();
        });
      },
    );
    // Следующие тесты добавляем сюда.
  });
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);

    await app.init();

    prisma = app.get(PrismaService);

    const databases = await prisma.$queryRaw<
      Array<{ database: string }>
    >`SELECT current_database() AS database`;

    expect(databases).toEqual([{ database: 'shop_test' }]);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });
  describe('Целостность схемы (CHECK)', () => {
    it('отклоняет отрицательную цену на уровне БД', async () => {
      const id = randomUUID();

      await expect(
        prisma.$executeRawUnsafe(
          `INSERT INTO products (id, name, slug, "priceInKopecks", "stockQuantity")
           VALUES ($1::uuid, $2, $3, $4, $5)`,
          id,
          'E2E check отрицательная цена',
          `e2e-check-price-${id}`,
          -1,
          null,
        ),
      ).rejects.toThrow(
        /products_price_in_kopecks_non_negative_check|23514/,
      );
    });

    it('отклоняет отрицательный остаток на уровне БД', async () => {
      const id = randomUUID();

      await expect(
        prisma.$executeRawUnsafe(
          `INSERT INTO products (id, name, slug, "priceInKopecks", "stockQuantity")
           VALUES ($1::uuid, $2, $3, $4, $5)`,
          id,
          'E2E check отрицательный остаток',
          `e2e-check-stock-${id}`,
          null,
          -1,
        ),
      ).rejects.toThrow(
        /products_stock_quantity_non_negative_check|23514/,
      );
    });

    it('отклоняет нулевое количество движения на уровне БД', async () => {
      const productId = randomUUID();
      const idempotencyKey = randomUUID();

      try {
        await prisma.product.create({
          data: {
            id: productId,
            name: 'E2E check движение',
            slug: `e2e-${randomUUID()}`,
            stockQuantity: 10,
          },
        });

        await expect(
          prisma.$executeRawUnsafe(
            `INSERT INTO stock_movements
              ("idempotencyKey", "productId", direction, quantity)
             VALUES ($1::uuid, $2::uuid, 'INCREASE'::"StockMovementDirection", $3)`,
            idempotencyKey,
            productId,
            0,
          ),
        ).rejects.toThrow(
          /stock_movements_quantity_positive_check|23514/,
        );
      } finally {
        await prisma.stockMovement.deleteMany({
          where: { productId },
        });
        await prisma.product.deleteMany({
          where: { id: productId },
        });
      }
    });

    it('допускает null цену и null остаток', async () => {
      const id = randomUUID();

      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO products (id, name, slug, "priceInKopecks", "stockQuantity")
           VALUES ($1::uuid, $2, $3, $4, $5)`,
          id,
          'E2E check null поля',
          `e2e-check-null-${id}`,
          null,
          null,
        );

        const record = await prisma.product.findUnique({
          where: { id },
          select: {
            priceInKopecks: true,
            stockQuantity: true,
          },
        });

        expect(record).toEqual({
          priceInKopecks: null,
          stockQuantity: null,
        });
      } finally {
        await prisma.product.deleteMany({
          where: { id },
        });
      }
    });
  });

  describe('Целостность схемы (FK stock_movements.productId)', () => {
    it('отклоняет вставку движения для несуществующего товара', async () => {
      const productId = randomUUID();
      const idempotencyKey = randomUUID();

      await expect(
        prisma.stockMovement.create({
          data: {
            idempotencyKey,
            productId,
            direction: 'INCREASE',
            quantity: 1,
          },
        }),
      ).rejects.toMatchObject({
        code: 'P2003',
      });

      const movement = await prisma.stockMovement.findUnique({
        where: { idempotencyKey },
      });

      expect(movement).toBeNull();
    });

    it('отклоняет прямое удаление товара с движением и сохраняет обе записи', async () => {
      const id = randomUUID();
      const idempotencyKey = randomUUID();

      try {
        await prisma.product.create({
          data: {
            id,
            name: 'E2E FK удаление с историей',
            slug: `e2e-${randomUUID()}`,
            stockQuantity: 0,
          },
        });

        await prisma.stockMovement.create({
          data: {
            idempotencyKey,
            productId: id,
            direction: 'INCREASE',
            quantity: 1,
          },
        });

        await expect(
          prisma.product.delete({
            where: { id },
          }),
        ).rejects.toMatchObject({
          code: 'P2003',
        });

        const product = await prisma.product.findUnique({
          where: { id },
        });
        const movement = await prisma.stockMovement.findUnique({
          where: { idempotencyKey },
        });

        expect(product).not.toBeNull();
        expect(movement).not.toBeNull();
      } finally {
        await prisma.stockMovement.deleteMany({
          where: { productId: id },
        });
        await prisma.product.deleteMany({
          where: { id },
        });
      }
    });

    it('HTTP: приход отсутствующего товара по-прежнему 404', async () => {
      const id = randomUUID();

      const response = await request(app.getHttpServer())
        .post(`/products/${id}/inventory/increase`)
        .set('Idempotency-Key', randomUUID())
        .send({ quantity: 1 })
        .expect(404);

      expect(response.body).toMatchObject({
        statusCode: 404,
        message: 'Товар не найден',
      });

      const movements = await prisma.stockMovement.count({
        where: { productId: id },
      });

      expect(movements).toBe(0);
    });

    it('HTTP: списание отсутствующего товара по-прежнему 404', async () => {
      const id = randomUUID();

      const response = await request(app.getHttpServer())
        .post(`/products/${id}/inventory/decrease`)
        .set('Idempotency-Key', randomUUID())
        .send({ quantity: 1 })
        .expect(404);

      expect(response.body).toMatchObject({
        statusCode: 404,
        message: 'Товар не найден',
      });
    });

    it('HTTP: удаление товара без движений разрешено', async () => {
      const id = randomUUID();

      try {
        await prisma.product.create({
          data: {
            id,
            name: 'E2E FK удаление без истории',
            slug: `e2e-${randomUUID()}`,
            stockQuantity: 0,
          },
        });

        await request(app.getHttpServer())
          .delete(`/products/${id}`)
          .expect(204, '');

        const product = await prisma.product.findUnique({
          where: { id },
        });

        expect(product).toBeNull();
      } finally {
        await prisma.product.deleteMany({
          where: { id },
        });
      }
    });

    it('HTTP: архивация товара с движениями сохраняет историю', async () => {
      const id = randomUUID();
      const idempotencyKey = randomUUID();

      try {
        await prisma.product.create({
          data: {
            id,
            name: 'E2E FK архив с историей',
            slug: `e2e-${randomUUID()}`,
            stockQuantity: 3,
          },
        });

        await prisma.stockMovement.create({
          data: {
            idempotencyKey,
            productId: id,
            direction: 'INCREASE',
            quantity: 3,
          },
        });

        await request(app.getHttpServer())
          .post(`/products/${id}/archive`)
          .expect(204, '');

        const product = await prisma.product.findUnique({
          where: { id },
          select: { archivedAt: true, stockQuantity: true },
        });
        const movement = await prisma.stockMovement.findUnique({
          where: { idempotencyKey },
        });

        expect(product?.archivedAt).toEqual(expect.any(Date));
        expect(product?.stockQuantity).toBe(3);
        expect(movement).not.toBeNull();
      } finally {
        await prisma.stockMovement.deleteMany({
          where: { productId: id },
        });
        await prisma.product.deleteMany({
          where: { id },
        });
      }
    });

    it('HTTP: удаление товара с историей возвращает 409', async () => {
      const id = randomUUID();
      const idempotencyKey = randomUUID();

      try {
        await prisma.product.create({
          data: {
            id,
            name: 'E2E FK HTTP удаление с историей',
            slug: `e2e-${randomUUID()}`,
            stockQuantity: 0,
          },
        });

        await prisma.stockMovement.create({
          data: {
            idempotencyKey,
            productId: id,
            direction: 'INCREASE',
            quantity: 1,
          },
        });

        const response = await request(app.getHttpServer())
          .delete(`/products/${id}`)
          .expect(409);

        expect(response.body).toMatchObject({
          statusCode: 409,
          message:
            'Товар имеет историю складских операций; используйте архивацию',
        });

        const product = await prisma.product.findUnique({
          where: { id },
        });
        const movement = await prisma.stockMovement.findUnique({
          where: { idempotencyKey },
        });

        expect(product).not.toBeNull();
        expect(movement).not.toBeNull();
      } finally {
        await prisma.stockMovement.deleteMany({
          where: { productId: id },
        });
        await prisma.product.deleteMany({
          where: { id },
        });
      }
    });
  });

  it('создаёт товар и сохраняет его в БД', async () => {
    const expectedName = `E2E проектор ${randomUUID()}`;
  
    try {
      const response = await request(app.getHttpServer())
        .post('/products')
        .send({
          name: `  ${expectedName}  `,
        })
        .expect(201);
  
      expect(response.body).toEqual({
        id: expect.any(String),
        name: expectedName,
        description: null,
        slug: expect.any(String),
        price: null,
        inventory: {
          tracked: false,
          quantity: null,
        },
        archivedAt: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
  
      const savedProducts = await prisma.product.findMany({
        where: {
          name: expectedName,
        },
        select: {
          id: true,
          name: true,
          priceInKopecks: true,
        },
      });
  
      expect(savedProducts).toEqual([
        {
          id: response.body.id,
          name: expectedName,
          priceInKopecks: null,
        },
      ]);
    } finally {
      await prisma.product.deleteMany({
        where: {
          name: expectedName,
        },
      });
    }
  });

  describe('Карточка каталога (description + slug)', () => {
    it('генерирует slug из RU-названия, если slug не передан', async () => {
      const expectedName = `E2E Проектор Kubster ${randomUUID().slice(0, 8)}`;

      try {
        const response = await request(app.getHttpServer())
          .post('/products')
          .send({
            name: expectedName,
            description: '  Короткое описание  ',
          })
          .expect(201);

        expect(response.body.name).toBe(expectedName);
        expect(response.body.description).toBe('Короткое описание');
        expect(response.body.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
        expect(response.body.slug).toContain('proektor-kubster');

        const saved = await prisma.product.findUnique({
          where: { id: response.body.id },
          select: { slug: true, description: true },
        });

        expect(saved).toEqual({
          slug: response.body.slug,
          description: 'Короткое описание',
        });
      } finally {
        await prisma.product.deleteMany({
          where: { name: expectedName },
        });
      }
    });

    it('при занятом base без явного slug делает retry product-{8 hex}', async () => {
      const occupantId = randomUUID();
      const collidingName = 'Проектор Epson';

      try {
        await prisma.product.deleteMany({
          where: {
            OR: [
              { slug: 'proektor-epson' },
              { name: collidingName },
            ],
          },
        });

        await prisma.product.create({
          data: {
            id: occupantId,
            name: 'Занятый base',
            slug: 'proektor-epson',
          },
        });

        const response = await request(app.getHttpServer())
          .post('/products')
          .send({ name: collidingName })
          .expect(201);

        expect(response.body.slug).toBe(
          `product-${String(response.body.id).replaceAll('-', '').slice(0, 8)}`,
        );
      } finally {
        await prisma.product.deleteMany({
          where: {
            OR: [
              { id: occupantId },
              { name: collidingName },
              { slug: 'proektor-epson' },
            ],
          },
        });
      }
    });

    it('создаёт товар с явным slug', async () => {
      const expectedName = `E2E товар со slug ${randomUUID().slice(0, 8)}`;
      const slug = `custom-slug-${randomUUID().slice(0, 8)}`;

      try {
        const response = await request(app.getHttpServer())
          .post('/products')
          .send({
            name: expectedName,
            slug,
          })
          .expect(201);

        expect(response.body).toMatchObject({
          name: expectedName,
          description: null,
          slug,
        });
      } finally {
        await prisma.product.deleteMany({
          where: { name: expectedName },
        });
      }
    });

    it('возвращает 409 при конфликте явного slug на создании', async () => {
      const slug = `taken-slug-${randomUUID().slice(0, 8)}`;
      const firstName = `E2E slug conflict A ${randomUUID().slice(0, 8)}`;
      const secondName = `E2E slug conflict B ${randomUUID().slice(0, 8)}`;

      try {
        await request(app.getHttpServer())
          .post('/products')
          .send({ name: firstName, slug })
          .expect(201);

        const response = await request(app.getHttpServer())
          .post('/products')
          .send({ name: secondName, slug })
          .expect(409);

        expect(response.body).toMatchObject({
          statusCode: 409,
          message: 'Slug уже занят',
        });
      } finally {
        await prisma.product.deleteMany({
          where: { name: { in: [firstName, secondName] } },
        });
      }
    });

    it('сохраняет пустое description как null', async () => {
      const expectedName = `E2E empty description ${randomUUID().slice(0, 8)}`;

      try {
        const response = await request(app.getHttpServer())
          .post('/products')
          .send({
            name: expectedName,
            description: '   ',
          })
          .expect(201);

        expect(response.body.description).toBeNull();

        const saved = await prisma.product.findUnique({
          where: { id: response.body.id },
          select: { description: true },
        });

        expect(saved?.description).toBeNull();
      } finally {
        await prisma.product.deleteMany({
          where: { name: expectedName },
        });
      }
    });

    it('принимает description длиной 5000 и отклоняет 5001', async () => {
      const okName = `E2E desc 5000 ${randomUUID().slice(0, 8)}`;
      const badName = `E2E desc 5001 ${randomUUID().slice(0, 8)}`;

      try {
        await request(app.getHttpServer())
          .post('/products')
          .send({
            name: okName,
            description: 'а'.repeat(5000),
          })
          .expect(201);

        const response = await request(app.getHttpServer())
          .post('/products')
          .send({
            name: badName,
            description: 'а'.repeat(5001),
          })
          .expect(400);

        expect(response.body).toMatchObject({
          statusCode: 400,
        });
      } finally {
        await prisma.product.deleteMany({
          where: { name: { in: [okName, badName] } },
        });
      }
    });

    it('обновляет description и slug через PATCH /products/:id/details', async () => {
      const id = randomUUID();
      const initialSlug = `initial-slug-${randomUUID().slice(0, 8)}`;
      const nextSlug = `next-slug-${randomUUID().slice(0, 8)}`;

      try {
        await prisma.product.create({
          data: {
            id,
            name: 'E2E details patch',
            slug: initialSlug,
            description: null,
          },
        });

        const response = await request(app.getHttpServer())
          .patch(`/products/${id}/details`)
          .send({
            description: '  Новое описание  ',
            slug: nextSlug,
          })
          .expect(200);

        expect(response.body).toMatchObject({
          id,
          name: 'E2E details patch',
          description: 'Новое описание',
          slug: nextSlug,
        });
      } finally {
        await prisma.product.deleteMany({ where: { id } });
      }
    });

    it('PATCH только description не меняет slug', async () => {
      const id = randomUUID();
      const slug = `keep-slug-${randomUUID().slice(0, 8)}`;

      try {
        await prisma.product.create({
          data: {
            id,
            name: 'E2E details description only',
            slug,
            description: null,
          },
        });

        const response = await request(app.getHttpServer())
          .patch(`/products/${id}/details`)
          .send({ description: 'Только описание' })
          .expect(200);

        expect(response.body).toMatchObject({
          description: 'Только описание',
          slug,
        });
      } finally {
        await prisma.product.deleteMany({ where: { id } });
      }
    });

    it('пустое тело PATCH details — 200 no-op с текущим телом', async () => {
      const id = randomUUID();
      const slug = `noop-empty-${randomUUID().slice(0, 8)}`;

      try {
        await prisma.product.create({
          data: {
            id,
            name: 'E2E empty details',
            slug,
            description: 'Было',
          },
        });

        const response = await request(app.getHttpServer())
          .patch(`/products/${id}/details`)
          .send({})
          .expect(200);

        expect(response.body).toMatchObject({
          id,
          name: 'E2E empty details',
          description: 'Было',
          slug,
        });
      } finally {
        await prisma.product.deleteMany({ where: { id } });
      }
    });

    it('PATCH тем же текущим slug — 200 no-op', async () => {
      const id = randomUUID();
      const slug = `noop-same-${randomUUID().slice(0, 8)}`;

      try {
        await prisma.product.create({
          data: {
            id,
            name: 'E2E same slug details',
            slug,
            description: null,
          },
        });

        const response = await request(app.getHttpServer())
          .patch(`/products/${id}/details`)
          .send({ slug })
          .expect(200);

        expect(response.body).toMatchObject({
          id,
          slug,
          description: null,
        });
      } finally {
        await prisma.product.deleteMany({ where: { id } });
      }
    });

    it('возвращает 409 при конфликте slug на PATCH details', async () => {
      const firstId = randomUUID();
      const secondId = randomUUID();
      const firstSlug = `details-taken-${randomUUID().slice(0, 8)}`;
      const secondSlug = `details-other-${randomUUID().slice(0, 8)}`;

      try {
        await prisma.product.createMany({
          data: [
            {
              id: firstId,
              name: 'E2E details conflict A',
              slug: firstSlug,
            },
            {
              id: secondId,
              name: 'E2E details conflict B',
              slug: secondSlug,
            },
          ],
        });

        const response = await request(app.getHttpServer())
          .patch(`/products/${secondId}/details`)
          .send({ slug: firstSlug })
          .expect(409);

        expect(response.body).toMatchObject({
          statusCode: 409,
          message: 'Slug уже занят',
        });
      } finally {
        await prisma.product.deleteMany({
          where: { id: { in: [firstId, secondId] } },
        });
      }
    });

    it('возвращает 400 при невалидном slug на PATCH details', async () => {
      const id = randomUUID();

      try {
        await prisma.product.create({
          data: {
            id,
            name: 'E2E invalid slug details',
            slug: `valid-slug-${randomUUID().slice(0, 8)}`,
          },
        });

        const response = await request(app.getHttpServer())
          .patch(`/products/${id}/details`)
          .send({ slug: 'INVALID SLUG' })
          .expect(400);

        expect(response.body).toMatchObject({
          statusCode: 400,
        });
      } finally {
        await prisma.product.deleteMany({ where: { id } });
      }
    });

    it('rename не меняет slug', async () => {
      const id = randomUUID();
      const slug = `rename-keep-${randomUUID().slice(0, 8)}`;

      try {
        await prisma.product.create({
          data: {
            id,
            name: 'Старое имя',
            slug,
          },
        });

        const response = await request(app.getHttpServer())
          .patch(`/products/${id}`)
          .send({ name: 'Новое имя' })
          .expect(200);

        expect(response.body).toMatchObject({
          name: 'Новое имя',
          slug,
        });
      } finally {
        await prisma.product.deleteMany({ where: { id } });
      }
    });

    it('после миграции у всех товаров есть уникальный slug', async () => {
      const rows = await prisma.product.findMany({
        select: { id: true, slug: true },
      });

      expect(rows.every((row) => row.slug !== null && row.slug.length > 0))
        .toBe(true);

      const slugs = rows.map((row) => row.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
    });
  });

  it('возвращает существующий товар по ID', async () => {
    const id = randomUUID();
    const name = `E2E чтение ${randomUUID()}`;
    const slug = `e2e-read-${randomUUID()}`;

    try {
      await prisma.product.create({
        data: {
          id,
          name,
          slug,
          description: 'Описание для чтения',
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/products/${id}`)
        .expect(200);

      expect(response.body).toEqual({
        id,
        name,
        description: 'Описание для чтения',
        slug,
        price: null,
        inventory: {
          tracked: false,
          quantity: null,
        },
        archivedAt: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    } finally {
      await prisma.product.deleteMany({
        where: {
          id,
        },
      });
    }
  });
  it('возвращает 404, если товар не найден', async () => {
    const id = randomUUID();
  
    const existingProduct = await prisma.product.findUnique({
      where: {
        id,
      },
    });
  
    expect(existingProduct).toBeNull();
  
    const response = await request(app.getHttpServer())
      .get(`/products/${id}`)
      .expect(404);
  
    expect(response.body).toMatchObject({
      statusCode: 404,
      message: 'Товар не найден',
    });
  });
  it('возвращает 400 для некорректного ID', async () => {
    const response = await request(app.getHttpServer())
      .get('/products/not-a-uuid')
      .expect(400);
  
    expect(response.body).toMatchObject({
      statusCode: 400,
    });
  });
  it('возвращает список с параметрами по умолчанию', async () => {
    const records = await prisma.product.findMany({
      where: {
        archivedAt: null,
      },
      orderBy: {
        id: 'asc',
      },
      take: 20,
      select: {
        id: true,
        name: true,
        description: true,
        slug: true,
        priceInKopecks: true,
        stockQuantity: true,
      },
    });
  
    const total = await prisma.product.count({
      where: {
        archivedAt: null,
      },
    });
  
    const response = await request(app.getHttpServer())
      .get('/products')
      .expect(200);
  
    expect(response.body).toEqual({
      items: records.map((record) => ({
        id: record.id,
        name: record.name,
        description: record.description,
        slug: record.slug,
        price: record.priceInKopecks === null
          ? null
          : {
              amount: record.priceInKopecks,
              currency: 'RUB',
            },
        inventory: record.stockQuantity === null
          ? {
              tracked: false,
              quantity: null,
            }
          : {
              tracked: true,
              quantity: record.stockQuantity,
            },
        archivedAt: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      })),
      total,
      limit: 20,
      offset: 0,
    });
  });
  it('применяет limit и offset, сохраняя общее количество', async () => {
    const products = [
      {
        id: randomUUID(),
        name: 'E2E список: первый товар',
        slug: `e2e-${randomUUID()}`,
      },
      {
        id: randomUUID(),
        name: 'E2E список: второй товар',
        slug: `e2e-${randomUUID()}`,
      },
      {
        id: randomUUID(),
        name: 'E2E список: третий товар',
        slug: `e2e-${randomUUID()}`,
      },
    ];
  
    const ids = products.map((product) => product.id);
  
    try {
      await prisma.product.createMany({
        data: products,
      });
  
      const allProducts = await prisma.product.findMany({
        where: {
          archivedAt: null,
        },
        orderBy: {
          id: 'asc',
        },
        select: {
          id: true,
          name: true,
          description: true,
          slug: true,
          priceInKopecks: true,
          stockQuantity: true,
        },
      });
  
      const response = await request(app.getHttpServer())
        .get('/products')
        .query({
          limit: 2,
          offset: 1,
        })
        .expect(200);
  
      expect(response.body).toEqual({
        items: allProducts.slice(1, 3).map((record) => ({
          id: record.id,
          name: record.name,
          description: record.description,
          slug: record.slug,
          price: record.priceInKopecks === null
            ? null
            : {
                amount: record.priceInKopecks,
                currency: 'RUB',
              },
          inventory: record.stockQuantity === null
            ? {
                tracked: false,
                quantity: null,
              }
            : {
                tracked: true,
                quantity: record.stockQuantity,
              },
          archivedAt: null,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        })),
        total: allProducts.length,
        limit: 2,
        offset: 1,
      });
    } finally {
      await prisma.product.deleteMany({
        where: {
          id: {
            in: ids,
          },
        },
      });
    }
  });
  it('возвращает пустую страницу, если offset больше total', async () => {
    const total = await prisma.product.count({
      where: {
        archivedAt: null,
      },
    });
    const offset = total + 10;
  
    const response = await request(app.getHttpServer())
      .get('/products')
      .query({
        limit: 20,
        offset,
      })
      .expect(200);
  
    expect(response.body).toEqual({
      items: [],
      total,
      limit: 20,
      offset,
    });
  });
  it('переименовывает товар и сохраняет новое название в БД', async () => {
    const id = randomUUID();
  
    try {
      await prisma.product.create({
        data: {
          id,
          name: 'Проектор Epson',
          description: null,
          slug: `e2e-${randomUUID()}`,
          priceInKopecks: null,
        },
      });
  
      const response = await request(app.getHttpServer())
        .patch(`/products/${id}`)
        .send({
          name: '  Проектор Kubster  ',
        })
        .expect(200);
  
      expect(response.body).toEqual({
        id,
        name: 'Проектор Kubster',
        description: null,
        slug: expect.any(String),
        price: null,
        inventory: {
          tracked: false,
          quantity: null,
        },
        archivedAt: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
  
      const savedProduct = await prisma.product.findUnique({
        where: {
          id,
        },
        select: {
          id: true,
          name: true,
          priceInKopecks: true,
        },
      });
  
      expect(savedProduct).toEqual({
        id,
        name: 'Проектор Kubster',
        priceInKopecks: null,
      });
    } finally {
      await prisma.product.deleteMany({
        where: {
          id,
        },
      });
    }
  });
  it('возвращает 404 при переименовании отсутствующего товара', async () => {
    const id = randomUUID();
  
    const existingProduct = await prisma.product.findUnique({
      where: {
        id,
      },
    });
  
    expect(existingProduct).toBeNull();
  
    try {
      const response = await request(app.getHttpServer())
        .patch(`/products/${id}`)
        .send({
          name: 'Проектор Kubster',
        })
        .expect(404);
  
      expect(response.body).toMatchObject({
        statusCode: 404,
        message: 'Товар не найден',
      });
  
      const productAfterRequest = await prisma.product.findUnique({
        where: {
          id,
        },
      });
  
      expect(productAfterRequest).toBeNull();
    } finally {
      await prisma.product.deleteMany({
        where: {
          id,
        },
      });
    }
  });
  it('возвращает 400 при переименовании с некорректным ID', async () => {
    const response = await request(app.getHttpServer())
      .patch('/products/not-a-uuid')
      .send({
        name: 'Проектор Kubster',
      })
      .expect(400);
  
    expect(response.body).toMatchObject({
      statusCode: 400,
    });
  });
  it('удаляет только указанный товар и возвращает пустой ответ 204', async () => {
    const deletedId = randomUUID();
    const preservedId = randomUUID();
  
    const preservedProduct = {
      id: preservedId,
      name: 'E2E товар, который должен остаться',
      slug: `e2e-${randomUUID()}`,
    };
  
    try {
      await prisma.product.createMany({
        data: [
          {
            id: deletedId,
            name: 'E2E товар для удаления',
            slug: `e2e-${randomUUID()}`,
          },
          preservedProduct,
        ],
      });
  
      await request(app.getHttpServer())
        .delete(`/products/${deletedId}`)
        .expect(204, '');
  
      const deletedProduct = await prisma.product.findUnique({
        where: {
          id: deletedId,
        },
      });
  
      expect(deletedProduct).toBeNull();
  
      const remainingProduct = await prisma.product.findUnique({
        where: {
          id: preservedId,
        },
        select: {
          id: true,
          name: true,
          slug: true,
        },
      });
  
      expect(remainingProduct).toEqual(preservedProduct);
  
      await request(app.getHttpServer())
        .get(`/products/${deletedId}`)
        .expect(404);
    } finally {
      await prisma.product.deleteMany({
        where: {
          id: {
            in: [deletedId, preservedId],
          },
        },
      });
    }
  });
  it('возвращает 404 при повторном удалении товара', async () => {
    const id = randomUUID();
  
    try {
      await prisma.product.create({
        data: {
          id,
          name: 'E2E повторное удаление',
          slug: `e2e-${randomUUID()}`,
        },
      });
  
      await request(app.getHttpServer())
        .delete(`/products/${id}`)
        .expect(204, '');
  
      const response = await request(app.getHttpServer())
        .delete(`/products/${id}`)
        .expect(404);
  
      expect(response.body).toMatchObject({
        statusCode: 404,
        message: 'Товар не найден',
      });
  
      const product = await prisma.product.findUnique({
        where: {
          id,
        },
      });
  
      expect(product).toBeNull();
    } finally {
      await prisma.product.deleteMany({
        where: {
          id,
        },
      });
    }
  });
  it('возвращает 404 при удалении отсутствующего товара', async () => {
    const id = randomUUID();
  
    const existingProduct = await prisma.product.findUnique({
      where: {
        id,
      },
    });
  
    expect(existingProduct).toBeNull();
  
    const response = await request(app.getHttpServer())
      .delete(`/products/${id}`)
      .expect(404);
  
    expect(response.body).toMatchObject({
      statusCode: 404,
      message: 'Товар не найден',
    });
  });
  it('возвращает 400 для некорректного ID и не удаляет товар', async () => {
    const id = randomUUID();
  
    const originalProduct = {
      id,
      name: 'E2E товар для проверки некорректного ID',
      slug: `e2e-${randomUUID()}`,
    };
  
    try {
      await prisma.product.create({
        data: originalProduct,
      });
  
      const response = await request(app.getHttpServer())
        .delete('/products/not-a-uuid')
        .expect(400);
  
      expect(response.body).toMatchObject({
        statusCode: 400,
      });
  
      const savedProduct = await prisma.product.findUnique({
        where: {
          id,
        },
        select: {
          id: true,
          name: true,
          slug: true,
        },
      });

      expect(savedProduct).toEqual(originalProduct);
    } finally {
      await prisma.product.deleteMany({
        where: {
          id,
        },
      });
    }
  });
  it('возвращает 409 при удалении товара с положительным остатком', async () => {
    const id = randomUUID();

    try {
      await prisma.product.create({
        data: {
          id,
          name: 'E2E удаление с остатком',
          slug: `e2e-${randomUUID()}`,
          stockQuantity: 5,
        },
      });

      const response = await request(app.getHttpServer())
        .delete(`/products/${id}`)
        .expect(409);

      expect(response.body).toMatchObject({
        statusCode: 409,
        message: 'Нельзя удалить товар с положительным остатком',
      });

      const product = await prisma.product.findUnique({
        where: { id },
        select: { id: true, stockQuantity: true },
      });

      expect(product).toEqual({
        id,
        stockQuantity: 5,
      });
    } finally {
      await prisma.product.deleteMany({
        where: { id },
      });
    }
  });
  it('возвращает 409 при удалении товара с историей движений', async () => {
    const id = randomUUID();
    const idempotencyKey = randomUUID();

    try {
      await prisma.product.create({
        data: {
          id,
          name: 'E2E удаление с историей',
          slug: `e2e-${randomUUID()}`,
          stockQuantity: 0,
        },
      });

      await prisma.stockMovement.create({
        data: {
          idempotencyKey,
          productId: id,
          direction: 'INCREASE',
          quantity: 1,
        },
      });

      const response = await request(app.getHttpServer())
        .delete(`/products/${id}`)
        .expect(409);

      expect(response.body).toMatchObject({
        statusCode: 409,
        message:
          'Товар имеет историю складских операций; используйте архивацию',
      });

      const product = await prisma.product.findUnique({
        where: { id },
      });

      expect(product).not.toBeNull();

      const movements = await prisma.stockMovement.count({
        where: { productId: id },
      });

      expect(movements).toBe(1);
    } finally {
      await prisma.stockMovement.deleteMany({
        where: { productId: id },
      });
      await prisma.product.deleteMany({
        where: { id },
      });
    }
  });
  it('удаляет товар с нулевым остатком без истории', async () => {
    const id = randomUUID();

    try {
      await prisma.product.create({
        data: {
          id,
          name: 'E2E удаление нулевого остатка',
          slug: `e2e-${randomUUID()}`,
          stockQuantity: 0,
        },
      });

      await request(app.getHttpServer())
        .delete(`/products/${id}`)
        .expect(204, '');

      const product = await prisma.product.findUnique({
        where: { id },
      });

      expect(product).toBeNull();
    } finally {
      await prisma.product.deleteMany({
        where: { id },
      });
    }
  });
  it('архивирует товар, сохраняет остаток и исключает из списка', async () => {
    const id = randomUUID();
    const name = 'E2E архивация товара';

    try {
      await prisma.product.create({
        data: {
          id,
          name,
          priceInKopecks: 199_900,
          stockQuantity: 7,
          slug: `e2e-${randomUUID()}`,
        },
      });

      await request(app.getHttpServer())
        .post(`/products/${id}/archive`)
        .expect(204, '');

      const record = await prisma.product.findUnique({
        where: { id },
        select: {
          stockQuantity: true,
          archivedAt: true,
        },
      });

      expect(record?.stockQuantity).toBe(7);
      expect(record?.archivedAt).toEqual(expect.any(Date));

      const getResponse = await request(app.getHttpServer())
        .get(`/products/${id}`)
        .expect(200);

      expect(getResponse.body).toMatchObject({
        id,
        name,
        inventory: {
          tracked: true,
          quantity: 7,
        },
        archivedAt: expect.any(String),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });

      const listResponse = await request(app.getHttpServer())
        .get('/products')
        .query({ limit: 100, offset: 0 })
        .expect(200);

      expect(
        listResponse.body.items.some(
          (item: { id: string }) => item.id === id,
        ),
      ).toBe(false);
    } finally {
      await prisma.product.deleteMany({
        where: { id },
      });
    }
  });
  it('повторная архивация возвращает 204', async () => {
    const id = randomUUID();

    try {
      await prisma.product.create({
        data: {
          id,
          name: 'E2E повтор архивации',
          slug: `e2e-${randomUUID()}`,
        },
      });

      await request(app.getHttpServer())
        .post(`/products/${id}/archive`)
        .expect(204, '');

      const firstArchivedAt = (
        await prisma.product.findUnique({
          where: { id },
          select: { archivedAt: true },
        })
      )?.archivedAt;

      await request(app.getHttpServer())
        .post(`/products/${id}/archive`)
        .expect(204, '');

      const secondArchivedAt = (
        await prisma.product.findUnique({
          where: { id },
          select: { archivedAt: true },
        })
      )?.archivedAt;

      expect(secondArchivedAt).toEqual(firstArchivedAt);
    } finally {
      await prisma.product.deleteMany({
        where: { id },
      });
    }
  });
  it('возвращает 404 при архивации отсутствующего товара', async () => {
    const id = randomUUID();

    const response = await request(app.getHttpServer())
      .post(`/products/${id}/archive`)
      .expect(404);

    expect(response.body).toMatchObject({
      statusCode: 404,
      message: 'Товар не найден',
    });
  });
  it('обновляет updatedAt при приходе и сохраняет createdAt', async () => {
    const id = randomUUID();

    try {
      await prisma.product.create({
        data: {
          id,
          name: 'E2E updatedAt при приходе',
          slug: `e2e-${randomUUID()}`,
          stockQuantity: 1,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      });

      await request(app.getHttpServer())
        .post(`/products/${id}/inventory/increase`)
        .set('Idempotency-Key', randomUUID())
        .send({ quantity: 2 })
        .expect(204);

      const record = await prisma.product.findUnique({
        where: { id },
        select: {
          createdAt: true,
          updatedAt: true,
          stockQuantity: true,
        },
      });

      expect(record?.stockQuantity).toBe(3);
      expect(record?.createdAt.toISOString()).toBe(
        '2026-01-01T00:00:00.000Z',
      );
      expect(record!.updatedAt.getTime()).toBeGreaterThan(
        record!.createdAt.getTime(),
      );
    } finally {
      await prisma.stockMovement.deleteMany({
        where: { productId: id },
      });
      await prisma.product.deleteMany({
        where: { id },
      });
    }
  });
  it('репозиторий сохраняет изменённую цену', async () => {
    const repository = app.get<ProductRepository>(PRODUCT_REPOSITORY);
    const id = randomUUID();
  
    try {
      await prisma.product.create({
        data: {
          id,
          name: 'E2E изменение цены',
          slug: `e2e-${randomUUID()}`,
          priceInKopecks: 199_900,
        },
      });
  
      const product = await repository.findById(id);
  
      if (product === null) {
        throw new Error('Подготовленный товар не найден');
      }
  
      product.changePrice(249_900);
  
      const updated = await repository.update(product);

      expect(updated).toBe('updated');

      const record = await prisma.product.findUnique({
        where: {
          id,
        },
      });

      expect(record).toMatchObject({
        id,
        name: 'E2E изменение цены',
        priceInKopecks: 249_900,
      });
    } finally {
      await prisma.product.deleteMany({
        where: {
          id,
        },
      });
    }
  });
  it('репозиторий восстанавливает цену товара в странице', async () => {
    const repository = app.get<ProductRepository>(PRODUCT_REPOSITORY);
    const id = randomUUID();
  
    try {
      await prisma.product.create({
        data: {
          id,
          name: 'E2E цена в списке',
          slug: `e2e-${randomUUID()}`,
          priceInKopecks: 199_900,
        },
      });
  
      const offset = await prisma.product.count({
        where: {
          id: {
            lt: id,
          },
        },
      });
  
      const page = await repository.findPage({
        limit: 1,
        offset,
      });
  
      expect(page.items).toHaveLength(1);
      expect(page.items[0]?.id).toBe(id);
      expect(page.items[0]?.price?.amount).toBe(199_900);
      expect(page.items[0]?.price?.currency).toBe('RUB');
    } finally {
      await prisma.product.deleteMany({
        where: {
          id,
        },
      });
    }
  });
  it('сохраняет цену при переименовании товара через HTTP', async () => {
    const id = randomUUID();
  
    try {
      await prisma.product.create({
        data: {
          id,
          name: 'Проектор Epson',
          slug: `e2e-${randomUUID()}`,
          priceInKopecks: 199_900,
        },
      });
  
      await request(app.getHttpServer())
        .patch(`/products/${id}`)
        .send({
          name: 'Проектор Kubster',
        })
        .expect(200);
  
      const record = await prisma.product.findUnique({
        where: {
          id,
        },
      });
  
      expect(record).toMatchObject({
        id,
        name: 'Проектор Kubster',
        priceInKopecks: 199_900,
      });
    } finally {
      await prisma.product.deleteMany({
        where: {
          id,
        },
      });
    }
  });
  it('возвращает 404 при изменении цены отсутствующего товара', async () => {
    const id = randomUUID();
  
    const existingProduct = await prisma.product.findUnique({
      where: {
        id,
      },
    });
  
    expect(existingProduct).toBeNull();
  
    try {
      const response = await request(app.getHttpServer())
        .patch(`/products/${id}/price`)
        .send({
          amount: 199_900,
        })
        .expect(404);
  
      expect(response.body).toMatchObject({
        statusCode: 404,
        message: 'Товар не найден',
      });
  
      const productAfterRequest = await prisma.product.findUnique({
        where: {
          id,
        },
      });
  
      expect(productAfterRequest).toBeNull();
    } finally {
      await prisma.product.deleteMany({
        where: {
          id,
        },
      });
    }
  });
  it('возвращает 400 при изменении цены с некорректным ID', async () => {
    const response = await request(app.getHttpServer())
      .patch('/products/not-a-uuid/price')
      .send({
        amount: 199_900,
      })
      .expect(400);
  
    expect(response.body).toMatchObject({
      statusCode: 400,
    });
  });
  it('репозиторий восстанавливает включённый учёт в странице', async () => {
    const repository = app.get<ProductRepository>(
      PRODUCT_REPOSITORY,
    );
  
    const id = randomUUID();
  
    try {
      await prisma.product.create({
        data: {
          id,
          name: 'E2E остаток в списке',
          slug: `e2e-${randomUUID()}`,
          stockQuantity: 0,
        },
      });
  
      const offset = await prisma.product.count({
        where: {
          id: {
            lt: id,
          },
        },
      });
  
      const page = await repository.findPage({
        limit: 1,
        offset,
      });
  
      expect(page.items).toHaveLength(1);
      expect(page.items[0]?.id).toBe(id);
      expect(page.items[0]?.inventoryTracked).toBe(true);
      expect(page.items[0]?.stockQuantity?.value).toBe(0);
    } finally {
      await prisma.product.deleteMany({
        where: {
          id,
        },
      });
    }
  });
  it('репозиторий включает учёт с нулевым остатком', async () => {
    const repository = app.get<ProductRepository>(
      PRODUCT_REPOSITORY,
    );
  
    const id = randomUUID();
  
    try {
      await prisma.product.create({
        data: {
          id,
          name: 'E2E включение учёта',
          slug: `e2e-${randomUUID()}`,
          stockQuantity: null,
        },
      });
  
      const enabled = await repository.enableInventoryTracking(
        id,
        StockQuantity.create(0),
      );
  
      expect(enabled).toBe(true);
  
      const record = await prisma.product.findUnique({
        where: {
          id,
        },
        select: {
          stockQuantity: true,
        },
      });
  
      expect(record?.stockQuantity).toBe(0);
    } finally {
      await prisma.product.deleteMany({
        where: {
          id,
        },
      });
    }
  });
  it('репозиторий не перезаписывает остаток при повторном включении', async () => {
    const repository = app.get<ProductRepository>(
      PRODUCT_REPOSITORY,
    );
  
    const id = randomUUID();
  
    try {
      await prisma.product.create({
        data: {
          id,
          name: 'E2E повторное включение',
          slug: `e2e-${randomUUID()}`,
          stockQuantity: 10,
        },
      });
  
      const enabled = await repository.enableInventoryTracking(
        id,
        StockQuantity.create(0),
      );
  
      expect(enabled).toBe(false);
  
      const record = await prisma.product.findUnique({
        where: {
          id,
        },
        select: {
          stockQuantity: true,
        },
      });
  
      expect(record?.stockQuantity).toBe(10);
    } finally {
      await prisma.product.deleteMany({
        where: {
          id,
        },
      });
    }
  });
  it('репозиторий отключает учёт остатков', async () => {
    const repository = app.get<ProductRepository>(
      PRODUCT_REPOSITORY,
    );
  
    const id = randomUUID();
  
    try {
      await prisma.product.create({
        data: {
          id,
          name: 'E2E отключение учёта',
          slug: `e2e-${randomUUID()}`,
          stockQuantity: 10,
        },
      });
  
      const disabled = await repository.disableInventoryTracking(id);
  
      expect(disabled).toBe(true);
  
      const record = await prisma.product.findUnique({
        where: {
          id,
        },
        select: {
          stockQuantity: true,
        },
      });
  
      expect(record?.stockQuantity).toBeNull();
    } finally {
      await prisma.product.deleteMany({
        where: {
          id,
        },
      });
    }
  });
  it('репозиторий сообщает об отсутствии товара при отключении', async () => {
    const repository = app.get<ProductRepository>(
      PRODUCT_REPOSITORY,
    );
  
    const missingId = randomUUID();
  
    const disabled = await repository.disableInventoryTracking(
      missingId,
    );
  
    expect(disabled).toBe(false);
  });
  it('репозиторий включает учёт только один раз при конкуренции', async () => {
    const repository = app.get<ProductRepository>(
      PRODUCT_REPOSITORY,
    );
  
    const id = randomUUID();
  
    try {
      await prisma.product.create({
        data: {
          id,
          name: 'E2E конкурентное включение',
          slug: `e2e-${randomUUID()}`,
          stockQuantity: null,
        },
      });
  
      const [first, second] = await Promise.all([
        repository.enableInventoryTracking(
          id,
          StockQuantity.create(5),
        ),
        repository.enableInventoryTracking(
          id,
          StockQuantity.create(7),
        ),
      ]);
  
      const enabledCount = [first, second].filter(
        (result) => result === true,
      ).length;
  
      expect(enabledCount).toBe(1);
  
      const record = await prisma.product.findUnique({
        where: {
          id,
        },
        select: {
          stockQuantity: true,
        },
      });
  
      expect([5, 7]).toContain(record?.stockQuantity);
    } finally {
      await prisma.product.deleteMany({
        where: {
          id,
        },
      });
    }
  });
  it('POST /products/:id/inventory возвращает 409 при включённом учёте', async () => {
    const id = randomUUID();
  
    try {
      await prisma.product.create({
        data: {
          id,
          name: 'E2E HTTP повторное включение',
          slug: `e2e-${randomUUID()}`,
          stockQuantity: 10,
        },
      });
  
      await request(app.getHttpServer())
        .post(`/products/${id}/inventory`)
        .send({ quantity: 0 })
        .expect(409);
  
      const record = await prisma.product.findUnique({
        where: {
          id,
        },
        select: {
          stockQuantity: true,
        },
      });
  
      expect(record).toEqual({
        stockQuantity: 10,
      });
    } finally {
      await prisma.product.deleteMany({
        where: {
          id,
        },
      });
    }
  });
  it('POST /products/:id/inventory возвращает 404 для отсутствующего товара', async () => {
    const id = randomUUID();
  
    await request(app.getHttpServer())
      .post(`/products/${id}/inventory`)
      .send({ quantity: 10 })
      .expect(404);
  });
  it('DELETE /products/:id/inventory возвращает 404 для отсутствующего товара', async () => {
    const id = randomUUID();
  
    await request(app.getHttpServer())
      .delete(`/products/${id}/inventory`)
      .expect(404);
  });
  it('POST /products/:id/inventory возвращает 400 для некорректного UUID', async () => {
    await request(app.getHttpServer())
      .post('/products/not-a-uuid/inventory')
      .send({ quantity: 10 })
      .expect(400);
  }); 
  it('DELETE /products/:id/inventory возвращает 400 для некорректного UUID', async () => {
    await request(app.getHttpServer())
      .delete('/products/not-a-uuid/inventory')
      .expect(400);
  });
  it('HTTP показывает изменения после включения и отключения учёта', async () => {
    const id = randomUUID();
    const name = 'E2E HTTP цикл учёта';
  
    try {
      await prisma.product.create({
        data: {
          id,
          name,
          priceInKopecks: 199_900,
          stockQuantity: null,
          slug: `e2e-${randomUUID()}`,
        },
      });
  
      const before = await request(app.getHttpServer())
        .get(`/products/${id}`)
        .expect(200);
  
      expect(before.body).toEqual({
        id,
        name,
        description: null,
        slug: expect.any(String),
        price: {
          amount: 199_900,
          currency: 'RUB',
        },
        inventory: {
          tracked: false,
          quantity: null,
        },
        archivedAt: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
  
      await request(app.getHttpServer())
        .post(`/products/${id}/inventory`)
        .send({ quantity: 0 })
        .expect(204);
  
      const afterEnable = await request(app.getHttpServer())
        .get(`/products/${id}`)
        .expect(200);
  
      expect(afterEnable.body).toEqual({
        id,
        name,
        description: null,
        slug: expect.any(String),
        price: {
          amount: 199_900,
          currency: 'RUB',
        },
        inventory: {
          tracked: true,
          quantity: 0,
        },
        archivedAt: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
  
      await request(app.getHttpServer())
        .delete(`/products/${id}/inventory`)
        .expect(204);
  
      const afterDisable = await request(app.getHttpServer())
        .get(`/products/${id}`)
        .expect(200);
  
      expect(afterDisable.body).toEqual({
        id,
        name,
        description: null,
        slug: expect.any(String),
        price: {
          amount: 199_900,
          currency: 'RUB',
        },
        inventory: {
          tracked: false,
          quantity: null,
        },
        archivedAt: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    } finally {
      await prisma.product.deleteMany({
        where: {
          id,
        },
      });
    }
  });
  it('POST /products/:id/inventory/increase возвращает 404 для отсутствующего товара', async () => {
    const id = randomUUID();
  
    await request(app.getHttpServer())
      .post(`/products/${id}/inventory/increase`)
      .set('Idempotency-Key', randomUUID())
      .send({ quantity: 5 })
      .expect(404);
  });
  it('POST /products/:id/inventory/increase возвращает 400 для некорректного UUID', async () => {
    await request(app.getHttpServer())
      .post('/products/not-a-uuid/inventory/increase')
      .set('Idempotency-Key', randomUUID())
      .send({ quantity: 5 })
      .expect(400);
  });
  it('POST /products/:id/inventory/decrease возвращает 404 для отсутствующего товара', async () => {
    const id = randomUUID();
  
    await request(app.getHttpServer())
      .post(`/products/${id}/inventory/decrease`)
      .set('Idempotency-Key', randomUUID())
      .send({ quantity: 1 })
      .expect(404);
  });  
  it('POST /products/:id/inventory/decrease возвращает 400 для некорректного UUID', async () => {
    await request(app.getHttpServer())
      .post('/products/not-a-uuid/inventory/decrease')
      .set('Idempotency-Key', randomUUID())
      .send({ quantity: 1 })
      .expect(400);
  });
  it('HTTP позволяет списать последнюю единицу только один раз', async () => {
    const id = randomUUID();
  
    try {
      await prisma.product.create({
        data: {
          id,
          name: 'E2E HTTP последняя единица',
          slug: `e2e-${randomUUID()}`,
          stockQuantity: 1,
        },
      });

      const firstKey = randomUUID();
      const secondKey = randomUUID();
  
      const responses = await Promise.all([
        request(app.getHttpServer())
          .post(`/products/${id}/inventory/decrease`)
          .set('Idempotency-Key', firstKey)
          .send({ quantity: 1 }),
  
        request(app.getHttpServer())
          .post(`/products/${id}/inventory/decrease`)
          .set('Idempotency-Key', secondKey)
          .send({ quantity: 1 }),
      ]);
  
      const statuses = responses
        .map((response) => response.status)
        .sort((first, second) => first - second);
  
      expect(statuses).toEqual([204, 409]);
  
      const successfulResponse = responses.find(
        (response) => response.status === 204,
      );
  
      expect(successfulResponse?.text).toBe('');
  
      const conflictResponse = responses.find(
        (response) => response.status === 409,
      );
  
      expect(conflictResponse?.body.message).toBe(
        'Недостаточно товара для списания',
      );
  
      const record = await prisma.product.findUnique({
        where: { id },
        select: {
          stockQuantity: true,
        },
      });
  
      expect(record).toEqual({
        stockQuantity: 0,
      });
  
      const readResponse = await request(app.getHttpServer())
        .get(`/products/${id}`)
        .expect(200);
  
      expect(readResponse.body.inventory).toEqual({
        tracked: true,
        quantity: 0,
      });
    } finally {
      try {
        await prisma.stockMovement.deleteMany({
          where: {
            productId: id,
          },
        });
      } finally {
        await prisma.product.deleteMany({
          where: { id },
        });
      }
    }
  });
  it.each([
    {
      title: 'нет quantity',
      body: {},
    },
    {
      title: 'quantity равно null',
      body: { quantity: null },
    },
    {
      title: 'нулевое количество',
      body: { quantity: 0 },
    },
    {
      title: 'отрицательное количество',
      body: { quantity: -1 },
    },
    {
      title: 'дробное количество',
      body: { quantity: 1.5 },
    },
    {
      title: 'количество выше максимума',
      body: { quantity: 2_147_483_648 },
    },
    {
      title: 'нечисловое значение',
      body: { quantity: 'not-a-number' },
    },
  ])(
    'POST /products/:id/inventory/decrease возвращает 400: $title',
    async ({ body }) => {
      const id = randomUUID();
  
      try {
        await prisma.product.create({
          data: {
            id,
            name: 'E2E HTTP некорректное списание',
            slug: `e2e-${randomUUID()}`,
            stockQuantity: 10,
          },
        });
  
        await request(app.getHttpServer())
          .post(`/products/${id}/inventory/decrease`)
          .set('Idempotency-Key', randomUUID())
          .send(body)
          .expect(400);
  
        const record = await prisma.product.findUnique({
          where: { id },
          select: {
            stockQuantity: true,
          },
        });
  
        expect(record).toEqual({
          stockQuantity: 10,
        });
      } finally {
        try {
          await prisma.stockMovement.deleteMany({
            where: {
              productId: id,
            },
          });
        } finally {
          await prisma.product.deleteMany({
            where: { id },
          });
        }
      }
    },
  );
  it.each([
    {
      title: 'учёт отключён',
      initial: null,
      outgoing: 1,
      message: 'Учёт остатков для товара отключён',
    },
    {
      title: 'нулевой остаток',
      initial: 0,
      outgoing: 1,
      message: 'Недостаточно товара для списания',
    },
    {
      title: 'остатка недостаточно',
      initial: 10,
      outgoing: 11,
      message: 'Недостаточно товара для списания',
    },
  ])(
    'POST /products/:id/inventory/decrease возвращает 409: $title',
    async ({ initial, outgoing, message }) => {
      const id = randomUUID();
      const name = 'E2E HTTP отказ в списании';
  
      try {
        await prisma.product.create({
          data: {
            id,
            name,
            priceInKopecks: 199_900,
            stockQuantity: initial,
            slug: `e2e-${randomUUID()}`,
          },
        });
  
        const response = await request(app.getHttpServer())
          .post(`/products/${id}/inventory/decrease`)
          .set('Idempotency-Key', randomUUID())
          .send({ quantity: outgoing })
          .expect(409);
  
        expect(response.body.message).toBe(message);
  
        const record = await prisma.product.findUnique({
          where: { id },
          select: {
            name: true,
            priceInKopecks: true,
            stockQuantity: true,
          },
        });
  
        expect(record).toEqual({
          name,
          priceInKopecks: 199_900,
          stockQuantity: initial,
        });
      } finally {
        try {
          await prisma.stockMovement.deleteMany({
            where: {
              productId: id,
            },
          });
        } finally {
          await prisma.product.deleteMany({
            where: { id },
          });
        }
      }
    },
  );
  it.each([
    {
      title: 'часть остатка',
      initial: 10,
      outgoing: 3,
      expected: 7,
    },
    {
      title: 'весь остаток',
      initial: 10,
      outgoing: 10,
      expected: 0,
    },
  ])(
    'POST /products/:id/inventory/decrease списывает $title',
    async ({ initial, outgoing, expected }) => {
      const id = randomUUID();
      const name = 'E2E HTTP списание';
  
      try {
        await prisma.product.create({
          data: {
            id,
            name,
            priceInKopecks: 199_900,
            stockQuantity: initial,
            slug: `e2e-${randomUUID()}`,
          },
        });
  
        const response = await request(app.getHttpServer())
          .post(`/products/${id}/inventory/decrease`)
          .set('Idempotency-Key', randomUUID())
          .send({ quantity: outgoing })
          .expect(204);
  
        expect(response.text).toBe('');
  
        const record = await prisma.product.findUnique({
          where: { id },
          select: {
            name: true,
            priceInKopecks: true,
            stockQuantity: true,
          },
        });
  
        expect(record).toEqual({
          name,
          priceInKopecks: 199_900,
          stockQuantity: expected,
        });
  
        const readResponse = await request(app.getHttpServer())
          .get(`/products/${id}`)
          .expect(200);
  
        expect(readResponse.body).toEqual({
          id,
          name,
          description: null,
          slug: expect.any(String),
          price: {
            amount: 199_900,
            currency: 'RUB',
          },
          inventory: {
            tracked: true,
            quantity: expected,
          },
          archivedAt: null,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        });
      } finally {
        try {
          await prisma.stockMovement.deleteMany({
            where: {
              productId: id,
            },
          });
        } finally {
          await prisma.product.deleteMany({
            where: { id },
          });
        }
      }
    },
  );
  it.each([
    {
      title: 'нет quantity',
      body: {},
    },
    {
      title: 'quantity равно null',
      body: { quantity: null },
    },
    {
      title: 'нулевое количество',
      body: { quantity: 0 },
    },
    {
      title: 'отрицательное количество',
      body: { quantity: -1 },
    },
    {
      title: 'дробное количество',
      body: { quantity: 1.5 },
    },
    {
      title: 'количество выше максимума',
      body: { quantity: 2_147_483_648 },
    },
    {
      title: 'нечисловое значение',
      body: { quantity: 'not-a-number' },
    },
  ])(
    'POST /products/:id/inventory/increase возвращает 400: $title',
    async ({ body }) => {
      const id = randomUUID();
  
      try {
        await prisma.product.create({
          data: {
            id,
            name: 'E2E HTTP некорректный приход',
            slug: `e2e-${randomUUID()}`,
            stockQuantity: 10,
          },
        });
  
        await request(app.getHttpServer())
          .post(`/products/${id}/inventory/increase`)
          .set('Idempotency-Key', randomUUID())
          .send(body)
          .expect(400);
  
        const record = await prisma.product.findUnique({
          where: { id },
          select: {
            stockQuantity: true,
          },
        });
  
        expect(record).toEqual({
          stockQuantity: 10,
        });
      } finally {
        await prisma.stockMovement.deleteMany({
          where: {
            productId: id,
          },
        });

        await prisma.product.deleteMany({
          where: { id },
        });
      }
    },
  );
  it.each([
    {
      title: 'учёт отключён',
      initial: null,
      incoming: 5,
      message: 'Учёт остатков для товара отключён',
    },
    {
      title: 'будет превышен максимум',
      initial: 2_147_483_643,
      incoming: 5,
      message: 'Приход превысит максимально допустимый остаток',
    },
  ])(
    'POST /products/:id/inventory/increase возвращает 409: $title',
    async ({ initial, incoming, message }) => {
      const id = randomUUID();
  
      try {
        await prisma.product.create({
          data: {
            id,
            name: 'E2E HTTP отказ в приходе',
            slug: `e2e-${randomUUID()}`,
            stockQuantity: initial,
          },
        });
  
        const response = await request(app.getHttpServer())
          .post(`/products/${id}/inventory/increase`)
          .set('Idempotency-Key', randomUUID())
          .send({ quantity: incoming })
          .expect(409);
  
        expect(response.body.message).toBe(message);
  
        const record = await prisma.product.findUnique({
          where: { id },
          select: {
            stockQuantity: true,
          },
        });
  
        expect(record).toEqual({
          stockQuantity: initial,
        });
      } finally {
        await prisma.stockMovement.deleteMany({
          where: {
            productId: id,
          },
        });

        await prisma.product.deleteMany({
          where: { id },
        });
      }
    },
  );
  it.each([
    {
      title: 'учёт отключён',
      initial: null,
      incoming: 5,
      message: 'Учёт остатков для товара отключён',
    },
    {
      title: 'будет превышен максимум',
      initial: 2_147_483_643,
      incoming: 5,
      message: 'Приход превысит максимально допустимый остаток',
    },
  ])(
    'POST /products/:id/inventory/increase возвращает 409: $title',
    async ({ initial, incoming, message }) => {
      const id = randomUUID();
  
      try {
        await prisma.product.create({
          data: {
            id,
            name: 'E2E HTTP отказ в приходе',
            slug: `e2e-${randomUUID()}`,
            stockQuantity: initial,
          },
        });
  
        const response = await request(app.getHttpServer())
          .post(`/products/${id}/inventory/increase`)
          .set('Idempotency-Key', randomUUID())
          .send({ quantity: incoming })
          .expect(409);
  
        expect(response.body.message).toBe(message);
  
        const record = await prisma.product.findUnique({
          where: { id },
          select: {
            stockQuantity: true,
          },
        });
  
        expect(record).toEqual({
          stockQuantity: initial,
        });
      } finally {
        await prisma.stockMovement.deleteMany({
          where: {
            productId: id,
          },
        });

        await prisma.product.deleteMany({
          where: { id },
        });
      }
    },
  );
  it.each([
    {
      title: 'к нулевому остатку',
      initial: 0,
      incoming: 5,
      expected: 5,
    },
    {
      title: 'к положительному остатку',
      initial: 10,
      incoming: 5,
      expected: 15,
    },
    {
      title: 'до максимального остатка',
      initial: 2_147_483_642,
      incoming: 5,
      expected: 2_147_483_647,
    },
  ])(
    'POST /products/:id/inventory/increase выполняет приход $title',
    async ({ initial, incoming, expected }) => {
      const id = randomUUID();
      const name = 'E2E HTTP приход';
  
      try {
        await prisma.product.create({
          data: {
            id,
            name,
            priceInKopecks: 199_900,
            stockQuantity: initial,
            slug: `e2e-${randomUUID()}`,
          },
        });
  
        const response = await request(app.getHttpServer())
          .post(`/products/${id}/inventory/increase`)
          .set('Idempotency-Key', randomUUID())
          .send({ quantity: incoming })
          .expect(204);
  
        expect(response.text).toBe('');
  
        const record = await prisma.product.findUnique({
          where: { id },
          select: {
            name: true,
            priceInKopecks: true,
            stockQuantity: true,
          },
        });
  
        expect(record).toEqual({
          name,
          priceInKopecks: 199_900,
          stockQuantity: expected,
        });
  
        const readResponse = await request(app.getHttpServer())
          .get(`/products/${id}`)
          .expect(200);
  
        expect(readResponse.body).toEqual({
          id,
          name,
          description: null,
          slug: expect.any(String),
          price: {
            amount: 199_900,
            currency: 'RUB',
          },
          inventory: {
            tracked: true,
            quantity: expected,
          },
          archivedAt: null,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        });
      } finally {
        await prisma.stockMovement.deleteMany({
          where: {
            productId: id,
          },
        });

        await prisma.product.deleteMany({
          where: { id },
        });
      }
    },
  );
  it.each([
    {
      title: 'отключённый учёт',
      quantity: null,
      expectedInventory: {
        tracked: false,
        quantity: null,
      },
    },
    {
      title: 'нулевой остаток',
      quantity: 0,
      expectedInventory: {
        tracked: true,
        quantity: 0,
      },
    },
    {
      title: 'положительный остаток',
      quantity: 10,
      expectedInventory: {
        tracked: true,
        quantity: 10,
      },
    },
  ])(
    'GET /products возвращает inventory: $title',
    async ({ quantity, expectedInventory }) => {
      const id = randomUUID();
      const name = 'E2E HTTP остатки в списке';
  
      try {
        await prisma.product.create({
          data: {
            id,
            name,
            priceInKopecks: null,
            stockQuantity: quantity,
            slug: `e2e-${randomUUID()}`,
          },
        });
  
        const offset = await prisma.product.count({
          where: {
            archivedAt: null,
            id: {
              lt: id,
            },
          },
        });
  
        const total = await prisma.product.count({
          where: {
            archivedAt: null,
          },
        });
  
        const response = await request(app.getHttpServer())
          .get('/products')
          .query({
            limit: 1,
            offset,
          })
          .expect(200);
  
        expect(response.body).toEqual({
          items: [
            {
              id,
              name,
              description: null,
              slug: expect.any(String),
              price: null,
              inventory: expectedInventory,
              archivedAt: null,
              createdAt: expect.any(String),
              updatedAt: expect.any(String),
            },
          ],
          total,
          limit: 1,
          offset,
        });
      } finally {
        await prisma.product.deleteMany({
          where: {
            id,
          },
        });
      }
    },
  );
  it.each([
    {
      title: 'отключённый учёт',
      quantity: null,
      expectedInventory: {
        tracked: false,
        quantity: null,
      },
    },
    {
      title: 'нулевой остаток',
      quantity: 0,
      expectedInventory: {
        tracked: true,
        quantity: 0,
      },
    },
    {
      title: 'положительный остаток',
      quantity: 10,
      expectedInventory: {
        tracked: true,
        quantity: 10,
      },
    },
  ])(
    'GET /products возвращает inventory: $title',
    async ({ quantity, expectedInventory }) => {
      const id = randomUUID();
      const name = 'E2E HTTP остатки в списке';
  
      try {
        await prisma.product.create({
          data: {
            id,
            name,
            priceInKopecks: null,
            stockQuantity: quantity,
            slug: `e2e-${randomUUID()}`,
          },
        });
  
        const offset = await prisma.product.count({
          where: {
            archivedAt: null,
            id: {
              lt: id,
            },
          },
        });
  
        const total = await prisma.product.count({
          where: {
            archivedAt: null,
          },
        });
  
        const response = await request(app.getHttpServer())
          .get('/products')
          .query({
            limit: 1,
            offset,
          })
          .expect(200);
  
        expect(response.body).toEqual({
          items: [
            {
              id,
              name,
              description: null,
              slug: expect.any(String),
              price: null,
              inventory: expectedInventory,
              archivedAt: null,
              createdAt: expect.any(String),
              updatedAt: expect.any(String),
            },
          ],
          total,
          limit: 1,
          offset,
        });
      } finally {
        await prisma.product.deleteMany({
          where: {
            id,
          },
        });
      }
    },
  );
  it.each([
    {
      title: 'отключённый учёт',
      quantity: null,
      expectedInventory: {
        tracked: false,
        quantity: null,
      },
    },
    {
      title: 'нулевой остаток',
      quantity: 0,
      expectedInventory: {
        tracked: true,
        quantity: 0,
      },
    },
    {
      title: 'положительный остаток',
      quantity: 10,
      expectedInventory: {
        tracked: true,
        quantity: 10,
      },
    },
  ])(
    'GET /products/:id возвращает inventory: $title',
    async ({ quantity, expectedInventory }) => {
      const id = randomUUID();
      const name = 'E2E HTTP чтение остатков';
  
      try {
        await prisma.product.create({
          data: {
            id,
            name,
            priceInKopecks: 199_900,
            stockQuantity: quantity,
            slug: `e2e-${randomUUID()}`,
          },
        });
  
        const response = await request(app.getHttpServer())
          .get(`/products/${id}`)
          .expect(200);
  
        expect(response.body).toEqual({
          id,
          name,
          description: null,
          slug: expect.any(String),
          price: {
            amount: 199_900,
            currency: 'RUB',
          },
          inventory: expectedInventory,
          archivedAt: null,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        });
      } finally {
        await prisma.product.deleteMany({
          where: {
            id,
          },
        });
      }
    },
  );
  it.each([
    {
      title: 'положительный остаток',
      quantity: 10,
    },
    {
      title: 'нулевой остаток',
      quantity: 0,
    },
    {
      title: 'уже отключённый учёт',
      quantity: null,
    },
  ])(
    'DELETE /products/:id/inventory отключает учёт: $title',
    async ({ quantity }) => {
      const id = randomUUID();
  
      try {
        await prisma.product.create({
          data: {
            id,
            name: 'E2E HTTP отключение учёта',
            slug: `e2e-${randomUUID()}`,
            priceInKopecks: 199_900,
            stockQuantity: quantity,
          },
        });
  
        const response = await request(app.getHttpServer())
          .delete(`/products/${id}/inventory`)
          .expect(204);
  
        expect(response.text).toBe('');
  
        const record = await prisma.product.findUnique({
          where: {
            id,
          },
          select: {
            name: true,
            priceInKopecks: true,
            stockQuantity: true,
          },
        });
  
        expect(record).toEqual({
          name: 'E2E HTTP отключение учёта',
          priceInKopecks: 199_900,
          stockQuantity: null,
        });
      } finally {
        await prisma.product.deleteMany({
          where: {
            id,
          },
        });
      }
    },
  );
  it.each([
    {
      title: 'количество отсутствует',
      body: {},
    },
    {
      title: 'количество равно null',
      body: { quantity: null },
    },
    {
      title: 'количество отрицательное',
      body: { quantity: -1 },
    },
    {
      title: 'количество дробное',
      body: { quantity: 1.5 },
    },
    {
      title: 'количество превышает максимум',
      body: { quantity: 2_147_483_648 },
    },
    {
      title: 'количество не является числом',
      body: { quantity: 'not-a-number' },
    },
  ])(
    'POST /products/:id/inventory возвращает 400: $title',
    async ({ body }) => {
      const id = randomUUID();
  
      try {
        await prisma.product.create({
          data: {
            id,
            name: 'E2E HTTP некорректное количество',
            slug: `e2e-${randomUUID()}`,
            stockQuantity: null,
          },
        });
  
        await request(app.getHttpServer())
          .post(`/products/${id}/inventory`)
          .send(body)
          .expect(400);
  
        const record = await prisma.product.findUnique({
          where: {
            id,
          },
          select: {
            stockQuantity: true,
          },
        });
  
        expect(record).toEqual({
          stockQuantity: null,
        });
      } finally {
        await prisma.product.deleteMany({
          where: {
            id,
          },
        });
      }
    },
  );
  it.each([0, 10, 2_147_483_647])(
    'POST /products/:id/inventory включает учёт с количеством %i',
    async (quantity) => {
      const id = randomUUID();
  
      try {
        await prisma.product.create({
          data: {
            id,
            name: 'E2E HTTP включение учёта',
            slug: `e2e-${randomUUID()}`,
            priceInKopecks: 199_900,
            stockQuantity: null,
          },
        });
  
        const response = await request(app.getHttpServer())
          .post(`/products/${id}/inventory`)
          .send({ quantity })
          .expect(204);
  
        expect(response.text).toBe('');
  
        const record = await prisma.product.findUnique({
          where: {
            id,
          },
          select: {
            name: true,
            priceInKopecks: true,
            stockQuantity: true,
          },
        });
  
        expect(record).toEqual({
          name: 'E2E HTTP включение учёта',
          priceInKopecks: 199_900,
          stockQuantity: quantity,
        });
      } finally {
        await prisma.product.deleteMany({
          where: {
            id,
          },
        });
      }
    },
  );
  it.each([
    {
      title: 'переименование',
      suffix: '',
      body: { name: 'Проектор Kubster' },
      expectedName: 'Проектор Kubster',
      expectedPrice: 199_900,
    },
    {
      title: 'изменение цены',
      suffix: '/price',
      body: { amount: 249_900 },
      expectedName: 'Проектор Epson',
      expectedPrice: 249_900,
    },
  ])(
    '$title не меняет остаток товара',
    async ({
      suffix,
      body,
      expectedName,
      expectedPrice,
    }) => {
      const id = randomUUID();
  
      try {
        await prisma.product.create({
          data: {
            id,
            name: 'Проектор Epson',
            slug: `e2e-${randomUUID()}`,
            priceInKopecks: 199_900,
            stockQuantity: 10,
          },
        });
  
        await request(app.getHttpServer())
          .patch(`/products/${id}${suffix}`)
          .send(body)
          .expect(200);
  
        const record = await prisma.product.findUnique({
          where: {
            id,
          },
          select: {
            id: true,
            name: true,
            priceInKopecks: true,
            stockQuantity: true,
          },
        });
  
        expect(record).toEqual({
          id,
          name: expectedName,
          priceInKopecks: expectedPrice,
          stockQuantity: 10,
        });
      } finally {
        await prisma.product.deleteMany({
          where: {
            id,
          },
        });
      }
    },
  );
  it.each([
    {
      title: 'отключённый учёт',
      quantity: null,
      tracked: false,
    },
    {
      title: 'нулевой остаток',
      quantity: 0,
      tracked: true,
    },
    {
      title: 'положительный остаток',
      quantity: 10,
      tracked: true,
    },
  ])(
    'репозиторий сохраняет и восстанавливает $title',
    async ({ quantity, tracked }) => {
      const repository = app.get<ProductRepository>(
        PRODUCT_REPOSITORY,
      );
  
      const id = randomUUID();
  
      const product = Product.restore(
        id,
        'E2E сохранение остатков',
        199_900,
        quantity,
      );
  
      try {
        await repository.add(product);
  
        const record = await prisma.product.findUnique({
          where: {
            id,
          },
        });
  
        expect(record).toMatchObject({
          id,
          stockQuantity: quantity,
        });
  
        const restoredProduct = await repository.findById(id);
  
        if (restoredProduct === null) {
          throw new Error('Сохранённый товар не найден');
        }
  
        expect(restoredProduct.inventoryTracked).toBe(tracked);
  
        if (quantity === null) {
          expect(restoredProduct.stockQuantity).toBeNull();
        } else {
          expect(restoredProduct.stockQuantity?.value)
            .toBe(quantity);
        }
      } finally {
        await prisma.product.deleteMany({
          where: {
            id,
          },
        });
      }
    },
  );
  it.each([
    {
      title: 'отрицательную цену',
      body: { amount: -1 },
    },
    {
      title: 'дробную цену',
      body: { amount: 10.5 },
    },
    {
      title: 'цену выше максимума',
      body: { amount: 2_147_483_648 },
    },
    {
      title: 'строку вместо числа',
      body: { amount: '199900' },
    },
    {
      title: 'null вместо цены',
      body: { amount: null },
    },
    {
      title: 'отсутствующее поле amount',
      body: {},
    },
    {
      title: 'лишнее поле currency',
      body: {
        amount: 249_900,
        currency: 'RUB',
      },
    },
  ])(
    'отклоняет $title и не меняет товар',
    async ({ body }) => {
      const id = randomUUID();
      const name = 'E2E защита прежней цены';
      const originalAmount = 199_900;
  
      try {
        await prisma.product.create({
          data: {
            id,
            name,
            priceInKopecks: originalAmount,
            slug: `e2e-${randomUUID()}`,
          },
        });
  
        await request(app.getHttpServer())
          .patch(`/products/${id}/price`)
          .send(body)
          .expect(400);
  
        const savedProduct = await prisma.product.findUnique({
          where: {
            id,
          },
          select: {
            id: true,
            name: true,
            priceInKopecks: true,
          },
        });
  
        expect(savedProduct).toEqual({
          id,
          name,
          priceInKopecks: originalAmount,
        });
      } finally {
        await prisma.product.deleteMany({
          where: {
            id,
          },
        });
      }
    },
  );
  it.each([
    {
      title: 'назначает первую цену через HTTP',
      previousAmount: null,
      amount: 199_900,
    },
    {
      title: 'изменяет существующую цену на ноль через HTTP',
      previousAmount: 199_900,
      amount: 0,
    },
  ])('$title', async ({ previousAmount, amount }) => {
    const id = randomUUID();
    const name = 'E2E изменение цены через HTTP';
  
    try {
      await prisma.product.create({
        data: {
          id,
          name,
          priceInKopecks: previousAmount,
          slug: `e2e-${randomUUID()}`,
        },
      });
  
      const response = await request(app.getHttpServer())
        .patch(`/products/${id}/price`)
        .send({ amount })
        .expect(200);
  
      const expectedProduct = {
        id,
        name,
        description: null,
        slug: expect.any(String),
        price: {
          amount,
          currency: 'RUB',
        },
        inventory: {
          tracked: false,
          quantity: null,
        },
        archivedAt: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      };
  
      expect(response.body).toEqual(expectedProduct);
  
      const savedProduct = await prisma.product.findUnique({
        where: {
          id,
        },
        select: {
          id: true,
          name: true,
          priceInKopecks: true,
        },
      });
  
      expect(savedProduct).toEqual({
        id,
        name,
        priceInKopecks: amount,
      });
  
      const getResponse = await request(app.getHttpServer())
        .get(`/products/${id}`)
        .expect(200);
  
      expect(getResponse.body).toEqual(expectedProduct);
    } finally {
      await prisma.product.deleteMany({
        where: {
          id,
        },
      });
    }
  });
  it.each([
    { title: 'ненулевую цену', amount: 199_900 },
    { title: 'нулевую цену', amount: 0 },
    { title: 'отсутствие цены', amount: null },
  ])('репозиторий сохраняет и восстанавливает $title', async ({ amount }) => {
    const repository = app.get<ProductRepository>(PRODUCT_REPOSITORY);
    const id = randomUUID();
  
    const product = Product.restore(
      id,
      'E2E сохранение цены',
      amount,
    );
  
    try {
      await repository.add(product);
  
      const record = await prisma.product.findUnique({
        where: {
          id,
        },
      });
  
      expect(record).toMatchObject({
        id,
        priceInKopecks: amount,
      });
  
      const restoredProduct = await repository.findById(id);
  
      expect(restoredProduct).not.toBeNull();
      expect(restoredProduct?.id).toBe(id);
  
      if (amount === null) {
        expect(restoredProduct?.price).toBeNull();
      } else {
        expect(restoredProduct?.price?.amount).toBe(amount);
        expect(restoredProduct?.price?.currency).toBe('RUB');
      }
    } finally {
      await prisma.product.deleteMany({
        where: {
          id,
        },
      });
    }
  });
  it.each([
    {
      title: 'название из пробелов',
      body: { name: '   ' },
    },
    {
      title: 'число вместо названия',
      body: { name: 123 },
    },
    {
      title: 'отсутствующее название',
      body: {},
    },
    {
      title: 'null вместо названия',
      body: { name: null },
    },
    {
      title: 'лишнее поле',
      body: {
        name: 'Проектор Kubster',
        stock: 100,
      },
    },
  ])(
    'отклоняет $title при переименовании и сохраняет прежние данные',
    async ({ body }) => {
      const id = randomUUID();
      const originalName = 'Проектор Epson';
  
      try {
        await prisma.product.create({
          data: {
            id,
            name: originalName,
            slug: `e2e-${randomUUID()}`,
          },
        });
  
        await request(app.getHttpServer())
          .patch(`/products/${id}`)
          .send(body)
          .expect(400);
  
        const savedProduct = await prisma.product.findUnique({
          where: {
            id,
          },
          select: {
            id: true,
            name: true,
          },
        });
  
        expect(savedProduct).toEqual({
          id,
          name: originalName,
        });
      } finally {
        await prisma.product.deleteMany({
          where: {
            id,
          },
        });
      }
    },
  );
  it.each([
    {
      title: 'нулевой limit',
      query: 'limit=0',
    },
    {
      title: 'limit больше максимального',
      query: 'limit=101',
    },
    {
      title: 'дробный limit',
      query: 'limit=1.5',
    },
    {
      title: 'строку вместо limit',
      query: 'limit=abc',
    },
    {
      title: 'отрицательный offset',
      query: 'offset=-1',
    },
    {
      title: 'пустой offset',
      query: 'offset=',
    },
    {
      title: 'offset за пределами безопасного целого',
      query: 'offset=9007199254740992',
    },
    {
      title: 'неизвестный параметр',
      query: 'unexpected=1',
    },
  ])('отклоняет $title', async ({ query }) => {
    const response = await request(app.getHttpServer())
      .get(`/products?${query}`)
      .expect(400);
  
    expect(response.body).toMatchObject({
      statusCode: 400,
    });
  });
  it.each([
    {
      title: 'название только из пробелов',
      body: { name: '   ' },
    },
    {
      title: 'число вместо названия',
      body: { name: 123 },
    },
    {
      title: 'отсутствующее название',
      body: {},
    },
    {
      title: 'лишнее поле',
      body: { name: 'Проектор Kubster', stock: 100 },
    },
  ])('отклоняет $title и не создаёт товар', async ({ body }) => {
    const countBefore = await prisma.product.count();

    await request(app.getHttpServer())
      .post('/products')
      .send(body)
      .expect(400);

    const countAfter = await prisma.product.count();

    expect(countAfter).toBe(countBefore);
  });
});
