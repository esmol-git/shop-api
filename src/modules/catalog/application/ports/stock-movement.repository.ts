import type { StockMovementQuantity } from
  '../../domain/value-objects/stock-movement-quantity.js';

export const STOCK_MOVEMENT_REPOSITORY = Symbol(
  'STOCK_MOVEMENT_REPOSITORY',
);

export interface IncreaseStockOnceInput {
  idempotencyKey: string;
  productId: string;
  quantity: StockMovementQuantity;
}

export type IncreaseStockOnceResult =
  | 'applied'
  | 'replayed'
  | 'key-conflict'
  | 'rejected';

export interface DecreaseStockOnceInput {
  idempotencyKey: string;
  productId: string;
  quantity: StockMovementQuantity;
}

export type DecreaseStockOnceResult =
  | 'applied'
  | 'replayed'
  | 'key-conflict'
  | 'rejected';

  export interface StockMovementRepository {
    increaseStockOnce(
      input: IncreaseStockOnceInput,
    ): Promise<IncreaseStockOnceResult>;
  
    decreaseStockOnce(
      input: DecreaseStockOnceInput,
    ): Promise<DecreaseStockOnceResult>;
  }