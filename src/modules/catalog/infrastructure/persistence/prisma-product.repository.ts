import { Injectable } from '@nestjs/common';

import { StockQuantity } from
  '../../domain/value-objects/stock-quantity.js';

import { PrismaService } from
  '../../../../infrastructure/database/prisma/prisma.service.js';

import type {
  AddProductResult,
  ArchiveProductResult,
  DeleteProductResult,
  FindProductsParams,
  ProductPage,
  ProductRepository,
  UpdateProductResult,
} from '../../application/ports/product.repository.js';

import { Product } from '../../domain/product.js';

import { isStockMovementProductForeignKeyError } from
  './prisma-foreign-key.js';

import { isProductSlugUniqueViolation } from
  './prisma-slug-unique.js';

@Injectable()
export class PrismaProductRepository implements ProductRepository {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async enableInventoryTracking(
    id: string,
    quantity: StockQuantity,
  ): Promise<boolean> {
    const result = await this.prisma.product.updateMany({
      where: {
        id,
        stockQuantity: null,
      },
      data: {
        stockQuantity: quantity.value,
        updatedAt: new Date(),
      },
    });

    return result.count === 1;
  }

  async disableInventoryTracking(id: string): Promise<boolean> {
    const result = await this.prisma.product.updateMany({
      where: {
        id,
      },
      data: {
        stockQuantity: null,
        updatedAt: new Date(),
      },
    });

    return result.count === 1;
  }

  async update(product: Product): Promise<UpdateProductResult> {
    try {
      const result = await this.prisma.product.updateMany({
        where: {
          id: product.id,
        },
        data: {
          name: product.name,
          description: product.description,
          slug: product.slug,
          priceInKopecks: product.price?.amount ?? null,
          archivedAt: product.archivedAt,
          updatedAt: product.updatedAt,
        },
      });

      if (result.count === 1) {
        return 'updated';
      }

      return 'not-found';
    } catch (error) {
      if (isProductSlugUniqueViolation(error)) {
        return 'slug-taken';
      }

      throw error;
    }
  }

  async add(product: Product): Promise<AddProductResult> {
    try {
      await this.prisma.product.create({
        data: {
          id: product.id,
          name: product.name,
          description: product.description,
          slug: product.slug,
          priceInKopecks: product.price?.amount ?? null,
          stockQuantity: product.stockQuantity?.value ?? null,
          archivedAt: product.archivedAt,
          createdAt: product.createdAt,
          updatedAt: product.updatedAt,
        },
      });

      return 'created';
    } catch (error) {
      if (isProductSlugUniqueViolation(error)) {
        return 'slug-taken';
      }

      throw error;
    }
  }

  async findById(id: string): Promise<Product | null> {
    const record = await this.prisma.product.findUnique({
      where: {
        id,
      },
    });

    if (record === null) {
      return null;
    }

    return this.toDomain(record);
  }

  async findPage(
    params: FindProductsParams,
  ): Promise<ProductPage> {
    const where = {
      archivedAt: null,
    };

    const [records, total] = await this.prisma.$transaction(
      [
        this.prisma.product.findMany({
          where,
          orderBy: {
            id: 'asc',
          },
          take: params.limit,
          skip: params.offset,
        }),
        this.prisma.product.count({ where }),
      ],
      {
        isolationLevel: 'RepeatableRead',
      },
    );

    return {
      items: records.map((record) => this.toDomain(record)),
      total,
    };
  }

  async deleteById(id: string): Promise<DeleteProductResult> {
    try {
      const deleted = await this.prisma.$executeRaw`
        DELETE FROM "products" AS p
        WHERE p.id = ${id}::uuid
          AND (p."stockQuantity" IS NULL OR p."stockQuantity" = 0)
          AND NOT EXISTS (
            SELECT 1
            FROM "stock_movements" AS sm
            WHERE sm."productId" = p.id
          )
      `;

      if (deleted === 1) {
        return 'deleted';
      }
    } catch (error) {
      if (isStockMovementProductForeignKeyError(error)) {
        return 'has-history';
      }

      throw error;
    }

    const existing = await this.findById(id);

    if (existing === null) {
      return 'not-found';
    }

    if (
      existing.stockQuantity !== null &&
      existing.stockQuantity.value > 0
    ) {
      return 'positive-stock';
    }

    return 'has-history';
  }

  async archiveById(id: string): Promise<ArchiveProductResult> {
    const archivedAt = new Date();

    const result = await this.prisma.product.updateMany({
      where: {
        id,
        archivedAt: null,
      },
      data: {
        archivedAt,
        updatedAt: archivedAt,
      },
    });

    if (result.count === 1) {
      return 'archived';
    }

    const existing = await this.findById(id);

    if (existing === null) {
      return 'not-found';
    }

    return 'replayed';
  }

  private toDomain(
    record: {
      id: string;
      name: string;
      description: string | null;
      slug: string;
      priceInKopecks: number | null;
      stockQuantity: number | null;
      archivedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    },
  ): Product {
    return Product.restore(
      record.id,
      record.name,
      record.priceInKopecks,
      record.stockQuantity,
      record.archivedAt,
      record.createdAt,
      record.updatedAt,
      record.description,
      record.slug,
    );
  }
}
