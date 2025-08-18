import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Activity,
  Settings,
  Power,
  Wifi,
  AlertTriangle,
  CheckCircle,
  Thermometer,
  Gauge,
  Zap,
  Download,
  FileText,
  Database,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import AddModuleDialog from "./AddModuleDialog";
import AddSensorDialog from "./AddSensorDialog";
import ConfigurationDialog from "./ConfigurationDialog";
import { ModuleInitializer } from "@/utils/moduleInitializer";
import { ConfigLoader } from "@/utils/configLoader";

// Define types for database entities
interface DatabaseModule {
  id: string;
  name: string;
  status: "online" | "warning" | "critical" | "offline";
  module_type: string;
  created_at: string;
  updated_at: string;
}

interface DatabaseSensor {
  id: string;
  module_id: string;
  name: string;
  sensor_type: string;
  unit: string;
  min_value: number;
  max_value: number;
  status: "online" | "warning" | "critical" | "offline";
  data_pattern: "sine" | "noise" | "square";
  created_at: string;
  updated_at: string;
}

interface SensorReading {
  id: string;
  sensor_id: string;
  value: number;
  timestamp: string;
}

interface ModuleWithSensors {
  id: string;
  name: string;
  status: "online" | "warning" | "critical" | "offline";
  sensors: {
    id: string;
    name: string;
    unit: string;
    status: "online" | "warning" | "critical" | "offline";
    min_value: number;
    max_value: number;
    data_pattern: string;
    latest_value: number | null;
  }[];
}

const PLCDashboard: React.FC = () => {
  const [modules, setModules] = useState<ModuleWithSensors[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected" | "connecting"
  >("connecting");
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isSimulationRunning, setIsSimulationRunning] = useState(false);
  const [updateLock, setUpdateLock] = useState(false);

  // Retry mechanism with exponential backoff
  const retryWithBackoff = useCallback(async (fn: () => Promise<any>, maxRetries = 3) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
        console.warn(`⚠️ Attempt ${i + 1} failed, retrying in ${delay}ms...`, error);
        
        if (i === maxRetries - 1) throw error; // Last attempt, throw error
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }, []);

  // Stable ref for retry function to avoid useEffect dependencies issues
  const retryWithBackoffRef = useRef(retryWithBackoff);
  retryWithBackoffRef.current = retryWithBackoff;

  // Fetch modules and sensors from Supabase
  const fetchModulesAndSensors = useCallback(async () => {
    try {
      console.log('🔄 Fetching modules and sensors data...');
      
      // Fetch modules with retry
      const modulesData = await retryWithBackoffRef.current(async () => {
        const { data, error } = await supabase
          .from("plc_modules")
          .select("*")
          .order("name");

        if (error) {
          console.error('❌ Error fetching modules:', error);
          throw error;
        }
        return data;
      });
      
      console.log('✅ Modules fetched successfully:', modulesData?.length, 'modules');

      // Fetch sensors with their latest readings using retry
      const sensorsData = await retryWithBackoffRef.current(async () => {
        const { data, error } = await supabase
          .from("sensors")
          .select(
            `
            id,
            module_id,
            name,
            unit,
            status,
            min_value,
            max_value,
            data_pattern
          `
          )
          .order("name");

        if (error) {
          console.error('❌ Error fetching sensors:', error);
          throw error;
        }
        return data;
      });
      
      console.log('✅ Sensors fetched successfully:', sensorsData?.length, 'sensors');

      // Fetch latest sensor readings with retry
      const sensorIds = sensorsData?.map((s) => s.id) || [];
      console.log('🔍 Fetching readings for', sensorIds.length, 'sensors');
      
      const readingsData = await retryWithBackoffRef.current(async () => {
        const { data, error } = await supabase
          .from("sensor_readings")
          .select("sensor_id, value, timestamp")
          .in("sensor_id", sensorIds)
          .order("timestamp", { ascending: false });

        if (error) {
          console.error('❌ Error fetching sensor readings:', error);
          throw error;
        }
        return data;
      });
      
      console.log('✅ Sensor readings fetched successfully:', readingsData?.length, 'readings');

      // Get latest reading for each sensor
      const latestReadings = new Map();
      readingsData?.forEach((reading) => {
        if (!latestReadings.has(reading.sensor_id)) {
          latestReadings.set(reading.sensor_id, reading);
        }
      });

      // Combine modules with their sensors and latest readings
      const modulesWithSensors: ModuleWithSensors[] =
        modulesData?.map((module) => ({
          id: module.id,
          name: module.name,
          status: module.status as
            | "online"
            | "warning"
            | "critical"
            | "offline",
          sensors:
            sensorsData
              ?.filter((sensor) => sensor.module_id === module.id)
              .map((sensor) => ({
                id: sensor.id,
                name: sensor.name,
                unit: sensor.unit,
                status: sensor.status as
                  | "online"
                  | "warning"
                  | "critical"
                  | "offline",
                min_value: sensor.min_value,
                max_value: sensor.max_value,
                data_pattern: sensor.data_pattern,
                latest_value: latestReadings.get(sensor.id)?.value || null,
              })) || [],
        })) || [];

      setModules(modulesWithSensors);
      setConnectionStatus("connected");
      setLastUpdate(new Date());
      console.log('✅ Data fetch completed successfully at', new Date().toLocaleTimeString());
    } catch (error) {
      console.error("❌ Critical error fetching data:", error);
      console.error("Error details:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      setConnectionStatus("disconnected");
    }
  }, []);


  const updateLockRef = useRef(false);
  const startSimulationRef = useRef<() => Promise<void>>();
  const fetchModulesAndSensorsRef = useRef<() => Promise<void>>();

  // Test Supabase connectivity
  const testSupabaseConnection = useCallback(async () => {
    try {
      console.log('🔗 Testing Supabase connectivity...');
      const result = await retryWithBackoffRef.current(async () => {
        const { data, error } = await supabase
          .from("plc_modules")
          .select("count", { count: "exact", head: true });
        
        if (error) throw error;
        return data;
      });
      
      console.log('✅ Supabase connectivity test passed, module count:', result);
      return true;
    } catch (error) {
      console.error('❌ Supabase connectivity test failed after retries:', error);
      return false;
    }
  }, []);

  // Fallback function to generate data directly in frontend
  const generateDataFallback = useCallback(async () => {
    console.log('🔄 Using fallback data generation...');
    
    try {
      // Get all online sensors (without pattern_config column that may not exist)
      const { data: sensors, error: sensorsError } = await supabase
        .from('sensors')
        .select('id, data_pattern, min_value, max_value')
        .eq('status', 'online');

      if (sensorsError) throw sensorsError;
      if (!sensors || sensors.length === 0) {
        console.log('No online sensors found for fallback');
        return;
      }

      const currentTime = Date.now();
      const readings = [];

      // Generate sensor readings
      for (let i = 0; i < sensors.length; i++) {
        const sensor = sensors[i];
        
        // Use sensor-specific config based on min/max values
        const range = sensor.max_value - sensor.min_value;
        const midpoint = sensor.min_value + (range / 2);
        
        // Create unique configuration for each sensor
        const sensorHash = sensor.id.split('-')[0]; // Use part of UUID for uniqueness
        const sensorSeed = parseInt(sensorHash.substring(0, 8), 16) || i; // Convert to number
        
        const config = {
          amplitude: range * 0.3, // 30% of range as amplitude
          frequency: 0.001 + (sensorSeed % 100) * 0.00001, // Slightly different frequencies
          phase_offset: (sensorSeed % 628) / 100, // Unique phase offset based on sensor ID
          dc_offset: midpoint // Center the wave around midpoint
        };

        // Add sensor-type specific variations
        let typeMultiplier = 1;
        let noiseLevel = 0.2;
        let value;
        
        switch (sensor.data_pattern) {
          case 'sine':
            // Temperature sensors: smooth sine waves
            typeMultiplier = 1.0;
            value = config.amplitude * Math.sin(config.frequency * currentTime + config.phase_offset) + config.dc_offset;
            break;
          case 'noise':
            // Pressure sensors: sine wave with significant noise
            typeMultiplier = 0.8;
            noiseLevel = 0.3;
            const sineBase = config.amplitude * typeMultiplier * Math.sin(config.frequency * currentTime + config.phase_offset) + config.dc_offset;
            // Use sensor ID to seed random for consistent but different noise per sensor
            const randomSeed = (sensorSeed + Math.floor(currentTime / 1000)) % 1000;
            const pseudoRandom = (Math.sin(randomSeed * 12.9898) * 43758.5453) % 1;
            const noise = (pseudoRandom - 0.5) * config.amplitude * noiseLevel;
            value = sineBase + noise;
            break;
          case 'square':
            // Vibration monitors: digital square waves
            typeMultiplier = 0.9;
            const squareWave = Math.sin(config.frequency * currentTime + config.phase_offset) > 0 ? 1 : -1;
            value = config.dc_offset + (squareWave * config.amplitude * typeMultiplier);
            break;
          default:
            // Random values with sensor-specific seed
            const randomSeed2 = (sensorSeed + Math.floor(currentTime / 5000)) % 1000;
            const pseudoRandom2 = (Math.sin(randomSeed2 * 12.9898) * 43758.5453) % 1;
            value = sensor.min_value + pseudoRandom2 * (sensor.max_value - sensor.min_value);
        }

        // Clamp to min/max
        const originalValue = value;
        value = Math.max(sensor.min_value, Math.min(sensor.max_value, value));
        value = Math.round(value * 100) / 100; // Round to 2 decimal places

        // Debug logging for different sensor types
        if (i < 3) { // Log first 3 sensors to see variety
          console.log(`🔧 Sensor ${i} (${sensor.data_pattern}): value=${value.toFixed(2)}, seed=${sensorSeed}, phase=${config.phase_offset.toFixed(3)}, freq=${config.frequency.toFixed(6)}`);
        }

        readings.push({
          sensor_id: sensor.id,
          value,
          timestamp: new Date().toISOString()
        });
      }

      // Insert readings directly
      const { error: insertError } = await supabase
        .from('sensor_readings')
        .insert(readings);

      if (insertError) throw insertError;

      console.log(`✅ Fallback generated ${readings.length} sensor readings`);
      return { readings: readings.length };
    } catch (error) {
      console.error('❌ Fallback data generation failed:', error);
      throw error;
    }
  }, []);

  const startSimulation = useCallback(async () => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] startSimulation called`);
    
    if (updateLockRef.current) {
      console.log('Simulation already running, skipping...');
      return;
    }
    
    updateLockRef.current = true;
    setUpdateLock(true);
    
    try {
      setIsSimulationRunning(true);
      
      console.log(`[${timestamp}] 🚀 Invoking plc-data-simulator function`);
      
      let result;
      try {
        // Try edge function first
        const { data, error } = await supabase.functions.invoke("plc-data-simulator");
        
        if (error) {
          console.error(`[${timestamp}] ❌ Simulation function error:`, error);
          console.error(`[${timestamp}] Error details:`, {
            message: error.message,
            status: error.status,
            statusText: error.statusText,
            name: error.name,
            context: error.context
          });
          throw error;
        }
        
        result = data;
        console.log(`[${timestamp}] ✅ Edge function succeeded:`, result);
      } catch (edgeFunctionError) {
        console.warn(`[${timestamp}] 🔧 Edge function failed, using fallback data generation`);
        result = await generateDataFallback();
      }
      
      setLastUpdate(new Date());
      console.log(`[${timestamp}] ✅ Simulation completed successfully:`, result);
    } catch (error) {
      console.error("Error starting simulation:", error);
    } finally {
      setIsSimulationRunning(false);
      updateLockRef.current = false;
      setUpdateLock(false);
    }
  }, [generateDataFallback]);

  // Export functions for data download
  const exportSensorData = useCallback(async (format: 'csv' | 'json', days: number = 7) => {
    try {
      console.log(`📁 Exporting sensor data in ${format} format for last ${days} days`);
      
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      // Fetch sensor readings with sensor and module details
      const { data: readings, error } = await supabase
        .from('sensor_readings')
        .select(`
          id,
          value,
          timestamp,
          sensors!inner (
            id,
            name,
            sensor_type,
            unit,
            plc_modules!inner (
              name
            )
          )
        `)
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())
        .order('timestamp', { ascending: false })
        .limit(10000); // Limit to prevent huge downloads

      if (error) throw error;

      if (!readings || readings.length === 0) {
        alert('No data found for the selected date range');
        return;
      }

      // Transform data for export
      const exportData = readings.map(reading => ({
        timestamp: new Date(reading.timestamp).toLocaleString(),
        module_name: reading.sensors.plc_modules.name,
        sensor_name: reading.sensors.name,
        sensor_type: reading.sensors.sensor_type,
        value: reading.value,
        unit: reading.sensors.unit
      }));

      if (format === 'csv') {
        downloadCSV(exportData);
      } else {
        downloadJSON(exportData);
      }

      console.log(`✅ Successfully exported ${readings.length} records`);
    } catch (error) {
      console.error('❌ Error exporting data:', error);
      alert('Failed to export data. Please try again.');
    }
  }, []);

  const downloadCSV = (data: any[]) => {
    if (data.length === 0) return;
    
    // Create CSV headers
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          // Escape values that contain commas or quotes
          return typeof value === 'string' && (value.includes(',') || value.includes('"'))
            ? `"${value.replace(/"/g, '""')}"`
            : value;
        }).join(',')
      )
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `plc_sensor_data_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadJSON = (data: any[]) => {
    const jsonContent = JSON.stringify({
      export_date: new Date().toISOString(),
      record_count: data.length,
      data: data
    }, null, 2);

    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `plc_sensor_data_${new Date().toISOString().split('T')[0]}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Update refs with current function references
  startSimulationRef.current = startSimulation;
  fetchModulesAndSensorsRef.current = fetchModulesAndSensors;

  useEffect(() => {
    const initializeSystem = async () => {
      await ModuleInitializer.initializeFromConfig();
      if (fetchModulesAndSensorsRef.current) {
        fetchModulesAndSensorsRef.current();
      }
    };

    initializeSystem();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("sensor-readings-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sensor_readings",
        },
        () => {
          console.log('Real-time update detected - new sensor readings inserted');
          // Don't immediately refetch data to avoid appearing like 1-second updates
          // Let the timer-based interval handle the UI updates for consistent timing
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Auto-generate sensor data based on config interval with thread-safe operations
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    let isActive = true;
    const effectId = Math.random().toString(36).substr(2, 9);

    const setupInterval = async () => {
      try {
        const updateInterval = await ConfigLoader.getUpdateInterval();
        console.log(`[Effect ${effectId}] Setting up interval with ${updateInterval}ms delay`);
        
        if (!isActive) return; // Component unmounted during async operation

        // Wait a bit to ensure refs are set
        setTimeout(() => {
          if (!isActive) return;
          
          intervalId = setInterval(async () => {
            if (isActive && startSimulationRef.current && fetchModulesAndSensorsRef.current) {
              console.log(`[Effect ${effectId}] Timer triggered - calling startSimulation()`);
              await startSimulationRef.current();
              // Refetch data after simulation completes to update UI with new values
              if (isActive) {
                console.log(`[Effect ${effectId}] Timer - refetching data after simulation`);
                fetchModulesAndSensorsRef.current();
              }
            } else {
              console.warn(`[Effect ${effectId}] Timer triggered but refs not available`);
            }
          }, updateInterval);

          console.log(`[Effect ${effectId}] Interval created with ID: ${intervalId}`);

          // Start immediately if refs are available
          if (startSimulationRef.current && fetchModulesAndSensorsRef.current) {
            console.log(`[Effect ${effectId}] Starting simulation immediately`);
            (async () => {
              if (startSimulationRef.current) {
                await startSimulationRef.current();
                if (isActive && fetchModulesAndSensorsRef.current) {
                  console.log(`[Effect ${effectId}] Initial - refetching data after simulation`);
                  fetchModulesAndSensorsRef.current();
                }
              }
            })();
          } else {
            console.warn(`[Effect ${effectId}] Cannot start immediately - refs not available`);
          }
        }, 100); // Small delay to ensure refs are set
        
      } catch (error) {
        console.error('Error setting up update interval:', error);
      }
    };

    setupInterval();

    return () => {
      console.log(`[Effect ${effectId}] Cleaning up interval with ID: ${intervalId}`);
      isActive = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []); // No dependencies to prevent multiple intervals

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "online":
        return <CheckCircle className="h-4 w-4 text-status-online" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-status-warning" />;
      case "critical":
        return <AlertTriangle className="h-4 w-4 text-status-critical" />;
      default:
        return <Power className="h-4 w-4 text-status-offline" />;
    }
  };

  const getSensorIcon = (index: number) => {
    const icons = [Thermometer, Gauge, Zap];
    const Icon = icons[index % icons.length];
    return <Icon className="h-4 w-4" />;
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "online":
        return "default";
      case "warning":
        return "secondary";
      case "critical":
        return "destructive";
      default:
        return "outline";
    }
  };

  const totalSensors = modules.reduce(
    (acc, module) => acc + module.sensors.length,
    0
  );
  const onlineSensors = modules.reduce(
    (acc, module) =>
      acc + module.sensors.filter((s) => s.status === "online").length,
    0
  );
  const warningSensors = modules.reduce(
    (acc, module) =>
      acc + module.sensors.filter((s) => s.status === "warning").length,
    0
  );

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <img
              src="/Beltways_Favicon.jpg"
              alt="Beltways Logo"
              className="h-8 w-8 rounded object-contain"
            />
            <div>
              <h1 className="text-3xl font-bold text-foreground">PLC Server</h1>
              <p className="text-muted-foreground">
                Industrial Automation Control System - Real-time Data
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Wifi className="h-4 w-4 text-status-online" />
              <Badge
                variant={getStatusBadgeVariant(connectionStatus)}
                className="bg-gradient-status"
              >
                {connectionStatus.toUpperCase()}
              </Badge>
            </div>
            {/* <Button
              variant="outline"
              size="sm"
              onClick={testSupabaseConnection}
              className="text-xs"
            >
              Test Connection
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchModulesAndSensors}
              className="text-xs"
            >
              Refresh Data
            </Button> */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs">
                  <Download className="h-3 w-3 mr-1" />
                  Export Data
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Export Format</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => exportSensorData('csv', 1)}>
                  <FileText className="h-3 w-3 mr-2" />
                  CSV - Last 24 hours
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportSensorData('csv', 7)}>
                  <FileText className="h-3 w-3 mr-2" />
                  CSV - Last 7 days
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportSensorData('csv', 30)}>
                  <FileText className="h-3 w-3 mr-2" />
                  CSV - Last 30 days
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => exportSensorData('json', 1)}>
                  <Database className="h-3 w-3 mr-2" />
                  JSON - Last 24 hours
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportSensorData('json', 7)}>
                  <Database className="h-3 w-3 mr-2" />
                  JSON - Last 7 days
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportSensorData('json', 30)}>
                  <Database className="h-3 w-3 mr-2" />
                  JSON - Last 30 days
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {/* <Button
              variant="outline"
              size="sm"
              onClick={startSimulation}
              className="text-xs"
            >
              Run Simulation
            </Button> */}
            <AddModuleDialog onModuleAdded={fetchModulesAndSensors} />
            {/* <ConfigurationDialog onConfigChanged={fetchModulesAndSensors} /> */}
          </div>
        </div>
        <Separator className="mt-4" />
      </div>

      {/* System Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="bg-gradient-panel shadow-panel border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Modules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {modules.length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-panel shadow-panel border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Sensors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-status-online">
              {onlineSensors}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-panel shadow-panel border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Warnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-status-warning">
              {warningSensors}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-panel shadow-panel border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Last Update
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-mono text-foreground">
              {lastUpdate.toLocaleTimeString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modules Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {modules.map((module) => (
          <Card
            key={module.id}
            className="bg-gradient-panel shadow-panel border-border"
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  {getStatusIcon(module.status)}
                  <span>{module.name}</span>
                </CardTitle>
                <div className="flex items-center space-x-2">
                  <AddSensorDialog
                    moduleId={module.id}
                    moduleName={module.name}
                    onSensorAdded={fetchModulesAndSensors}
                  />
                  <Badge variant={getStatusBadgeVariant(module.status)}>
                    {module.status}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {module.sensors.map((sensor, index) => (
                  <div key={sensor.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getSensorIcon(index)}
                        <span className="text-sm font-medium">
                          {sensor.name}
                        </span>
                      </div>
                      <Badge variant={getStatusBadgeVariant(sensor.status)}>
                        {sensor.status}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-lg font-mono">
                        {sensor.latest_value !== null
                          ? `${sensor.latest_value.toFixed(2)} ${sensor.unit}`
                          : `-- ${sensor.unit}`}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {sensor.data_pattern}
                      </div>
                    </div>

                    {/* Value Bar */}
                    {sensor.latest_value !== null && (
                      <>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${
                              sensor.status === "online"
                                ? "bg-gradient-sensor"
                                : sensor.status === "warning"
                                ? "bg-status-warning"
                                : "bg-status-critical"
                            }`}
                            style={{
                              width: `${Math.max(
                                0,
                                Math.min(
                                  100,
                                  ((sensor.latest_value - sensor.min_value) /
                                    (sensor.max_value - sensor.min_value)) *
                                    100
                                )
                              )}%`,
                            }}
                          />
                        </div>

                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>
                            {sensor.min_value} {sensor.unit}
                          </span>
                          <span>
                            {sensor.max_value} {sensor.unit}
                          </span>
                        </div>
                      </>
                    )}

                    {index < module.sensors.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Connection Status Indicator */}
      <div className="fixed bottom-4 right-4">
        <Card className="bg-gradient-panel shadow-status border-border">
          <CardContent className="p-3">
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4 text-status-online animate-pulse-glow" />
              <span className="text-sm font-medium">
                {connectionStatus === "connected"
                  ? "Real-time Active"
                  : "Connecting..."}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PLCDashboard;
