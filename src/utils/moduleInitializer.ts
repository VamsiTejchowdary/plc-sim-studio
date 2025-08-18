import { supabase } from '@/integrations/supabase/client';
import { ConfigLoader, ModuleTemplate } from './configLoader';
import { toast } from 'sonner';

export class ModuleInitializer {
  static async initializeFromConfig(): Promise<void> {
    try {
      const config = await ConfigLoader.loadConfig();
      const shouldAutoGenerate = await ConfigLoader.shouldAutoGenerate();

      if (!shouldAutoGenerate) {
        console.log('Auto-generation disabled in config');
        return;
      }

      // Check if modules already exist
      const { data: existingModules, error: checkError } = await supabase
        .from('plc_modules')
        .select('id')
        .limit(1);

      if (checkError) {
        console.error('Error checking existing modules:', checkError);
        return;
      }

      // If modules already exist, don't auto-generate
      if (existingModules && existingModules.length > 0) {
        console.log('Modules already exist, skipping auto-generation');
        return;
      }

      console.log('Initializing PLC modules from configuration...');

      const moduleCount = config.plc_server.modules.count;
      const templates = config.plc_server.modules.templates;

      for (let i = 0; i < moduleCount; i++) {
        const templateIndex = i % templates.length;
        const template = templates[templateIndex];

        await this.createModuleFromTemplate(template, i);
      }

      toast.success(`Initialized ${moduleCount} modules from configuration`);

    } catch (error) {
      console.error('Error initializing modules from config:', error);
      toast.error('Failed to initialize modules from configuration');
    }
  }

  private static async createModuleFromTemplate(template: ModuleTemplate, index: number): Promise<void> {
    try {
      // Create module
      const moduleName = ConfigLoader.generateModuleName(template.name, index);

      const { data: moduleData, error: moduleError } = await supabase
        .from('plc_modules')
        .insert([{
          name: moduleName,
          module_type: template.type,
          status: template.status
        }])
        .select()
        .single();

      if (moduleError) throw moduleError;

      console.log(`Created module: ${moduleName}`);

      // Create sensors for this module
      const sensorsToInsert = template.sensors.map(sensor => ({
        module_id: moduleData.id,
        name: ConfigLoader.generateSensorName(sensor.name, index),
        sensor_type: sensor.type,
        unit: sensor.unit,
        min_value: sensor.min_value,
        max_value: sensor.max_value,
        status: sensor.status,
        data_pattern: sensor.data_pattern,
        pattern_config: sensor.pattern_config || {
          amplitude: 50,
          frequency: 0.001,
          phase_offset: 0,
          dc_offset: 50
        }
      }));

      const { error: sensorsError } = await supabase
        .from('sensors')
        .insert(sensorsToInsert);

      if (sensorsError) throw sensorsError;

      console.log(`Created ${template.sensors.length} sensors for ${moduleName}`);

    } catch (error) {
      console.error(`Error creating module from template:`, error);
      throw error;
    }
  }

  static async resetAndReinitialize(): Promise<void> {
    try {
      // Delete all existing data
      await supabase.from('sensor_readings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('sensors').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('plc_modules').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      // Reinitialize from config
      await this.initializeFromConfig();

      toast.success('System reset and reinitialized from configuration');
    } catch (error) {
      console.error('Error resetting system:', error);
      toast.error('Failed to reset system');
    }
  }
}