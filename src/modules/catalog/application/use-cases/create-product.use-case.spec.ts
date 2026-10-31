import { describe, expect, it } from 'vitest';

import { Product } from '../../domain/product.js';
import type {
  AddProductResult,
  ArchiveProductResult,
  DeleteProductResult,
  FindProductsParams,
  ProductPage,
  ProductRepository,
  UpdateProductResult,
} from '../ports/product.repository.js';
import { CreateProductUseCase } from './create-product.use-case.js';
import { StockQuantity } from
  '../../domain/value-objects/stock-quantity.js';

class InMemoryProductRepository implements ProductRepository {
  readonly items: Product[] = [];

  async enableInventoryTracking(
    id: string,
    quantity: StockQuantity,
  ): Promise<boolean> {
    const product = await this.findById(id);

    if (product === null || product.inventoryTracked) {
      return false;
    }

    product.enableInventoryTracking(quantity.value);

    return true;
  }

  async disableInventoryTracking(id: string): Promise<boolean> {
    const product = await this.findById(id);

    if (product === null) {
      return false;
    }

    product.disableInventoryTracking();

    return true;
  }

  async add(product: Product): Promise<AddProductResult> {
    if (this.items.some((item) => item.slug === product.slug)) {
      return 'slug-taken';
    }

    this.items.push(product);

    return 'created';
  }

  async findById(id: string): Promise<Product | null> {
    return this.items.find((product) => product.id === id) ?? null;
  }

  async findPage(
    params: FindProductsParams,
  ): Promise<ProductPage> {
    const activeItems = this.items.filter(
      (product) => !product.isArchived,
    );

    const sortedItems = [...activeItems].sort((left, right) => {
      if (left.id < right.id) return -1;
      if (left.id > right.id) return 1;
      return 0;
    });

    return {
      items: sortedItems.slice(
        params.offset,
        params.offset + params.limit,
      ),
      total: activeItems.length,
    };
  }

  async update(product: Product): Promise<UpdateProductResult> {
    const index = this.items.findIndex(
      (item) => item.id === product.id,
    );

    if (index === -1) {
      return 'not-found';
    }

    if (
      this.items.some(
        (item) => item.slug === product.slug && item.id !== product.id,
      )
    ) {
      return 'slug-taken';
    }

    this.items[index] = product;

    return 'updated';
  }

  async deleteById(id: string): Promise<DeleteProductResult> {
    const product = await this.findById(id);

    if (product === null) {
      return 'not-found';
    }

    if (
      product.stockQuantity !== null
      && product.stockQuantity.value > 0
    ) {
      return 'positive-stock';
    }

    const index = this.items.findIndex(
      (item) => item.id === id,
    );

    this.items.splice(index, 1);

    return 'deleted';
  }

  async archiveById(id: string): Promise<ArchiveProductResult> {
    const product = await this.findById(id);

    if (product === null) {
      return 'not-found';
    }

    if (product.isArchived) {
      return 'replayed';
    }

    product.archive();

    return 'archived';
  }
}

describe('CreateProductUseCase', () => {
  it('сохраняет товар и генерирует slug из названия', async () => {
    const repository = new InMemoryProductRepository();
    const useCase = new CreateProductUseCase(repository);

    const result = await useCase.execute({
      name: '  Проектор Epson  ',
    });

    expect(repository.items).toHaveLength(1);

    const savedProduct = repository.items[0]!;

    expect(result).toEqual({
      status: 'created',
      product: {
        id: savedProduct.id,
        name: 'Проектор Epson',
        description: null,
        slug: 'proektor-epson',
        price: null,
        inventory: {
          tracked: false,
          quantity: null,
        },
        archivedAt: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
    });

    expect(savedProduct.slug).toBe('proektor-epson');
  });

  it('принимает явные description и slug', async () => {
    const repository = new InMemoryProductRepository();
    const useCase = new CreateProductUseCase(repository);

    const result = await useCase.execute({
      name: 'Проектор Epson',
      description: 'Домашний проектор',
      slug: 'epson-home',
    });

    expect(result).toMatchObject({
      status: 'created',
      product: {
        description: 'Домашний проектор',
        slug: 'epson-home',
      },
    });
  });

  it('возвращает slug-taken при конфликте явного slug', async () => {
    const repository = new InMemoryProductRepository();
    const useCase = new CreateProductUseCase(repository);

    await useCase.execute({
      name: 'A',
      slug: 'same-slug',
    });

    const result = await useCase.execute({
      name: 'B',
      slug: 'same-slug',
    });

    expect(result).toEqual({ status: 'slug-taken' });
    expect(repository.items).toHaveLength(1);
  });

  it('при занятом base без явного slug делает retry product-{8 hex}', async () => {
    const repository = new InMemoryProductRepository();
    const useCase = new CreateProductUseCase(repository);

    await useCase.execute({
      name: 'Проектор Epson',
      slug: 'proektor-epson',
    });

    const result = await useCase.execute({
      name: 'Проектор Epson',
    });

    expect(result.status).toBe('created');
    expect(repository.items).toHaveLength(2);

    const second = repository.items[1]!;

    expect(second.slug).toBe(
      `product-${second.id.replaceAll('-', '').slice(0, 8)}`,
    );
  });

  it('не сохраняет товар с недопустимым названием', async () => {
    const repository = new InMemoryProductRepository();
    const useCase = new CreateProductUseCase(repository);

    await expect(
      useCase.execute({ name: '   ' }),
    ).rejects.toThrow('Название товара не может быть пустым');

    expect(repository.items).toHaveLength(0);
  });

  it('передаёт ошибку сохранения вызывающему коду', async () => {
    const storageError = new Error('Хранилище недоступно');

    const repository: ProductRepository = {
      async enableInventoryTracking(): Promise<boolean> {
        throw new Error(
          'enableInventoryTracking не должен вызываться при создании товара',
        );
      },
      async disableInventoryTracking(): Promise<boolean> {
        throw new Error(
          'disableInventoryTracking не должен вызываться при создании товара',
        );
      },
      async add(): Promise<AddProductResult> {
        throw storageError;
      },
      async findById(): Promise<Product | null> {
        throw new Error('findById не должен вызываться при создании товара');
      },
      async findPage(): Promise<ProductPage> {
        throw new Error('findPage не должен вызываться при создании товара');
      },
      async update(): Promise<UpdateProductResult> {
        throw new Error('update не должен вызываться при создании товара');
      },
      async deleteById(): Promise<DeleteProductResult> {
        throw new Error('deleteById не должен вызываться при создании товара');
      },
      async archiveById(): Promise<ArchiveProductResult> {
        throw new Error('archiveById не должен вызываться при создании товара');
      },
    };

    const useCase = new CreateProductUseCase(repository);

    await expect(
      useCase.execute({ name: 'Проектор Epson' }),
    ).rejects.toBe(storageError);
  });
});
