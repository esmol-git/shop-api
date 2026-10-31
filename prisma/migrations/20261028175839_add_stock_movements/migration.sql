-- CreateEnum
CREATE TYPE "StockMovementDirection" AS ENUM ('INCREASE', 'DECREASE');

-- CreateTable
CREATE TABLE "stock_movements" (
    "idempotencyKey" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "direction" "StockMovementDirection" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("idempotencyKey")
);
