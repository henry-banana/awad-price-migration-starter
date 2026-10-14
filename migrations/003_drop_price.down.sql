-- Schema/data recovery; operational rollback requires additional coordination.
ALTER TABLE menu_items ADD COLUMN price REAL CHECK (price > 0);
UPDATE menu_items SET price = price_vnd / 1000.0;
