-- Add model_usage column to messages table
ALTER TABLE messages ADD COLUMN model_usage JSONB DEFAULT NULL;

-- Add comment to explain the field
COMMENT ON COLUMN messages.model_usage IS 'Stores model usage statistics including model names, token counts, and costs';

-- Create index for better query performance
CREATE INDEX idx_messages_model_usage ON messages USING GIN (model_usage);