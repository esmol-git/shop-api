-- Defense in depth: domain VO already reject negatives, but direct SQL,
-- future bulk jobs, and bugs in adapters must not leave invalid rows.
-- PostgreSQL CHECK treats NULL as satisfying the predicate, so nullable
-- priceInKopecks / stockQuantity keep "no price" / "tracking off" semantics.

ALTER TABLE "products"
  ADD CONSTRAINT "products_price_in_kopecks_non_negative_check"
  CHECK ("priceInKopecks" >= 0);

ALTER TABLE "products"
  ADD CONSTRAINT "products_stock_quantity_non_negative_check"
  CHECK ("stockQuantity" >= 0);

ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_quantity_positive_check"
  CHECK ("quantity" > 0);
