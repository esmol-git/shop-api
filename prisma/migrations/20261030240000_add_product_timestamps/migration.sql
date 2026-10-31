-- Product lifecycle timestamps. See docs/adr/0002-product-timestamps.md
-- updatedAt includes stock and archive changes on the products row.

ALTER TABLE "products"
  ADD COLUMN "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
