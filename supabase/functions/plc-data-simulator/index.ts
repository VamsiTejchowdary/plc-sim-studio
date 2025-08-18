import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SensorSimulationData {
  sensor_id: string;
  data_pattern: string;
  min_value: number;
  max_value: number;
}

const generateSensorValue = (pattern: string, minValue: number, maxValue: number, time: number): number => {
  const range = maxValue - minValue;
  
  switch (pattern) {
    case 'sine':
      return minValue + (range / 2) * (1 + Math.sin(time / 1000));
    case 'noise':
      const sineBase = minValue + (range / 2) * (1 + Math.sin(time / 1000));
      const noise = (Math.random() - 0.5) * range * 0.2;
      return Math.max(minValue, Math.min(maxValue, sineBase + noise));
    case 'square':
      return minValue + range * (Math.sin(time / 2000) > 0 ? 0.8 : 0.2);
    default:
      return minValue + Math.random() * range;
  }
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('PLC Data Simulator: Starting sensor data generation');

    // Get all sensors with their simulation parameters
    const { data: sensors, error: sensorsError } = await supabase
      .from('sensors')
      .select('id, data_pattern, min_value, max_value')
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
    const readings = [];

    // Generate sensor readings for all sensors
    for (const sensor of sensors) {
      const value = generateSensorValue(
        sensor.data_pattern,
        Number(sensor.min_value),
        Number(sensor.max_value),
        currentTime
      );

      readings.push({
        sensor_id: sensor.id,
        value: Math.round(value * 100) / 100, // Round to 2 decimal places
        timestamp: new Date().toISOString()
      });
    }

    // Insert all readings at once
    const { error: insertError } = await supabase
      .from('sensor_readings')
      .insert(readings);

    if (insertError) {
      console.error('Error inserting sensor readings:', insertError);
      throw insertError;
    }

    console.log(`PLC Data Simulator: Generated ${readings.length} sensor readings`);

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