-- 0012_institution_website_city.sql
-- Institutions tablosuna kurum websitesi ve sehir alanlari ekler.
ALTER TABLE institutions ADD COLUMN website_url TEXT;
ALTER TABLE institutions ADD COLUMN city TEXT;
