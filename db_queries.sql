
-- /* DROP AND CREATE DATABASE */

-- -- SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'vendure';
-- -- DROP DATABASE IF EXISTS vendure;
-- -- CREATE DATABASE vendure;

-- TRUNCATE TABLE
--   "product"
-- RESTART IDENTITY
-- CASCADE;


-- TRUNCATE TABLE
--   "asset"
-- RESTART IDENTITY
-- CASCADE;

-- TRUNCATE TABLE
--   "collection",
--   "facet"
-- RESTART IDENTITY
-- CASCADE;
-- INSERT INTO collection (id, position, "isRoot", "isPrivate", "inheritFilters", "filters") VALUES (1, 0, true, false, true, '[]'::jsonb);
-- INSERT INTO collection_translation (id, name, slug, "languageCode", description,"baseId") VALUES (1, '__root_collection__', '__root_collection__', 'en', 'The root of the Collection tree.', 1);


-- TRUNCATE TABLE
--   "order",
--   "order_counter"
-- RESTART IDENTITY
-- CASCADE;



-- -- 1) Delete only product-related assets and then products (Vendure)
-- -- Run in a single transaction. Adjust table/column names if your DB uses different naming.

-- BEGIN;

-- -- Collect all asset IDs used by products (junction table + featured on product + featured on variant)
-- CREATE TEMP TABLE _product_asset_ids AS
--   SELECT "assetId" AS id FROM product_asset
--   UNION
--   SELECT "featuredAssetId" FROM product WHERE "featuredAssetId" IS NOT NULL
--   UNION
--   SELECT "featuredAssetId" FROM product_variant WHERE "featuredAssetId" IS NOT NULL;

-- -- Unlink assets from products (required before deleting from asset)
-- DELETE FROM product_asset;
-- UPDATE product SET "featuredAssetId" = NULL WHERE "featuredAssetId" IS NOT NULL;
-- UPDATE product_variant SET "featuredAssetId" = NULL WHERE "featuredAssetId" IS NOT NULL;

-- -- If you have product_variant_asset (variant-level assets), uncomment:
-- -- DELETE FROM product_variant_asset;
-- -- INSERT INTO _product_asset_ids (id) SELECT "assetId" FROM product_variant_asset ON CONFLICT DO NOTHING;

-- -- Delete only those assets that were used by products
-- DELETE FROM asset WHERE id IN (SELECT id FROM _product_asset_ids);

-- -- Delete all products (and variants, translations, product_asset, etc.)
-- TRUNCATE TABLE "product" RESTART IDENTITY CASCADE;

-- COMMIT;

-- -- Delete orphan assets (not used by products, variants, or collections). Run after products exist.
-- DELETE FROM asset
-- WHERE id NOT IN (
--   SELECT "assetId" FROM product_asset
--   UNION
--   SELECT "featuredAssetId" FROM product WHERE "featuredAssetId" IS NOT NULL
--   UNION
--   SELECT "featuredAssetId" FROM product_variant WHERE "featuredAssetId" IS NOT NULL
--   UNION
--   SELECT "featuredAssetId" FROM collection WHERE "featuredAssetId" IS NOT NULL
-- );

-- -- ========== Full reset script below (run separately if needed) ==========

-- ALTER TABLE "attribute_property" ADD "sorting" integer NOT NULL DEFAULT 0;
-- TRUNCATE TABLE
--   "product"
-- RESTART IDENTITY
-- CASCADE;


-- TRUNCATE TABLE
--   "asset"
-- RESTART IDENTITY
-- CASCADE;

-- TRUNCATE TABLE
--   "collection",
--   "facet"
-- RESTART IDENTITY
-- CASCADE;
-- INSERT INTO collection (id, position, "isRoot", "isPrivate", "inheritFilters", "filters") VALUES (1, 0, true, false, true, '[]'::jsonb);
-- INSERT INTO collection_translation (id, name, slug, "languageCode", description,"baseId") VALUES (1, '__root_collection__', '__root_collection__', 'en', 'The root of the Collection tree.', 1);


-- TRUNCATE TABLE
--   "order",
--   "order_counter"
-- RESTART IDENTITY
-- CASCADE;