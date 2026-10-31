import { describe, expect, it, vi } from 'vitest';

import { EnableProductInventoryTrackingUseCase } from
  './enable-product-inventory-tracking.use-case.js';

import { Product } from '../../domain/product.js';

import { StockQuantity } from
  '../../domain/value-objects/stock-quantity.js';

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

describe('EnableProductInventoryTrackingUseCase', () => {
  it('включает учёт с переданным количеством', async () => {
    const repository = createRepositoryMock();

    repository.enableInventoryTracking.mockResolvedValue(true);

    const useCase =
      new EnableProductInventoryTrackingUseCase(repository);

    const quantity = StockQuantity.create(10);

    const result = await useCase.execute({
      id: 'product-1',
      quantity,
    });

    expect(result).toBe('enabled');

    expect(
      repository.enableInventoryTracking,
    ).toHaveBeenCalledExactlyOnceWith(
      'product-1',
      quantity,
    );

    expect(repository.findById).not.toHaveBeenCalled();
  });

  it('сообщает об отсутствии товара', async () => {
    const repository = createRepositoryMock();

    repository.enableInventoryTracking.mockResolvedValue(false);
    repository.findById.mockResolvedValue(null);

    const useCase =
      new EnableProductInventoryTrackingUseCase(repository);

    const result = await useCase.execute({
      id: 'missing-product',
      quantity: StockQuantity.create(0),
    });

    expect(result).toBe('not-found');

    expect(repository.findById).toHaveBeenCalledWith(
      'missing-product',
    );
  });

  it('сообщает, что учёт уже включён', async () => {
    const repository = createRepositoryMock();

    const product = Product.restore(
      'product-1',
      'Проектор Epson',
      199_900,
      10,
    );

    repository.enableInventoryTracking.mockResolvedValue(false);
    repository.findById.mockResolvedValue(product);

    const useCase =
      new EnableProductInventoryTrackingUseCase(repository);

    const result = await useCase.execute({
      id: 'product-1',
      quantity: StockQuantity.create(0),
    });

    expect(result).toBe('already-tracked');

    expect(
      repository.enableInventoryTracking,
    ).toHaveBeenCalledTimes(1);

    expect(repository.update).not.toHaveBeenCalled();
  });
});