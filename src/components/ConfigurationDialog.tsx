import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Settings, RefreshCw, Download } from 'lucide-react';
import { ConfigLoader, PLCConfig } from '@/utils/configLoader';
import { ModuleInitializer } from '@/utils/moduleInitializer';
import { toast } from 'sonner';

interface ConfigurationDialogProps {
  onConfigChanged: () => void;
}

const ConfigurationDialog: React.FC<ConfigurationDialogProps> = ({ onConfigChanged }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<PLCConfig | null>(null);
  const [moduleCount, setModuleCount] = useState(4);
  const [updateInterval, setUpdateInterval] = useState(5000);
  const [autoGenerate, setAutoGenerate] = useState(true);

  useEffect(() => {
    if (open) {
      loadCurrentConfig();
    }
  }, [open]);

  const loadCurrentConfig = async () => {
    try {
      console.log('Loading configuration...');
      const currentConfig = await ConfigLoader.loadConfig();
      console.log('Loaded config:', currentConfig);
      
      setConfig(currentConfig);
      setModuleCount(currentConfig.plc_server.modules.count);
      setUpdateInterval(currentConfig.plc_server.update_interval);
      setAutoGenerate(currentConfig.plc_server.modules.auto_generate);
      
      toast.success('Configuration loaded successfully');
    } catch (error) {
      console.error('Error loading config:', error);
      toast.error('Failed to load configuration');
    }
  };

  const handleReinitialize = async () => {
    setLoading(true);
    try {
      // Update the runtime configuration
      ConfigLoader.updateRuntimeConfig({
        moduleCount,
        updateInterval,
        autoGenerate
      });

      // Reset and reinitialize with new settings
      await ModuleInitializer.resetAndReinitialize();
      onConfigChanged();
      setOpen(false);
      
      toast.success(`Applied new settings: ${moduleCount} modules, ${updateInterval}ms interval`);
    } catch (error) {
      console.error('Error reinitializing:', error);
      toast.error('Failed to apply configuration changes');
    } finally {
      setLoading(false);
    }
  };

  const downloadConfig = () => {
    if (!config) return;
    
    const updatedConfig = {
      ...config,
      plc_server: {
        ...config.plc_server,
        modules: {
          ...config.plc_server.modules,
          count: moduleCount,
          auto_generate: autoGenerate
        },
        update_interval: updateInterval
      }
    };

    const dataStr = JSON.stringify(updatedConfig, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'plc-config.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    toast.success('Configuration downloaded');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>PLC Server Configuration</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="moduleCount">Number of Modules (N)</Label>
              <Input
                id="moduleCount"
                type="number"
                min="1"
                max="20"
                value={moduleCount}
                onChange={(e) => setModuleCount(parseInt(e.target.value) || 1)}
              />
              <p className="text-xs text-muted-foreground">
                Configure how many modules the PLC server should simulate
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="updateInterval">Update Interval (ms)</Label>
              <Input
                id="updateInterval"
                type="number"
                min="1000"
                max="60000"
                step="1000"
                value={updateInterval}
                onChange={(e) => setUpdateInterval(parseInt(e.target.value) || 5000)}
              />
              <p className="text-xs text-muted-foreground">
                How often sensor values should update (milliseconds)
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="autoGenerate"
                checked={autoGenerate}
                onCheckedChange={setAutoGenerate}
              />
              <Label htmlFor="autoGenerate">Auto-generate modules on startup</Label>
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-3">Current Configuration</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Modules:</span>
                <span>{config?.plc_server.modules.count || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Templates:</span>
                <span>{config?.plc_server.modules.templates.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Update Interval:</span>
                <span>{config?.plc_server.update_interval || 0}ms</span>
              </div>
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <div className="space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={downloadConfig}
                disabled={!config}
              >
                <Download className="h-4 w-4 mr-1" />
                Download Config
              </Button>
            </div>
            
            <div className="space-x-2">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  console.log('Test button clicked');
                  toast.success('Configuration dialog is working!');
                }}
                disabled={loading}
              >
                Test
              </Button>
              <Button
                onClick={handleReinitialize}
                disabled={loading}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Reinitializing...' : 'Apply & Reinitialize'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ConfigurationDialog;