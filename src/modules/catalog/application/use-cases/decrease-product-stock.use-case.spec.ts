import { describe, expect, it, vi } from 'vitest';

import { DecreaseProductStockUseCase } from
  './decrease-product-stock.use-case.js';

import type { StockMovementRepository } from
  '../ports/stock-movement.repository.js';

import type { ProductRepository } from
  '../ports/product.repository.js';

import { Product } from '../../domain/product.js';

import { StockMovementQuantity } from
  '../../domain/value-objects/stock-movement-quantity.js';

function createDependencies() {
  const movements = {
    increaseStockOnce:
      vi.fn<StockMovementRepository['increaseStockOnce']>(),

    decreaseStockOnce:
      vi.fn<StockMovementRepository['decreaseStockOnce']>(),
  } satisfies StockMovementRepository;

  const products = {
    findById: vi.fn<ProductRepository['findById']>(),
  } satisfies Pick<ProductRepository, 'findById'>;

  const useCase = new DecreaseProductStockUseCase(
    movements,
    products,
  );

  return {
    movements,
    products,
    useCase,
  };
}

function createInput() {
  return {
    idempotencyKey: '8acdf042-48bf-4aa5-bfb1-e457ad9dce09',
    productId: '6c3249f4-592e-48ea-aad4-fdf05a276b36',
    quantity: StockMovementQuantity.create(3),
  };
}

describe('DecreaseProductStockUseCase', () => {
  it.each([
    'applied',
    'replayed',
    'key-conflict',
  ] as const)(
    'возвращает %s без дополнительного чтения товара',
    async (repositoryResult) => {
      const {
        movements,
        products,
        useCase,
      } = createDependencies();

      const input = createInput();

      movements.decreaseStockOnce.mockResolvedValue(
        repositoryResult,
      );

      const result = await useCase.execute(input);

      expect(result).toBe(repositoryResult);

      expect(
        movements.decreaseStockOnce,
      ).toHaveBeenCalledTimes(1);

      expect(
        movements.decreaseStockOnce,
      ).toHaveBeenCalledWith(input);

      expect(products.findById).not.toHaveBeenCalled();

      expect(
        movements.increaseStockOnce,
      ).not.toHaveBeenCalled();
    },
  );

  it('сообщает об отсутствии товара после отказа', async () => {
    const {
      movements,
      products,
      useCase,
    } = createDependencies();

    const input = createInput();

    movements.decreaseStockOnce.mockResolvedValue('rejected');
    products.findById.mockResolvedValue(null);

    const result = await useCase.execute(input);

    expect(result).toBe('not-found');

    expect(products.findById).toHaveBeenCalledWith(
      input.productId,
    );
  });

  it('сообщает об отключённом учёте после отказа', async () => {
    const {
      movements,
      products,
      useCase,
    } = createDependencies();

    const input = createInput();

    movements.decreaseStockOnce.mockResolvedValue('rejected');

    products.findById.mockResolvedValue(
      Product.restore(
        input.productId,
        'Проектор Epson',
        199_900,
        null,
      ),
    );

    const result = await useCase.execute(input);

    expect(result).toBe('inventory-disabled');

    expect(
      movements.decreaseStockOnce,
    ).toHaveBeenCalledTimes(1);
  });

  it('сообщает о недостаточном остатке после отказа', async () => {
    const {
      movements,
      products,
      useCase,
    } = createDependencies();

    const input = createInput();

    movements.decreaseStockOnce.mockResolvedValue('rejected');

    products.findById.mockResolvedValue(
      Product.restore(
        input.productId,
        'Проектор Epson',
        199_900,
        2,
      ),
    );

    const result = await useCase.execute(input);

    expect(result).toBe('insufficient-stock');

    expect(
      movements.decreaseStockOnce,
    ).toHaveBeenCalledTimes(1);
  });

  it('передаёт ошибку транзакционной операции', async () => {
    const {
      movements,
      products,
      useCase,
    } = createDependencies();

    const error = new Error('Ошибка БД');

    movements.decreaseStockOnce.mockRejectedValue(error);

    await expect(
      useCase.execute(createInput()),
    ).rejects.toBe(error);

    expect(products.findById).not.toHaveBeenCalled();
  });

  it('передаёт ошибку уточняющего чтения', async () => {
    const {
      movements,
      products,
      useCase,
    } = createDependencies();

    const error = new Error('Ошибка чтения');

    movements.decreaseStockOnce.mockResolvedValue('rejected');
    products.findById.mockRejectedValue(error);

    await expect(
      useCase.execute(createInput()),
    ).rejects.toBe(error);
  });
});