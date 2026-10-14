-- Disable/drain new clients and redeploy v1/v1 before applying.
ALTER TABLE menu_items DROP COLUMN price_vnd;
