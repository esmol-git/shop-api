import { describe, expect, it, vi } from 'vitest';

import { Product } from '../../domain/product.js';
import type { ProductRepository } from '../ports/product.repository.js';
import { ListProductsUseCase } from './list-products.use-case.js';

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

describe('ListProductsUseCase', () => {
  it('возвращает товары, total и параметры страницы', async () => {
    const id = '6c3249f4-592e-48ea-aad4-fdf05a276b36';
    const product = Product.restore(id, 'Проектор Epson');

    const repository = createRepositoryMock();

    repository.findPage.mockResolvedValue({
      items: [product],
      total: 41,
    });

    const useCase = new ListProductsUseCase(repository);

    const result = await useCase.execute({
      limit: 20,
      offset: 40,
    });

    expect(result).toEqual({
      items: [
        {
          id,
          name: 'Проектор Epson',
          description: null,
          slug: 'product-6c3249f4',
          price: null,
          inventory: {
            tracked: false,
            quantity: null,
          },
          archivedAt: null,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      ],
      total: 41,
      limit: 20,
      offset: 40,
    });

    expect(repository.findPage).toHaveBeenCalledExactlyOnceWith({
      limit: 20,
      offset: 40,
    });

    expect(repository.add).not.toHaveBeenCalled();
    expect(repository.findById).not.toHaveBeenCalled();
  });

  it('возвращает пустой список для пустого каталога', async () => {
    const repository = createRepositoryMock();

    repository.findPage.mockResolvedValue({
      items: [],
      total: 0,
    });

    const useCase = new ListProductsUseCase(repository);

    const result = await useCase.execute({
      limit: 20,
      offset: 0,
    });

    expect(result).toEqual({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    });
  });

  it('сохраняет total, если страница за пределами списка', async () => {
    const repository = createRepositoryMock();

    repository.findPage.mockResolvedValue({
      items: [],
      total: 3,
    });

    const useCase = new ListProductsUseCase(repository);

    const result = await useCase.execute({
      limit: 20,
      offset: 100,
    });

    expect(result).toEqual({
      items: [],
      total: 3,
      limit: 20,
      offset: 100,
    });
  });

  it('передаёт ошибку чтения вызывающему коду', async () => {
    const storageError = new Error('Хранилище недоступно');

    const repository = createRepositoryMock();
    repository.findPage.mockRejectedValue(storageError);

    const useCase = new ListProductsUseCase(repository);

    await expect(
      useCase.execute({
        limit: 20,
        offset: 0,
      }),
    ).rejects.toBe(storageError);
  });
});