import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AddModuleDialogProps {
  onModuleAdded: () => void;
}

const AddModuleDialog: React.FC<AddModuleDialogProps> = ({ onModuleAdded }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    module_type: 'production',
    status: 'online' as 'online' | 'warning' | 'critical' | 'offline'
  });

  const moduleTypes = [
    { value: 'production', label: 'Production Line' },
    { value: 'quality', label: 'Quality Control' },
    { value: 'packaging', label: 'Packaging System' },
    { value: 'warehouse', label: 'Warehouse Control' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'safety', label: 'Safety Systems' },
    { value: 'custom', label: 'Custom Module' }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Module name is required');
      return;
    }

    setLoading(true);
    
    try {
      const { error } = await supabase
        .from('plc_modules')
        .insert([{
          name: formData.name.trim(),
          module_type: formData.module_type,
          status: formData.status
        }]);

      if (error) throw error;

      toast.success('Module added successfully');
      setFormData({ name: '', module_type: 'production', status: 'online' });
      setOpen(false);
      onModuleAdded();
    } catch (error) {
      console.error('Error adding module:', error);
      toast.error('Failed to add module');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center space-x-2">
          <Plus className="h-4 w-4" />
          <span>Add Module</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New PLC Module</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Module Name</Label>
            <Input
              id="name"
              placeholder="e.g., Production Line 2"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="module_type">Module Type</Label>
            <Select
              value={formData.module_type}
              onValueChange={(value) => setFormData({ ...formData, module_type: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select module type" />
              </SelectTrigger>
              <SelectContent>
                {moduleTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
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
              {loading ? 'Adding...' : 'Add Module'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddModuleDialog;