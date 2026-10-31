import { describe, expect, it, vi } from 'vitest';

import { Product } from '../../domain/product.js';
import type { ProductRepository } from '../ports/product.repository.js';
import { GetProductByIdUseCase } from './get-product-by-id.use-case.js';

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

describe('GetProductByIdUseCase', () => {
  it('возвращает данные найденного товара', async () => {
    const id = '6c3249f4-592e-48ea-aad4-fdf05a276b36';
    const product = Product.restore(id, 'Проектор Epson');

    const repository = createRepositoryMock();
    repository.findById.mockResolvedValue(product);

    const useCase = new GetProductByIdUseCase(repository);

    const result = await useCase.execute({ id });

    expect(result).toEqual({
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
    });

    expect(repository.findById).toHaveBeenCalledExactlyOnceWith(id);
    expect(repository.add).not.toHaveBeenCalled();
  });

  it('возвращает null, если товар не найден', async () => {
    const id = '6c3249f4-592e-48ea-aad4-fdf05a276b36';

    const repository = createRepositoryMock();
    repository.findById.mockResolvedValue(null);

    const useCase = new GetProductByIdUseCase(repository);

    const result = await useCase.execute({ id });

    expect(result).toBeNull();
    expect(repository.findById).toHaveBeenCalledExactlyOnceWith(id);
    expect(repository.add).not.toHaveBeenCalled();
  });

  it('передаёт ошибку чтения вызывающему коду', async () => {
    const storageError = new Error('Хранилище недоступно');

    const repository = createRepositoryMock();
    repository.findById.mockRejectedValue(storageError);

    const useCase = new GetProductByIdUseCase(repository);

    await expect(
      useCase.execute({
        id: '6c3249f4-592e-48ea-aad4-fdf05a276b36',
      }),
    ).rejects.toBe(storageError);
  });
});