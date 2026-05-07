-- Migration: Add brochure_url to products table
ALTER TABLE products ADD COLUMN brochure_url TEXT;
