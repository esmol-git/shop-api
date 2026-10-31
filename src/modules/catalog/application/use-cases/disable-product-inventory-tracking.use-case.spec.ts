import { describe, expect, it, vi } from 'vitest';

import { DisableProductInventoryTrackingUseCase } from
  './disable-product-inventory-tracking.use-case.js';
import type { ProductRepository } from
  '../ports/product.repository.js';

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

describe('DisableProductInventoryTrackingUseCase', () => {
  it('отключает учёт для товара', async () => {
    const repository = createRepositoryMock();

    repository.disableInventoryTracking.mockResolvedValue(true);

    const useCase =
      new DisableProductInventoryTrackingUseCase(repository);

    const result = await useCase.execute({
      id: 'product-1',
    });

    expect(result).toBe(true);
    expect(repository.disableInventoryTracking).toHaveBeenCalledWith(
      'product-1',
    );
  });

  it('возвращает false, если товар не найден', async () => {
    const repository = createRepositoryMock();

    repository.disableInventoryTracking.mockResolvedValue(false);

    const useCase =
      new DisableProductInventoryTrackingUseCase(repository);

    const result = await useCase.execute({
      id: 'missing-product',
    });

    expect(result).toBe(false);
  });
});