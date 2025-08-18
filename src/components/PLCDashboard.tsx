import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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

  // Fetch modules and sensors from Supabase
  const fetchModulesAndSensors = useCallback(async () => {
    try {
      // Fetch modules
      const { data: modulesData, error: modulesError } = await supabase
        .from("plc_modules")
        .select("*")
        .order("name");

      if (modulesError) throw modulesError;

      // Fetch sensors with their latest readings
      const { data: sensorsData, error: sensorsError } = await supabase
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

      if (sensorsError) throw sensorsError;

      // Fetch latest sensor readings
      const sensorIds = sensorsData?.map((s) => s.id) || [];
      const { data: readingsData, error: readingsError } = await supabase
        .from("sensor_readings")
        .select("sensor_id, value, timestamp")
        .in("sensor_id", sensorIds)
        .order("timestamp", { ascending: false });

      if (readingsError) throw readingsError;

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
    } catch (error) {
      console.error("Error fetching data:", error);
      setConnectionStatus("disconnected");
    }
  }, []);


  const updateLockRef = useRef(false);
  const startSimulationRef = useRef<() => Promise<void>>();
  const fetchModulesAndSensorsRef = useRef<() => Promise<void>>();

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
      
      console.log(`[${timestamp}] Invoking plc-data-simulator function`);
      const { error } = await supabase.functions.invoke("plc-data-simulator");
      if (error) throw error;
      
      setLastUpdate(new Date());
      console.log(`[${timestamp}] Simulation completed successfully`);
    } catch (error) {
      console.error("Error starting simulation:", error);
    } finally {
      setIsSimulationRunning(false);
      updateLockRef.current = false;
      setUpdateLock(false);
    }
  }, []); // No dependencies!

  // Update refs with current function references
  startSimulationRef.current = startSimulation;
  fetchModulesAndSensorsRef.current = fetchModulesAndSensors;

  useEffect(() => {
    const initializeSystem = async () => {
      await ModuleInitializer.initializeFromConfig();
      fetchModulesAndSensors();
    };

    initializeSystem();
  }, [fetchModulesAndSensors]);

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

        intervalId = setInterval(async () => {
          if (isActive && startSimulationRef.current && fetchModulesAndSensorsRef.current) {
            console.log(`[Effect ${effectId}] Timer triggered - calling startSimulation()`);
            await startSimulationRef.current();
            // Refetch data after simulation completes to update UI with new values
            if (isActive) {
              console.log(`[Effect ${effectId}] Timer - refetching data after simulation`);
              fetchModulesAndSensorsRef.current();
            }
          }
        }, updateInterval);

        console.log(`[Effect ${effectId}] Interval created with ID: ${intervalId}`);

        // Start immediately if component is still active
        if (isActive && startSimulationRef.current && fetchModulesAndSensorsRef.current) {
          console.log('Starting simulation immediately');
          (async () => {
            await startSimulationRef.current!();
            if (isActive) {
              console.log('Initial - refetching data after simulation');
              fetchModulesAndSensorsRef.current!();
            }
          })();
        }
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
            <AddModuleDialog onModuleAdded={fetchModulesAndSensors} />
            <ConfigurationDialog onConfigChanged={fetchModulesAndSensors} />
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
