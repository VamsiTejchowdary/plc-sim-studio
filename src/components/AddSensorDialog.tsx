import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AddSensorDialogProps {
  moduleId: string;
  moduleName: string;
  onSensorAdded: () => void;
}

const AddSensorDialog: React.FC<AddSensorDialogProps> = ({ moduleId, moduleName, onSensorAdded }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    sensor_type: 'temperature',
    unit: '°C',
    min_value: 0,
    max_value: 100,
    status: 'online' as 'online' | 'warning' | 'critical' | 'offline',
    data_pattern: 'sine' as 'sine' | 'noise' | 'square'
  });

  const sensorTypes = [
    { value: 'temperature', label: 'Temperature', unit: '°C', min: 0, max: 100 },
    { value: 'pressure', label: 'Pressure', unit: 'bar', min: 0, max: 10 },
    { value: 'vibration', label: 'Vibration', unit: 'Hz', min: 0, max: 50 },
    { value: 'humidity', label: 'Humidity', unit: '%', min: 0, max: 100 },
    { value: 'flow', label: 'Flow Rate', unit: 'L/min', min: 0, max: 1000 },
    { value: 'voltage', label: 'Voltage', unit: 'V', min: 0, max: 240 },
    { value: 'current', label: 'Current', unit: 'A', min: 0, max: 50 },
    { value: 'speed', label: 'Speed', unit: 'RPM', min: 0, max: 3000 }
  ];

  const dataPatterns = [
    { value: 'sine', label: 'Sine Wave', description: 'Smooth oscillating pattern' },
    { value: 'noise', label: 'Noisy Sine', description: 'Sine wave with random variations' },
    { value: 'square', label: 'Square Wave', description: 'Digital on/off pattern' }
  ];

  const handleSensorTypeChange = (sensorType: string) => {
    const selectedType = sensorTypes.find(type => type.value === sensorType);
    if (selectedType) {
      setFormData({
        ...formData,
        sensor_type: sensorType,
        unit: selectedType.unit,
        min_value: selectedType.min,
        max_value: selectedType.max
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Sensor name is required');
      return;
    }

    if (formData.min_value >= formData.max_value) {
      toast.error('Maximum value must be greater than minimum value');
      return;
    }

    setLoading(true);
    
    try {
      const { error } = await supabase
        .from('sensors')
        .insert([{
          module_id: moduleId,
          name: formData.name.trim(),
          sensor_type: formData.sensor_type,
          unit: formData.unit,
          min_value: formData.min_value,
          max_value: formData.max_value,
          status: formData.status,
          data_pattern: formData.data_pattern
        }]);

      if (error) throw error;

      toast.success('Sensor added successfully');
      setFormData({
        name: '',
        sensor_type: 'temperature',
        unit: '°C',
        min_value: 0,
        max_value: 100,
        status: 'online',
        data_pattern: 'sine'
      });
      setOpen(false);
      onSensorAdded();
    } catch (error) {
      console.error('Error adding sensor:', error);
      toast.error('Failed to add sensor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center space-x-1">
          <Plus className="h-3 w-3" />
          <span>Add Sensor</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Sensor to {moduleName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Sensor Name</Label>
            <Input
              id="name"
              placeholder="e.g., Temperature Sensor 1"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="sensor_type">Sensor Type</Label>
            <Select
              value={formData.sensor_type}
              onValueChange={handleSensorTypeChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select sensor type" />
              </SelectTrigger>
              <SelectContent>
                {sensorTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label} ({type.unit})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="min_value">Min Value</Label>
              <Input
                id="min_value"
                type="number"
                value={formData.min_value}
                onChange={(e) => setFormData({ ...formData, min_value: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_value">Max Value</Label>
              <Input
                id="max_value"
                type="number"
                value={formData.max_value}
                onChange={(e) => setFormData({ ...formData, max_value: parseFloat(e.target.value) || 100 })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="unit">Unit</Label>
            <Input
              id="unit"
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="data_pattern">Data Pattern</Label>
            <Select
              value={formData.data_pattern}
              onValueChange={(value) => setFormData({ ...formData, data_pattern: value as any })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select data pattern" />
              </SelectTrigger>
              <SelectContent>
                {dataPatterns.map((pattern) => (
                  <SelectItem key={pattern.value} value={pattern.value}>
                    <div>
                      <div className="font-medium">{pattern.label}</div>
                      <div className="text-xs text-muted-foreground">{pattern.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Initial Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value as any })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="offline">Offline</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Sensor'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddSensorDialog;