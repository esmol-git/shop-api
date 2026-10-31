-- Referential integrity for stock history.
-- See docs/adr/0001-product-lifecycle-archive-vs-delete.md (slice 6).
-- ON DELETE/UPDATE RESTRICT: do not drop or rewrite product id when movements exist.

CREATE INDEX "stock_movements_productId_idx"
  ON "stock_movements"("productId");

ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_productId_fkey"
  FOREIGN KEY ("productId")
  REFERENCES "products"("id")
  ON DELETE RESTRICT
  ON UPDATE RESTRICT;
