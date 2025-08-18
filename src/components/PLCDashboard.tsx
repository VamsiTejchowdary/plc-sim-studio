import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Activity, 
  Settings, 
  Power, 
  Wifi, 
  AlertTriangle, 
  CheckCircle,
  Thermometer,
  Gauge,
  Zap
} from 'lucide-react';

interface SensorData {
  id: string;
  name: string;
  value: number;
  unit: string;
  status: 'online' | 'warning' | 'critical' | 'offline';
  min: number;
  max: number;
  pattern: 'sinusoidal' | 'noisy_sinusoidal' | 'square_wave';
}

interface ModuleData {
  id: string;
  name: string;
  status: 'online' | 'warning' | 'critical' | 'offline';
  sensors: SensorData[];
}

const PLCDashboard: React.FC = () => {
  const [modules, setModules] = useState<ModuleData[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connected');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Simulate PLC modules with sensors
  useEffect(() => {
    const generateInitialData = (): ModuleData[] => {
      return Array.from({ length: 4 }, (_, moduleIndex) => ({
        id: `module_${moduleIndex + 1}`,
        name: `Module ${moduleIndex + 1}`,
        status: Math.random() > 0.1 ? 'online' : 'warning',
        sensors: Array.from({ length: 3 }, (_, sensorIndex) => ({
          id: `Module${moduleIndex + 1}_Sensor${sensorIndex + 1}`,
          name: `Module${moduleIndex + 1}_Sensor${sensorIndex + 1}`,
          value: Math.random() * 100,
          unit: ['°C', 'bar', 'Hz'][sensorIndex],
          status: Math.random() > 0.05 ? 'online' : 'warning',
          min: [0, 0, 0][sensorIndex],
          max: [150, 10, 60][sensorIndex],
          pattern: ['sinusoidal', 'noisy_sinusoidal', 'square_wave'][sensorIndex] as any
        }))
      }));
    };

    setModules(generateInitialData());
  }, []);

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setModules(prevModules => 
        prevModules.map(module => ({
          ...module,
          sensors: module.sensors.map(sensor => {
            let newValue;
            const time = Date.now() / 1000;
            
            switch (sensor.pattern) {
              case 'sinusoidal':
                newValue = 50 + 30 * Math.sin(time * 0.5 + Math.random() * 0.1);
                break;
              case 'noisy_sinusoidal':
                newValue = 50 + 30 * Math.sin(time * 0.3) + (Math.random() - 0.5) * 10;
                break;
              case 'square_wave':
                newValue = Math.sin(time * 0.4) > 0 ? 80 : 20;
                break;
              default:
                newValue = sensor.value;
            }

            return {
              ...sensor,
              value: Math.max(sensor.min, Math.min(sensor.max, newValue))
            };
          })
        }))
      );
      setLastUpdate(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online': return <CheckCircle className="h-4 w-4 text-status-online" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-status-warning" />;
      case 'critical': return <AlertTriangle className="h-4 w-4 text-status-critical" />;
      default: return <Power className="h-4 w-4 text-status-offline" />;
    }
  };

  const getSensorIcon = (index: number) => {
    const icons = [Thermometer, Gauge, Zap];
    const Icon = icons[index];
    return <Icon className="h-4 w-4" />;
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'online': return 'default';
      case 'warning': return 'secondary';
      case 'critical': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Beltway PLC Server</h1>
            <p className="text-muted-foreground">Industrial Automation Control System</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Wifi className="h-4 w-4 text-status-online" />
              <Badge variant={getStatusBadgeVariant(connectionStatus)} className="bg-gradient-status">
                {connectionStatus.toUpperCase()}
              </Badge>
            </div>
            <Button variant="outline" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <Separator className="mt-4" />
      </div>

      {/* System Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="bg-gradient-panel shadow-panel border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Modules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{modules.length}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-panel shadow-panel border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Sensors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-status-online">
              {modules.reduce((acc, module) => 
                acc + module.sensors.filter(s => s.status === 'online').length, 0
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-panel shadow-panel border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Warnings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-status-warning">
              {modules.reduce((acc, module) => 
                acc + module.sensors.filter(s => s.status === 'warning').length, 0
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-panel shadow-panel border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Last Update</CardTitle>
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
          <Card key={module.id} className="bg-gradient-panel shadow-panel border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  {getStatusIcon(module.status)}
                  <span>{module.name}</span>
                </CardTitle>
                <Badge variant={getStatusBadgeVariant(module.status)}>
                  {module.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {module.sensors.map((sensor, index) => (
                  <div key={sensor.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getSensorIcon(index)}
                        <span className="text-sm font-medium">{sensor.name}</span>
                      </div>
                      <Badge variant={getStatusBadgeVariant(sensor.status)}>
                        {sensor.status}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="text-lg font-mono">
                        {sensor.value.toFixed(2)} {sensor.unit}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {sensor.pattern}
                      </div>
                    </div>
                    
                    {/* Value Bar */}
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                          sensor.status === 'online' ? 'bg-gradient-sensor' :
                          sensor.status === 'warning' ? 'bg-status-warning' :
                          'bg-status-critical'
                        }`}
                        style={{ 
                          width: `${((sensor.value - sensor.min) / (sensor.max - sensor.min)) * 100}%` 
                        }}
                      />
                    </div>
                    
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{sensor.min} {sensor.unit}</span>
                      <span>{sensor.max} {sensor.unit}</span>
                    </div>
                    
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
              <span className="text-sm font-medium">Real-time Active</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PLCDashboard;