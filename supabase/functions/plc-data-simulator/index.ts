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
  patternConfig?: any,
  sensorId?: string
): number => {
  // Use sensor-specific config if pattern_config not provided
  const range = maxValue - minValue;
  const midpoint = minValue + (range / 2);
  
  // Create unique configuration for each sensor
  const sensorHash = sensorId ? sensorId.split('-')[0] : '12345678';
  const sensorSeed = parseInt(sensorHash.substring(0, 8), 16) || 12345;
  
  const config = patternConfig || {
    amplitude: range * 0.3, // 30% of range as amplitude
    frequency: 0.001 + (sensorSeed % 100) * 0.00001, // Slightly different frequencies
    phase_offset: (sensorSeed % 628) / 100, // Unique phase offset based on sensor ID
    dc_offset: midpoint // Center the wave around midpoint
  };

  // Add sensor-type specific variations
  let typeMultiplier = 1;
  let noiseLevel = 0.2;
  let value;
  
  switch (pattern) {
    case 'sine':
      // Temperature sensors: smooth sine waves
      typeMultiplier = 1.0;
      value = config.amplitude * Math.sin(config.frequency * time + config.phase_offset) + config.dc_offset;
      break;

    case 'noise':
      // Pressure sensors: sine wave with significant noise
      typeMultiplier = 0.8;
      noiseLevel = 0.3;
      const sineBase = config.amplitude * typeMultiplier * Math.sin(config.frequency * time + config.phase_offset) + config.dc_offset;
      // Use sensor ID to seed random for consistent but different noise per sensor
      const randomSeed = (sensorSeed + Math.floor(time / 1000)) % 1000;
      const pseudoRandom = (Math.sin(randomSeed * 12.9898) * 43758.5453) % 1;
      const noise = (pseudoRandom - 0.5) * config.amplitude * noiseLevel;
      value = sineBase + noise;
      break;

    case 'square':
      // Vibration monitors: digital square waves
      typeMultiplier = 0.9;
      const squareWave = Math.sin(config.frequency * time + config.phase_offset) > 0 ? 1 : -1;
      value = config.dc_offset + (squareWave * config.amplitude * typeMultiplier);
      break;

    default:
      // Random values with sensor-specific seed
      const randomSeed2 = (sensorSeed + Math.floor(time / 5000)) % 1000;
      const pseudoRandom2 = (Math.sin(randomSeed2 * 12.9898) * 43758.5453) % 1;
      value = minValue + pseudoRandom2 * (maxValue - minValue);
  }
  
  return Math.max(minValue, Math.min(maxValue, value));
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
        sensor.pattern_config,
        sensor.id
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