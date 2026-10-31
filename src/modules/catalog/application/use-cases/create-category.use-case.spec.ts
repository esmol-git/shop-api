import { describe, expect, it, vi } from 'vitest';

import { CATEGORY_MAX_DEPTH } from '../../domain/category-max-depth.js';
import type { CategoryRepository } from '../ports/category.repository.js';
import { CreateCategoryUseCase } from './create-category.use-case.js';

function createRepositoryMock() {
  return {
    add: vi.fn<CategoryRepository['add']>(),
    findById: vi.fn<CategoryRepository['findById']>(),
    findAll: vi.fn<CategoryRepository['findAll']>(),
    findDepth: vi.fn<CategoryRepository['findDepth']>(),
    update: vi.fn<CategoryRepository['update']>(),
  } satisfies CategoryRepository;
}

describe('CreateCategoryUseCase', () => {
  it('создаёт корневую категорию', async () => {
    const repository = createRepositoryMock();
    repository.add.mockResolvedValue('created');

    const useCase = new CreateCategoryUseCase(repository);
    const result = await useCase.execute({
      name: 'Кессоны',
      slug: 'kessony',
    });

    expect(result.status).toBe('created');
    expect(repository.findDepth).not.toHaveBeenCalled();
  });

  it('отклоняет пятый уровень', async () => {
    const repository = createRepositoryMock();
    repository.findDepth.mockResolvedValue(CATEGORY_MAX_DEPTH);

    const useCase = new CreateCategoryUseCase(repository);
    const result = await useCase.execute({
      name: 'Слишком глубоко',
      slug: 'too-deep',
      parentId: '11111111-1111-4111-8111-111111111111',
    });

    expect(result).toEqual({ status: 'depth-exceeded' });
    expect(repository.add).not.toHaveBeenCalled();
  });

  it('возвращает parent-not-found', async () => {
    const repository = createRepositoryMock();
    repository.findDepth.mockResolvedValue(null);

    const useCase = new CreateCategoryUseCase(repository);
    const result = await useCase.execute({
      name: 'X',
      slug: 'x',
      parentId: '11111111-1111-4111-8111-111111111111',
    });

    expect(result).toEqual({ status: 'parent-not-found' });
  });

  it('возвращает slug-taken', async () => {
    const repository = createRepositoryMock();
    repository.add.mockResolvedValue('slug-taken');

    const useCase = new CreateCategoryUseCase(repository);
    const result = await useCase.execute({
      name: 'Кессоны',
      slug: 'kessony',
    });

    expect(result).toEqual({ status: 'slug-taken' });
  });

  it('создаёт дочернюю в пределах глубины', async () => {
    const repository = createRepositoryMock();
    repository.findDepth.mockResolvedValue(3);
    repository.add.mockResolvedValue('created');

    const useCase = new CreateCategoryUseCase(repository);
    const result = await useCase.execute({
      name: 'Лист',
      slug: 'leaf',
      parentId: '11111111-1111-4111-8111-111111111111',
    });

    expect(result.status).toBe('created');
    if (result.status === 'created') {
      expect(result.category.parentId).toBe(
        '11111111-1111-4111-8111-111111111111',
      );
    }
  });
});
