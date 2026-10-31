import { randomUUID } from 'node:crypto';

import { ProductDescription } from
  './value-objects/product-description.js';
import { ProductName } from './value-objects/product-name.js';
import { ProductPrice } from './value-objects/product-price.js';
import { ProductSlug } from './value-objects/product-slug.js';
import { StockQuantity } from './value-objects/stock-quantity.js';
import { resolveProductSlug } from './slugify-product-name.js';

export class Product {
  private constructor(
    private readonly productId: string,
    private productName: ProductName,
    private productDescription: ProductDescription,
    private productSlug: ProductSlug,
    private productPrice: ProductPrice | null,
    private productStockQuantity: StockQuantity | null,
    private productArchivedAt: Date | null,
    private readonly productCreatedAt: Date,
    private productUpdatedAt: Date,
  ) {}

  static create(
    name: string,
    optionsOrAt: {
      description?: string | null;
      slug?: string | null;
      at?: Date;
    } | Date = {},
  ): Product {
    const options = optionsOrAt instanceof Date
      ? { at: optionsOrAt }
      : optionsOrAt;
    const at = options.at ?? new Date();
    const productName = ProductName.create(name);
    const id = randomUUID();
    const slug = resolveProductSlug(id, productName.value, options.slug);
    const description = ProductDescription.create(options.description);

    return new Product(
      id,
      productName,
      description,
      slug,
      null,
      null,
      null,
      at,
      at,
    );
  }

  static restore(
    id: string,
    name: string,
    priceInKopecks: number | null = null,
    stockQuantity: number | null = null,
    archivedAt: Date | null = null,
    createdAt: Date = new Date(0),
    updatedAt: Date = new Date(0),
    description: string | null = null,
    slug: string = `product-${id.replaceAll('-', '').slice(0, 8)}`,
  ): Product {
    const productName = ProductName.create(name);

    const productPrice = priceInKopecks === null
      ? null
      : ProductPrice.create(priceInKopecks);

    const productStockQuantity = stockQuantity === null
      ? null
      : StockQuantity.create(stockQuantity);

    return new Product(
      id,
      productName,
      ProductDescription.create(description),
      ProductSlug.create(slug),
      productPrice,
      productStockQuantity,
      archivedAt,
      createdAt,
      updatedAt,
    );
  }

  get id(): string {
    return this.productId;
  }

  get name(): string {
    return this.productName.value;
  }

  get description(): string | null {
    return this.productDescription.value;
  }

  get slug(): string {
    return this.productSlug.value;
  }

  get price(): ProductPrice | null {
    return this.productPrice;
  }

  get stockQuantity(): StockQuantity | null {
    return this.productStockQuantity;
  }

  get inventoryTracked(): boolean {
    return this.productStockQuantity !== null;
  }

  get archivedAt(): Date | null {
    return this.productArchivedAt;
  }

  get isArchived(): boolean {
    return this.productArchivedAt !== null;
  }

  get createdAt(): Date {
    return this.productCreatedAt;
  }

  get updatedAt(): Date {
    return this.productUpdatedAt;
  }

  rename(name: string, at: Date = new Date()): void {
    this.productName = ProductName.create(name);
    this.touch(at);
  }

  changeDescription(
    description: string | null,
    at: Date = new Date(),
  ): void {
    this.productDescription = ProductDescription.create(description);
    this.touch(at);
  }

  changeSlug(slug: string, at: Date = new Date()): void {
    this.productSlug = ProductSlug.create(slug);
    this.touch(at);
  }

  changePrice(amountInKopecks: number, at: Date = new Date()): void {
    this.productPrice = ProductPrice.create(amountInKopecks);
    this.touch(at);
  }

  enableInventoryTracking(
    quantity: number,
    at: Date = new Date(),
  ): void {
    if (this.inventoryTracked) {
      throw new Error('Учёт остатков уже включён');
    }

    this.productStockQuantity = StockQuantity.create(quantity);
    this.touch(at);
  }

  disableInventoryTracking(at: Date = new Date()): void {
    this.productStockQuantity = null;
    this.touch(at);
  }

  archive(at: Date = new Date()): void {
    if (this.productArchivedAt !== null) {
      return;
    }

    this.productArchivedAt = at;
    this.touch(at);
  }

  private touch(at: Date): void {
    this.productUpdatedAt = at;
  }
}
