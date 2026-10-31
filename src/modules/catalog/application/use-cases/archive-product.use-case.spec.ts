import { describe, expect, it, vi } from 'vitest';

import type { ProductRepository } from '../ports/product.repository.js';
import { ArchiveProductUseCase } from './archive-product.use-case.js';

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

describe('ArchiveProductUseCase', () => {
  it.each([
    'archived',
    'replayed',
    'not-found',
  ] as const)(
    'возвращает результат репозитория: %s',
    async (repositoryResult) => {
      const repository = createRepositoryMock();
      repository.archiveById.mockResolvedValue(repositoryResult);

      const useCase = new ArchiveProductUseCase(repository);

      const result = await useCase.execute({
        id: productId,
      });

      expect(result).toBe(repositoryResult);
      expect(repository.archiveById)
        .toHaveBeenCalledExactlyOnceWith(productId);
    },
  );

  it('передаёт ошибку архивации вызывающему коду', async () => {
    const storageError = new Error('Ошибка архивации');
    const repository = createRepositoryMock();

    repository.archiveById.mockRejectedValue(storageError);

    const useCase = new ArchiveProductUseCase(repository);

    await expect(
      useCase.execute({
        id: productId,
      }),
    ).rejects.toBe(storageError);
  });
});
