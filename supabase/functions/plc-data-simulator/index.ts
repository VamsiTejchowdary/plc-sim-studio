// @ts-ignore - Deno runtime supports URL imports
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Deno global types for IDE
declare global {
  const Deno: {
    serve: (handler: (req: Request) => Promise<Response>) => void;
    env: { get: (key: string) => string | undefined };
  };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SensorReading {
  sensor_id: string;
  value: number;
  timestamp: string;
}

const generateSensorValue = (
  pattern: string,
  minValue: number,
  maxValue: number,
  time: number,
  patternConfig?: any
): number => {
  // Default pattern configuration
  const config = patternConfig || {
    amplitude: 50,
    frequency: 0.001,
    phase_offset: 0,
    dc_offset: 50
  };

  switch (pattern) {
    case 'sine':
      // Configurable sinusoidal: amplitude * sin(frequency * time + phase_offset) + dc_offset
      const sineValue = config.amplitude * Math.sin(config.frequency * time + config.phase_offset) + config.dc_offset;
      return Math.max(minValue, Math.min(maxValue, sineValue));

    case 'noise':
      const sineBase = config.amplitude * Math.sin(config.frequency * time + config.phase_offset) + config.dc_offset;
      const noise = (Math.random() - 0.5) * config.amplitude * 0.2;
      return Math.max(minValue, Math.min(maxValue, sineBase + noise));

    case 'square':
      const squareValue = config.dc_offset + (Math.sin(config.frequency * time + config.phase_offset) > 0 ? config.amplitude * 0.8 : -config.amplitude * 0.2);
      return Math.max(minValue, Math.min(maxValue, squareValue));

    default:
      return minValue + Math.random() * (maxValue - minValue);
  }
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const executionId = crypto.randomUUID();
    console.log(`PLC Data Simulator [${executionId}]: Starting sensor data generation`);

    // Get all sensors with their simulation parameters
    const { data: sensors, error: sensorsError } = await supabase
      .from('sensors')
      .select('id, data_pattern, min_value, max_value, pattern_config')
      .eq('status', 'online');

    if (sensorsError) {
      console.error('Error fetching sensors:', sensorsError);
      throw sensorsError;
    }

    if (!sensors || sensors.length === 0) {
      console.log('No online sensors found');
      return new Response(
        JSON.stringify({ message: 'No online sensors found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const currentTime = Date.now();
    const readings: SensorReading[] = [];

    // Generate sensor readings for all sensors
    for (const sensor of sensors) {
      const value = generateSensorValue(
        sensor.data_pattern,
        Number(sensor.min_value),
        Number(sensor.max_value),
        currentTime,
        sensor.pattern_config
      );

      readings.push({
        sensor_id: sensor.id,
        value: Math.round(value * 100) / 100, // Round to 2 decimal places
        timestamp: new Date().toISOString()
      });
    }

    // Insert all readings at once (atomic operation for thread safety)
    const { error: insertError } = await supabase
      .from('sensor_readings')
      .insert(readings);

    if (insertError) {
      console.error('Error inserting sensor readings:', insertError);
      throw insertError;
    }

    console.log(`PLC Data Simulator [${executionId}]: Generated ${readings.length} sensor readings`);

    return new Response(
      JSON.stringify({
        message: `Generated ${readings.length} sensor readings`,
        readings: readings.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('PLC Data Simulator Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});