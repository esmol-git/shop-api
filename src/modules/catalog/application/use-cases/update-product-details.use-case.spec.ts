import { describe, expect, it, vi } from 'vitest';

import { Product } from '../../domain/product.js';
import type { ProductRepository } from '../ports/product.repository.js';
import { UpdateProductDetailsUseCase } from
  './update-product-details.use-case.js';

function createRepositoryMock() {
  return {
    add: vi.fn<ProductRepository['add']>(),
    findById: vi.fn<ProductRepository['findById']>(),
    findPage: vi.fn<ProductRepository['findPage']>(),
    update: vi.fn<ProductRepository['update']>(),
    deleteById: vi.fn<ProductRepository['deleteById']>(),
    archiveById: vi.fn<ProductRepository['archiveById']>(),
    enableInventoryTracking:
      vi.fn<ProductRepository['enableInventoryTracking']>(),
    disableInventoryTracking:
      vi.fn<ProductRepository['disableInventoryTracking']>(),
  } satisfies ProductRepository;
}

const productId = '6c3249f4-592e-48ea-aad4-fdf05a276b36';

describe('UpdateProductDetailsUseCase', () => {
  it('обновляет description и slug', async () => {
    const product = Product.restore(
      productId,
      'Проектор Epson',
      null,
      null,
      null,
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-01-01T00:00:00.000Z'),
      null,
      'proektor-epson',
    );

    const repository = createRepositoryMock();
    repository.findById.mockResolvedValue(product);
    repository.update.mockResolvedValue('updated');

    const useCase = new UpdateProductDetailsUseCase(repository);

    const result = await useCase.execute({
      id: productId,
      description: 'Новое описание',
      slug: 'epson-v2',
    });

    expect(result).toMatchObject({
      status: 'updated',
      product: {
        id: productId,
        description: 'Новое описание',
        slug: 'epson-v2',
      },
    });
  });

  it('пустое тело возвращает текущий товар без update', async () => {
    const product = Product.restore(
      productId,
      'Проектор Epson',
      null,
      null,
      null,
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-01-01T00:00:00.000Z'),
      null,
      'proektor-epson',
    );

    const repository = createRepositoryMock();
    repository.findById.mockResolvedValue(product);

    const useCase = new UpdateProductDetailsUseCase(repository);

    const result = await useCase.execute({ id: productId });

    expect(result).toMatchObject({
      status: 'updated',
      product: {
        id: productId,
        description: null,
        slug: 'proektor-epson',
      },
    });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('тот же slug — успешный no-op через update', async () => {
    const product = Product.restore(
      productId,
      'Проектор Epson',
      null,
      null,
      null,
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-01-01T00:00:00.000Z'),
      'Старое',
      'proektor-epson',
    );

    const repository = createRepositoryMock();
    repository.findById.mockResolvedValue(product);
    repository.update.mockResolvedValue('updated');

    const useCase = new UpdateProductDetailsUseCase(repository);

    const result = await useCase.execute({
      id: productId,
      slug: 'proektor-epson',
    });

    expect(result).toMatchObject({
      status: 'updated',
      product: {
        slug: 'proektor-epson',
        description: 'Старое',
      },
    });
    expect(repository.update).toHaveBeenCalledOnce();
  });

  it('возвращает not-found', async () => {
    const repository = createRepositoryMock();
    repository.findById.mockResolvedValue(null);

    const useCase = new UpdateProductDetailsUseCase(repository);

    const result = await useCase.execute({
      id: productId,
      slug: 'x',
    });

    expect(result).toEqual({ status: 'not-found' });
  });

  it('возвращает slug-taken', async () => {
    const product = Product.restore(
      productId,
      'Проектор Epson',
      null,
      null,
      null,
      new Date(),
      new Date(),
      null,
      'old-slug',
    );

    const repository = createRepositoryMock();
    repository.findById.mockResolvedValue(product);
    repository.update.mockResolvedValue('slug-taken');

    const useCase = new UpdateProductDetailsUseCase(repository);

    const result = await useCase.execute({
      id: productId,
      slug: 'taken',
    });

    expect(result).toEqual({ status: 'slug-taken' });
  });
});
