import type { Product } from '../../domain/product.js';
import type { StockQuantity } from
  '../../domain/value-objects/stock-quantity.js';

export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');

export interface FindProductsParams {
  limit: number;
  offset: number;
}

export interface ProductPage {
  items: Product[];
  total: number;
}

export type DeleteProductResult =
  | 'deleted'
  | 'not-found'
  | 'positive-stock'
  | 'has-history';

export type ArchiveProductResult =
  | 'archived'
  | 'replayed'
  | 'not-found';

export type AddProductResult =
  | 'created'
  | 'slug-taken';

export type UpdateProductResult =
  | 'updated'
  | 'not-found'
  | 'slug-taken';

export interface ProductRepository {
  add(product: Product): Promise<AddProductResult>;
  findById(id: string): Promise<Product | null>;
  findPage(params: FindProductsParams): Promise<ProductPage>;
  update(product: Product): Promise<UpdateProductResult>;
  deleteById(id: string): Promise<DeleteProductResult>;
  archiveById(id: string): Promise<ArchiveProductResult>;
  enableInventoryTracking(
    id: string,
    quantity: StockQuantity,
  ): Promise<boolean>;
  disableInventoryTracking(id: string): Promise<boolean>;
}
