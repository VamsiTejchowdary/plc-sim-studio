-- Create table for PLC modules
CREATE TABLE public.plc_modules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'warning', 'critical', 'offline')),
  module_type TEXT NOT NULL DEFAULT 'standard',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for sensors
CREATE TABLE public.sensors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id UUID NOT NULL REFERENCES public.plc_modules(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sensor_type TEXT NOT NULL DEFAULT 'temperature',
  unit TEXT NOT NULL DEFAULT '°C',
  min_value DECIMAL DEFAULT 0,
  max_value DECIMAL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'warning', 'critical', 'offline')),
  data_pattern TEXT NOT NULL DEFAULT 'sine' CHECK (data_pattern IN ('sine', 'noise', 'square')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for sensor readings
CREATE TABLE public.sensor_readings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sensor_id UUID NOT NULL REFERENCES public.sensors(id) ON DELETE CASCADE,
  value DECIMAL NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.plc_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sensors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sensor_readings ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since this is a PLC monitoring system)
CREATE POLICY "Anyone can view modules" ON public.plc_modules FOR SELECT USING (true);
CREATE POLICY "Anyone can update modules" ON public.plc_modules FOR UPDATE USING (true);
CREATE POLICY "Anyone can insert modules" ON public.plc_modules FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view sensors" ON public.sensors FOR SELECT USING (true);
CREATE POLICY "Anyone can update sensors" ON public.sensors FOR UPDATE USING (true);
CREATE POLICY "Anyone can insert sensors" ON public.sensors FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view sensor readings" ON public.sensor_readings FOR SELECT USING (true);
CREATE POLICY "Anyone can insert sensor readings" ON public.sensor_readings FOR INSERT WITH CHECK (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_plc_modules_updated_at
  BEFORE UPDATE ON public.plc_modules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sensors_updated_at
  BEFORE UPDATE ON public.sensors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable real-time for all tables
ALTER TABLE public.plc_modules REPLICA IDENTITY FULL;
ALTER TABLE public.sensors REPLICA IDENTITY FULL;
ALTER TABLE public.sensor_readings REPLICA IDENTITY FULL;

-- Add tables to real-time publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.plc_modules;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sensors;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sensor_readings;

-- Insert initial data
INSERT INTO public.plc_modules (name, status, module_type) VALUES
  ('Module A - Production Line 1', 'online', 'production'),
  ('Module B - Quality Control', 'online', 'quality'),
  ('Module C - Packaging System', 'warning', 'packaging'),
  ('Module D - Warehouse Control', 'online', 'warehouse');

-- Insert sensors for each module
INSERT INTO public.sensors (module_id, name, sensor_type, unit, min_value, max_value, status, data_pattern)
SELECT 
  m.id,
  s.name,
  s.sensor_type,
  s.unit,
  s.min_value,
  s.max_value,
  s.status,
  s.data_pattern
FROM public.plc_modules m
CROSS JOIN (
  VALUES 
    ('Temperature Sensor', 'temperature', '°C', 20, 80, 'online', 'sine'),
    ('Pressure Sensor', 'pressure', 'bar', 0, 10, 'online', 'noise'),
    ('Vibration Monitor', 'vibration', 'Hz', 0, 50, 'online', 'square')
) AS s(name, sensor_type, unit, min_value, max_value, status, data_pattern);