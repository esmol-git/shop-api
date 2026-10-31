import { Test, TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';

import { PrismaService } from
  '../src/infrastructure/database/prisma/prisma.service.js';

  import { configureApp } from '../src/configure-app.js';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    configureApp(app);
    
    await app.init();
  });

  it('подключается к тестовой базе', async () => {
    const prisma = app.get(PrismaService);
  
    const rows = await prisma.$queryRaw<
      Array<{ database: string }>
    >`SELECT current_database() AS database`;
  
    expect(rows).toEqual([{ database: 'shop_test' }]);
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  afterEach(async () => {
    await app.close();
  });
});
