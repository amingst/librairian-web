-- Create PostgreSQL extensions for full-text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create a GIN index on the searchText field
CREATE INDEX IF NOT EXISTS document_search_idx ON "Document" USING GIN (to_tsvector('english', "searchText"));
