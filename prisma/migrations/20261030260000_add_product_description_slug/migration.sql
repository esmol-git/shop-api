-- Catalog card fields. See docs/adr/0004-product-card-slug-description.md

ALTER TABLE "products"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "slug" TEXT;

-- Slugify aligned with src/modules/catalog/domain/slugify-product-name.ts
CREATE OR REPLACE FUNCTION tmp_shop_slugify_product_name(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  lowered text;
  result text := '';
  ch text;
  mapped text;
  i int;
BEGIN
  lowered := lower(btrim(input));

  FOR i IN 1..char_length(lowered) LOOP
    ch := substr(lowered, i, 1);
    mapped := CASE ch
      WHEN 'а' THEN 'a' WHEN 'б' THEN 'b' WHEN 'в' THEN 'v' WHEN 'г' THEN 'g'
      WHEN 'д' THEN 'd' WHEN 'е' THEN 'e' WHEN 'ё' THEN 'e' WHEN 'ж' THEN 'zh'
      WHEN 'з' THEN 'z' WHEN 'и' THEN 'i' WHEN 'й' THEN 'y' WHEN 'к' THEN 'k'
      WHEN 'л' THEN 'l' WHEN 'м' THEN 'm' WHEN 'н' THEN 'n' WHEN 'о' THEN 'o'
      WHEN 'п' THEN 'p' WHEN 'р' THEN 'r' WHEN 'с' THEN 's' WHEN 'т' THEN 't'
      WHEN 'у' THEN 'u' WHEN 'ф' THEN 'f' WHEN 'х' THEN 'h' WHEN 'ц' THEN 'ts'
      WHEN 'ч' THEN 'ch' WHEN 'ш' THEN 'sh' WHEN 'щ' THEN 'sch' WHEN 'ъ' THEN ''
      WHEN 'ы' THEN 'y' WHEN 'ь' THEN '' WHEN 'э' THEN 'e' WHEN 'ю' THEN 'yu'
      WHEN 'я' THEN 'ya'
      ELSE ch
    END;
    result := result || mapped;
  END LOOP;

  result := lower(result);
  result := regexp_replace(result, '[^a-z0-9]+', '-', 'g');
  result := regexp_replace(result, '^-+|-+$', '', 'g');
  result := left(result, 100);
  result := regexp_replace(result, '-+$', '', 'g');

  RETURN result;
END;
$$;

UPDATE "products" AS p
SET "slug" = CASE
  WHEN tmp_shop_slugify_product_name(p."name") <> ''
    THEN tmp_shop_slugify_product_name(p."name")
  ELSE 'product-' || left(replace(p."id"::text, '-', ''), 8)
END
WHERE p."slug" IS NULL;

-- Deterministic unique repair: keep first by id, others → product-{8 hex}
WITH ranked AS (
  SELECT
    "id",
    "slug",
    row_number() OVER (PARTITION BY "slug" ORDER BY "id") AS rn
  FROM "products"
)
UPDATE "products" AS p
SET "slug" = 'product-' || left(replace(p."id"::text, '-', ''), 8)
FROM ranked AS r
WHERE p."id" = r."id"
  AND r.rn > 1;

ALTER TABLE "products"
  ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "products_slug_key"
  ON "products"("slug");

DROP FUNCTION tmp_shop_slugify_product_name(text);
