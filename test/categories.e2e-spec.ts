import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';
import { PrismaService } from
  '../src/infrastructure/database/prisma/prisma.service.js';
import { CATEGORY_MAX_DEPTH } from
  '../src/modules/catalog/domain/category-max-depth.js';

describe('Categories (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const runId = randomUUID().slice(0, 8);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  function slug(label: string): string {
    return `e2e-${label}-${runId}`;
  }

  /** Уникальный slug ровно `length` символов [a-z0-9]. */
  function slugOfLength(length: number): string {
    const seed = runId.replaceAll('-', '');
    if (length === 1) {
      // Один символ не вмещает runId — берём редкий и чистим перед созданием.
      return 'q';
    }

    const body = `${seed}${'x'.repeat(length)}`.slice(0, length);

    return body;
  }

  async function cleanupBySlugs(slugs: string[]): Promise<void> {
    const unique = [...new Set(slugs.filter(Boolean))];

    for (let pass = 0; pass < CATEGORY_MAX_DEPTH + 2; pass += 1) {
      await prisma.category.deleteMany({
        where: {
          slug: { in: unique },
          children: { none: {} },
        },
      });
    }

    expect(
      await prisma.category.count({
        where: { slug: { in: unique } },
      }),
    ).toBe(0);
  }

  it('создаёт корень и дочерние до 4 уровней; 5-й отклоняет без записи', async () => {
    const slugs = [
      slug('l1'),
      slug('l2'),
      slug('l3'),
      slug('l4'),
      slug('l5'),
    ];

    try {
      const l1 = await request(app.getHttpServer())
        .post('/categories')
        .send({ name: 'E2E L1', slug: slugs[0] })
        .expect(201);

      const l2 = await request(app.getHttpServer())
        .post('/categories')
        .send({
          name: 'E2E L2',
          slug: slugs[1],
          parentId: l1.body.id,
        })
        .expect(201);

      const l3 = await request(app.getHttpServer())
        .post('/categories')
        .send({
          name: 'E2E L3',
          slug: slugs[2],
          parentId: l2.body.id,
        })
        .expect(201);

      const l4 = await request(app.getHttpServer())
        .post('/categories')
        .send({
          name: 'E2E L4',
          slug: slugs[3],
          parentId: l3.body.id,
        })
        .expect(201);

      expect(l4.body.parentId).toBe(l3.body.id);

      await request(app.getHttpServer())
        .post('/categories')
        .send({
          name: 'E2E L5',
          slug: slugs[4],
          parentId: l4.body.id,
        })
        .expect(409);

      expect(
        await prisma.category.findUnique({ where: { slug: slugs[4] } }),
      ).toBeNull();
    } finally {
      await cleanupBySlugs(slugs);
    }
  });

  it('parentId omitted и null дают корень; невалидный UUID — 400', async () => {
    const omittedSlug = slug('root-omit');
    const nullSlug = slug('root-null');
    const badSlug = slug('bad-parent');

    try {
      const omitted = await request(app.getHttpServer())
        .post('/categories')
        .send({ name: 'Корень omit', slug: omittedSlug })
        .expect(201);

      expect(omitted.body.parentId).toBeNull();

      const withNull = await request(app.getHttpServer())
        .post('/categories')
        .send({
          name: 'Корень null',
          slug: nullSlug,
          parentId: null,
        })
        .expect(201);

      expect(withNull.body.parentId).toBeNull();

      await request(app.getHttpServer())
        .post('/categories')
        .send({
          name: 'Плохой parent',
          slug: badSlug,
          parentId: 'not-a-uuid',
        })
        .expect(400);

      expect(
        await prisma.category.findUnique({ where: { slug: badSlug } }),
      ).toBeNull();
    } finally {
      await cleanupBySlugs([omittedSlug, nullSlug, badSlug]);
    }
  });

  it('slug: нормализация, границы, обязательность', async () => {
    const expectedNorm = `kessony-${runId}`;
    const len1 = slugOfLength(1);
    const len100 = slugOfLength(100);
    const len101 = `${len100}x`;
    const name200 = slug('name-200');
    const name201 = slug('name-201');
    const tracked = [expectedNorm, len1, len100, name200];

    try {
      await prisma.category.deleteMany({ where: { slug: len1 } });

      const fromUpper = await request(app.getHttpServer())
        .post('/categories')
        .send({ name: 'Norm', slug: `  KESSONY-${runId}  ` })
        .expect(201);

      expect(fromUpper.body.slug).toBe(expectedNorm);

      await request(app.getHttpServer())
        .post('/categories')
        .send({ name: 'Dup', slug: expectedNorm })
        .expect(409);

      expect(
        await prisma.category.count({ where: { slug: expectedNorm } }),
      ).toBe(1);

      await request(app.getHttpServer())
        .post('/categories')
        .send({ name: 'Len1', slug: len1 })
        .expect(201);

      await request(app.getHttpServer())
        .post('/categories')
        .send({ name: 'Len100', slug: len100 })
        .expect(201);

      await request(app.getHttpServer())
        .post('/categories')
        .send({ name: 'Len101', slug: len101 })
        .expect(400);

      await request(app.getHttpServer())
        .post('/categories')
        .send({ name: 'Space', slug: 'bad slug' })
        .expect(400);

      await request(app.getHttpServer())
        .post('/categories')
        .send({ name: 'No slug field' })
        .expect(400);

      await request(app.getHttpServer())
        .post('/categories')
        .send({ name: 'Null slug', slug: null })
        .expect(400);

      await request(app.getHttpServer())
        .post('/categories')
        .send({ name: 'Empty slug', slug: '' })
        .expect(400);

      await request(app.getHttpServer())
        .post('/categories')
        .send({ name: 'а'.repeat(200), slug: name200 })
        .expect(201);

      await request(app.getHttpServer())
        .post('/categories')
        .send({ name: 'а'.repeat(201), slug: name201 })
        .expect(400);

      expect(
        await prisma.category.findUnique({ where: { slug: name201 } }),
      ).toBeNull();
    } finally {
      await cleanupBySlugs(tracked);
    }
  });

  it('возвращает 404 для отсутствующего родителя и не пишет строку', async () => {
    const orphanSlug = slug('missing-parent');

    try {
      const response = await request(app.getHttpServer())
        .post('/categories')
        .send({
          name: 'Сирота',
          slug: orphanSlug,
          parentId: randomUUID(),
        })
        .expect(404);

      expect(response.body).toMatchObject({
        statusCode: 404,
        message: 'Родительская категория не найдена',
      });
      expect(response.body).not.toHaveProperty('meta');
      expect(JSON.stringify(response.body)).not.toMatch(/SELECT|INSERT|prisma/i);

      expect(
        await prisma.category.findUnique({ where: { slug: orphanSlug } }),
      ).toBeNull();
    } finally {
      await cleanupBySlugs([orphanSlug]);
    }
  });

  it('отклоняет неверные типы и лишние поля без записи', async () => {
    const badSlug = slug('bad-body');

    try {
      await request(app.getHttpServer())
        .post('/categories')
        .send({ name: 123, slug: badSlug })
        .expect(400);
      expect(
        await prisma.category.findUnique({ where: { slug: badSlug } }),
      ).toBeNull();

      await request(app.getHttpServer())
        .post('/categories')
        .send({ name: 'Ok', slug: ['array'] })
        .expect(400);

      await request(app.getHttpServer())
        .post('/categories')
        .send({
          name: 'Ok',
          slug: slug('extra'),
          extra: true,
        })
        .expect(400);
      expect(
        await prisma.category.findUnique({ where: { slug: slug('extra') } }),
      ).toBeNull();

      await request(app.getHttpServer())
        .post('/categories')
        .send({
          name: 'Ok',
          slug: badSlug,
          parentId: {},
        })
        .expect(400);
      expect(
        await prisma.category.findUnique({ where: { slug: badSlug } }),
      ).toBeNull();
    } finally {
      await cleanupBySlugs([badSlug, slug('extra')]);
    }
  });

  it('конфликт slug: последовательный и параллельный', async () => {
    const takenSlug = slug('slug-taken');
    const raceSlug = slug('slug-race');

    try {
      await request(app.getHttpServer())
        .post('/categories')
        .send({ name: 'Первая', slug: takenSlug })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post('/categories')
        .send({ name: 'Вторая', slug: takenSlug })
        .expect(409);

      expect(response.body).toMatchObject({
        statusCode: 409,
        message: 'Slug уже занят',
      });
      expect(
        await prisma.category.count({ where: { slug: takenSlug } }),
      ).toBe(1);

      const [first, second] = await Promise.all([
        request(app.getHttpServer())
          .post('/categories')
          .send({ name: 'Race A', slug: raceSlug }),
        request(app.getHttpServer())
          .post('/categories')
          .send({ name: 'Race B', slug: raceSlug }),
      ]);

      const statuses = [first.status, second.status].sort();
      expect(statuses).toEqual([201, 409]);
      expect(
        await prisma.category.count({ where: { slug: raceSlug } }),
      ).toBe(1);
    } finally {
      await cleanupBySlugs([takenSlug, raceSlug]);
    }
  });

  it('CHECK запрещает self-parent на уровне БД', async () => {
    const id = randomUUID();
    const selfSlug = slug('self-parent');

    try {
      await expect(
        prisma.$executeRawUnsafe(
          `INSERT INTO categories (id, name, slug, "parentId", "createdAt", "updatedAt")
           VALUES ($1::uuid, $2, $3, $1::uuid, NOW(), NOW())`,
          id,
          'Self parent',
          selfSlug,
        ),
      ).rejects.toThrow(/categories_parent_not_self_check|check constraint/i);

      expect(
        await prisma.category.findUnique({ where: { id } }),
      ).toBeNull();
    } finally {
      await cleanupBySlugs([selfSlug]);
    }
  });

  it('GET /categories/tree не обрабатывается как :id; GET missing → 404', async () => {
    const response = await request(app.getHttpServer())
      .get('/categories/tree')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);

    await request(app.getHttpServer())
      .get('/categories/not-a-uuid')
      .expect(400);

    await request(app.getHttpServer())
      .get(`/categories/${randomUUID()}`)
      .expect(404);
  });

  it('дерево: корни, дети, одинаковые имена-соседи, порядок; PATCH', async () => {
    const rootB = slug('order-b');
    const rootA = slug('order-a');
    const child1 = slug('order-c1');
    const child2 = slug('order-c2');
    const twinOlder = slug('twin-older');
    const twinNewer = slug('twin-newer');
    const sameName = 'E2E Twin Name';

    try {
      await request(app.getHttpServer())
        .post('/categories')
        .send({ name: 'E2E Order B', slug: rootB })
        .expect(201);

      const createdA = await request(app.getHttpServer())
        .post('/categories')
        .send({ name: 'E2E Order A', slug: rootA })
        .expect(201);

      await request(app.getHttpServer())
        .post('/categories')
        .send({
          name: 'E2E Order Child B',
          slug: child2,
          parentId: createdA.body.id,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/categories')
        .send({
          name: 'E2E Order Child A',
          slug: child1,
          parentId: createdA.body.id,
        })
        .expect(201);

      const twinFirst = await request(app.getHttpServer())
        .post('/categories')
        .send({
          name: sameName,
          slug: twinOlder,
          parentId: createdA.body.id,
        })
        .expect(201);

      const twinSecond = await request(app.getHttpServer())
        .post('/categories')
        .send({
          name: sameName,
          slug: twinNewer,
          parentId: createdA.body.id,
        })
        .expect(201);

      const list = await request(app.getHttpServer())
        .get('/categories')
        .expect(200);

      const twinsInList = list.body.filter(
        (item: { name: string }) => item.name === sameName,
      );
      expect(twinsInList.map((item: { id: string }) => item.id)).toEqual(
        [twinFirst.body.id, twinSecond.body.id].sort(),
      );

      const tree = await request(app.getHttpServer())
        .get('/categories/tree')
        .expect(200);

      const roots = tree.body.filter((item: { slug: string }) =>
        [rootA, rootB].includes(item.slug),
      );

      expect(roots.map((item: { slug: string }) => item.slug)).toEqual([
        rootA,
        rootB,
      ]);

      const children = roots[0].children as Array<{
        id: string;
        slug: string;
        name: string;
        children: unknown[];
      }>;

      // name ASC, id ASC среди детей A
      expect(children.map((c) => c.slug)).toEqual([
        child1,
        child2,
        ...[twinFirst.body.id, twinSecond.body.id]
          .sort()
          .map((id) =>
            id === twinFirst.body.id ? twinOlder : twinNewer,
          ),
      ]);

      const twinNeighbours = children.filter((c) => c.name === sameName);
      expect(twinNeighbours.map((c) => c.id)).toEqual(
        [twinFirst.body.id, twinSecond.body.id].sort(),
      );
      expect(twinNeighbours.every((c) => c.children.length === 0)).toBe(true);

      const ids = new Set<string>();
      const walk = (nodes: Array<{ id: string; children: unknown[] }>) => {
        for (const node of nodes) {
          expect(ids.has(node.id)).toBe(false);
          ids.add(node.id);
          walk(node.children as Array<{ id: string; children: unknown[] }>);
        }
      };
      walk(roots);
      expect(ids.size).toBe(6);

      const before = await prisma.category.findUnique({
        where: { id: createdA.body.id },
      });

      await request(app.getHttpServer())
        .patch(`/categories/${createdA.body.id}`)
        .send({})
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/categories/${createdA.body.id}`)
        .send({ name: '  E2E Order A  ' })
        .expect(200);

      const afterNoop = await prisma.category.findUnique({
        where: { id: createdA.body.id },
      });
      expect(afterNoop!.updatedAt.toISOString()).toBe(
        before!.updatedAt.toISOString(),
      );

      await request(app.getHttpServer())
        .patch(`/categories/${createdA.body.id}`)
        .send({ name: null })
        .expect(400);

      await request(app.getHttpServer())
        .patch(`/categories/${createdA.body.id}`)
        .send({ name: '' })
        .expect(400);

      await request(app.getHttpServer())
        .patch(`/categories/${createdA.body.id}`)
        .send({ name: '   ' })
        .expect(400);

      await request(app.getHttpServer())
        .patch(`/categories/${createdA.body.id}`)
        .send({ name: 'Ok', slug: 'hacked' })
        .expect(400);

      await request(app.getHttpServer())
        .patch(`/categories/${createdA.body.id}`)
        .send({ name: 'Ok', parentId: randomUUID() })
        .expect(400);

      await request(app.getHttpServer())
        .patch(`/categories/${createdA.body.id}`)
        .send({ name: 'Ok', id: randomUUID() })
        .expect(400);

      await request(app.getHttpServer())
        .patch(`/categories/${createdA.body.id}`)
        .send({
          name: 'Ok',
          createdAt: '2020-01-01T00:00:00.000Z',
        })
        .expect(400);

      await request(app.getHttpServer())
        .patch(`/categories/${createdA.body.id}`)
        .send({
          name: 'Ok',
          updatedAt: '2020-01-01T00:00:00.000Z',
        })
        .expect(400);

      await request(app.getHttpServer())
        .patch(`/categories/${randomUUID()}`)
        .send({})
        .expect(404);

      await new Promise((resolve) => setTimeout(resolve, 20));

      const renamed = await request(app.getHttpServer())
        .patch(`/categories/${createdA.body.id}`)
        .send({ name: '  E2E Renamed A  ' })
        .expect(200);

      const after = await prisma.category.findUnique({
        where: { id: createdA.body.id },
      });

      expect(renamed.body).toEqual({
        id: createdA.body.id,
        name: 'E2E Renamed A',
        slug: rootA,
        parentId: null,
        createdAt: createdA.body.createdAt,
        updatedAt: after!.updatedAt.toISOString(),
      });
      expect(after!.updatedAt.getTime()).toBeGreaterThan(
        before!.updatedAt.getTime(),
      );
    } finally {
      await cleanupBySlugs([
        child1,
        child2,
        twinOlder,
        twinNewer,
        rootA,
        rootB,
      ]);
    }
  });

  it('не ломает создание товара (регресс каталога)', async () => {
    const name = `E2E регресс после категорий ${runId}`;

    try {
      const response = await request(app.getHttpServer())
        .post('/products')
        .send({ name })
        .expect(201);

      expect(response.body).toMatchObject({
        name,
        description: null,
        slug: expect.any(String),
      });
    } finally {
      await prisma.product.deleteMany({ where: { name } });
    }
  });
});
