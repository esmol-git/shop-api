import { describe, expect, it, vi } from 'vitest';

import { Category } from '../../domain/category.js';
import type { CategoryRepository } from '../ports/category.repository.js';
import { RenameCategoryUseCase } from './rename-category.use-case.js';

function createRepositoryMock() {
  return {
    add: vi.fn<CategoryRepository['add']>(),
    findById: vi.fn<CategoryRepository['findById']>(),
    findAll: vi.fn<CategoryRepository['findAll']>(),
    findDepth: vi.fn<CategoryRepository['findDepth']>(),
    update: vi.fn<CategoryRepository['update']>(),
  } satisfies CategoryRepository;
}

const categoryId = '11111111-1111-4111-8111-111111111111';

function restoreCategory(name = 'Старое') {
  return Category.restore(
    categoryId,
    name,
    'old-slug',
    null,
    new Date('2026-01-01T00:00:00.000Z'),
    new Date('2026-01-01T00:00:00.000Z'),
  );
}

describe('RenameCategoryUseCase', () => {
  it('переименовывает без смены slug и parentId', async () => {
    const category = restoreCategory();
    const repository = createRepositoryMock();
    repository.findById.mockResolvedValue(category);
    repository.update.mockResolvedValue('updated');

    const useCase = new RenameCategoryUseCase(repository);
    const result = await useCase.execute({
      id: categoryId,
      name: 'Новое',
    });

    expect(result).toMatchObject({
      status: 'renamed',
      category: {
        name: 'Новое',
        slug: 'old-slug',
        parentId: null,
      },
    });
    expect(repository.update).toHaveBeenCalledOnce();
  });

  it('пустое тело — no-op без update', async () => {
    const category = restoreCategory();
    const repository = createRepositoryMock();
    repository.findById.mockResolvedValue(category);

    const useCase = new RenameCategoryUseCase(repository);
    const result = await useCase.execute({ id: categoryId });

    expect(result).toMatchObject({
      status: 'renamed',
      category: { name: 'Старое', slug: 'old-slug' },
    });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('то же имя после trim — no-op без update', async () => {
    const category = restoreCategory('Текущее');
    const repository = createRepositoryMock();
    repository.findById.mockResolvedValue(category);

    const useCase = new RenameCategoryUseCase(repository);
    const result = await useCase.execute({
      id: categoryId,
      name: '  Текущее  ',
    });

    expect(result).toMatchObject({
      status: 'renamed',
      category: { name: 'Текущее' },
    });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('возвращает not-found', async () => {
    const repository = createRepositoryMock();
    repository.findById.mockResolvedValue(null);

    const useCase = new RenameCategoryUseCase(repository);
    const result = await useCase.execute({
      id: categoryId,
      name: 'X',
    });

    expect(result).toEqual({ status: 'not-found' });
  });
});
