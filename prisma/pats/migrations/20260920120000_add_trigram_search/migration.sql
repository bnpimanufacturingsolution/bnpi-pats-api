-- Enable pg_trgm extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN index on Section.name for trigram similarity search
CREATE INDEX idx_section_name_trgm ON "Section" USING GIN (name gin_trgm_ops);

-- GIN index on WorkProcess.name for trigram similarity search
CREATE INDEX idx_workprocess_name_trgm ON "WorkProcess" USING GIN (name gin_trgm_ops);
