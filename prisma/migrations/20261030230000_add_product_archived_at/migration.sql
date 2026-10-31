-- Soft-remove from catalog without destroying stock history / idempotency keys.
-- See docs/adr/0001-product-lifecycle-archive-vs-delete.md

ALTER TABLE "products"
  ADD COLUMN "archivedAt" TIMESTAMPTZ(3);

CREATE INDEX "products_archived_at_idx"
  ON "products" ("archivedAt");
