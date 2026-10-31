import { Injectable } from '@nestjs/common';

import { PrismaService } from
  '../../../../infrastructure/database/prisma/prisma.service.js';

import { Category } from '../../domain/category.js';

import type {
  AddCategoryResult,
  CategoryRepository,
  UpdateCategoryResult,
} from '../../application/ports/category.repository.js';

import { isCategoryParentForeignKeyError } from
  './prisma-category-parent-fk.js';

import { isCategorySlugUniqueViolation } from
  './prisma-category-slug-unique.js';

@Injectable()
export class PrismaCategoryRepository implements CategoryRepository {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async add(category: Category): Promise<AddCategoryResult> {
    try {
      await this.prisma.category.create({
        data: {
          id: category.id,
          name: category.name,
          slug: category.slug,
          parentId: category.parentId,
          createdAt: category.createdAt,
          updatedAt: category.updatedAt,
        },
      });

      return 'created';
    } catch (error) {
      if (isCategorySlugUniqueViolation(error)) {
        return 'slug-taken';
      }

      if (isCategoryParentForeignKeyError(error)) {
        return 'parent-not-found';
      }

      throw error;
    }
  }

  async findById(id: string): Promise<Category | null> {
    const record = await this.prisma.category.findUnique({
      where: { id },
    });

    if (record === null) {
      return null;
    }

    return this.toDomain(record);
  }

  async findAll(): Promise<Category[]> {
    const records = await this.prisma.category.findMany({
      orderBy: [
        { name: 'asc' },
        { id: 'asc' },
      ],
    });

    return records.map((record) => this.toDomain(record));
  }

  async findDepth(id: string): Promise<number | null> {
    let currentId: string | null = id;
    let depth = 0;
    const seen = new Set<string>();

    while (currentId !== null) {
      if (seen.has(currentId)) {
        throw new Error('Обнаружен цикл в дереве категорий');
      }

      seen.add(currentId);
      depth += 1;

      const record: { parentId: string | null } | null =
        await this.prisma.category.findUnique({
          where: { id: currentId },
          select: { parentId: true },
        });

      if (record === null) {
        return null;
      }

      currentId = record.parentId;
    }

    return depth;
  }

  async update(category: Category): Promise<UpdateCategoryResult> {
    const result = await this.prisma.category.updateMany({
      where: { id: category.id },
      data: {
        name: category.name,
        updatedAt: category.updatedAt,
      },
    });

    return result.count === 1 ? 'updated' : 'not-found';
  }

  private toDomain(record: {
    id: string;
    name: string;
    slug: string;
    parentId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): Category {
    return Category.restore(
      record.id,
      record.name,
      record.slug,
      record.parentId,
      record.createdAt,
      record.updatedAt,
    );
  }
}
