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
  // Use sensor-specific config if pattern_config not provided
  const range = maxValue - minValue;
  const midpoint = minValue + (range / 2);
  const config = patternConfig || {
    amplitude: range * 0.3, // 30% of range as amplitude
    frequency: 0.001,
    phase_offset: 0,
    dc_offset: midpoint // Center the wave around midpoint
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

    let sensors, sensorsError;
    try {
      const result = await supabase
        .from('sensors')
        .select('id, data_pattern, min_value, max_value, pattern_config')
        .eq('status', 'online');
      sensors = result.data;
      sensorsError = result.error;
    } catch (error) {
      console.log('pattern_config column not found, using fallback query');
      const result = await supabase
        .from('sensors')
        .select('id, data_pattern, min_value, max_value')
        .eq('status', 'online');
      sensors = result.data;
      sensorsError = result.error;
    }

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

      const finalValue = Math.round(value * 100) / 100; // Round to 2 decimal places
      
      // Debug logging for pressure sensors (noise pattern)
      if (sensor.data_pattern === 'noise') {
        console.log(`🔧 Edge function pressure sensor: value=${finalValue}, range=[${sensor.min_value}-${sensor.max_value}]`);
      }
      
      readings.push({
        sensor_id: sensor.id,
        value: finalValue,
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