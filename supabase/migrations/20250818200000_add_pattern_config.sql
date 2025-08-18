-- Add pattern configuration to sensors table
ALTER TABLE public.sensors ADD COLUMN pattern_config JSONB DEFAULT '{"amplitude": 50, "frequency": 0.001, "phase_offset": 0, "dc_offset": 50}'::jsonb;