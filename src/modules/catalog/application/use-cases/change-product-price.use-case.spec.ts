import { describe, expect, it, vi } from 'vitest';

import { Product } from '../../domain/product.js';
import type { ProductRepository } from '../ports/product.repository.js';
import { ChangeProductPriceUseCase } from './change-product-price.use-case.js';
  '../../domain/value-objects/stock-quantity.js';

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

describe('ChangeProductPriceUseCase', () => {
  it.each([
    {
      title: 'назначает первую цену',
      previousAmount: null,
      amount: 199_900,
    },
    {
      title: 'изменяет существующую цену на ноль',
      previousAmount: 199_900,
      amount: 0,
    },
  ])('$title', async ({ previousAmount, amount }) => {
    const product = Product.restore(
      productId,
      'Проектор Epson',
      previousAmount,
    );

    const repository = createRepositoryMock();
    repository.findById.mockResolvedValue(product);
    repository.update.mockResolvedValue('updated');

    const useCase = new ChangeProductPriceUseCase(repository);

    const result = await useCase.execute({
      id: productId,
      amount,
    });

    expect(result).toEqual({
      id: productId,
      name: 'Проектор Epson',
      description: null,
      slug: 'product-6c3249f4',
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
    });

    expect(product.price?.amount).toBe(amount);

    expect(repository.findById)
      .toHaveBeenCalledExactlyOnceWith(productId);

    expect(repository.update)
      .toHaveBeenCalledExactlyOnceWith(product);

    expect(repository.add).not.toHaveBeenCalled();
    expect(repository.deleteById).not.toHaveBeenCalled();
  });

  it('возвращает null и не сохраняет, если товар не найден', async () => {
    const repository = createRepositoryMock();
    repository.findById.mockResolvedValue(null);

    const useCase = new ChangeProductPriceUseCase(repository);

    const result = await useCase.execute({
      id: productId,
      amount: 199_900,
    });

    expect(result).toBeNull();
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('не сохраняет товар при недопустимой цене', async () => {
    const product = Product.restore(
      productId,
      'Проектор Epson',
      199_900,
    );

    const repository = createRepositoryMock();
    repository.findById.mockResolvedValue(product);

    const useCase = new ChangeProductPriceUseCase(repository);

    await expect(
      useCase.execute({
        id: productId,
        amount: -1,
      }),
    ).rejects.toThrow('Цена не может быть отрицательной');

    expect(product.price?.amount).toBe(199_900);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('возвращает null, если товар исчез до обновления', async () => {
    const product = Product.restore(
      productId,
      'Проектор Epson',
      null,
    );

    const repository = createRepositoryMock();
    repository.findById.mockResolvedValue(product);
    repository.update.mockResolvedValue('not-found');

    const useCase = new ChangeProductPriceUseCase(repository);

    const result = await useCase.execute({
      id: productId,
      amount: 199_900,
    });

    expect(result).toBeNull();

    expect(repository.update)
      .toHaveBeenCalledExactlyOnceWith(product);
  });

  it('передаёт ошибку чтения вызывающему коду', async () => {
    const storageError = new Error('Ошибка чтения');
    const repository = createRepositoryMock();

    repository.findById.mockRejectedValue(storageError);

    const useCase = new ChangeProductPriceUseCase(repository);

    await expect(
      useCase.execute({
        id: productId,
        amount: 199_900,
      }),
    ).rejects.toBe(storageError);

    expect(repository.update).not.toHaveBeenCalled();
  });

  it('передаёт ошибку обновления вызывающему коду', async () => {
    const product = Product.restore(
      productId,
      'Проектор Epson',
      null,
    );

    const storageError = new Error('Ошибка обновления');
    const repository = createRepositoryMock();

    repository.findById.mockResolvedValue(product);
    repository.update.mockRejectedValue(storageError);

    const useCase = new ChangeProductPriceUseCase(repository);

    await expect(
      useCase.execute({
        id: productId,
        amount: 199_900,
      }),
    ).rejects.toBe(storageError);
  });
});