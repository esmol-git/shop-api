-- Slice A follow-up: reject self-parent at DB level.
-- Does not protect multi-node cycles (application / slice B).

ALTER TABLE "categories"
  ADD CONSTRAINT "categories_parent_not_self_check"
  CHECK ("parentId" IS NULL OR "parentId" <> "id");
