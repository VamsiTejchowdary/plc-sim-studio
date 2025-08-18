export interface PatternConfig {
    amplitude: number;
    frequency: number;
    phase_offset: number;
    dc_offset: number;
}

export interface SensorConfig {
    name: string;
    type: string;
    unit: string;
    min_value: number;
    max_value: number;
    data_pattern: 'sine' | 'noise' | 'square';
    status: 'online' | 'warning' | 'critical' | 'offline';
    pattern_config?: PatternConfig;
}

export interface ModuleTemplate {
    name: string;
    type: string;
    status: 'online' | 'warning' | 'critical' | 'offline';
    sensors: SensorConfig[];
}

export interface PLCConfig {
    plc_server: {
        name: string;
        update_interval: number;
        modules: {
            count: number;
            auto_generate: boolean;
            templates: ModuleTemplate[];
        };
    };
}

export class ConfigLoader {
    private static config: PLCConfig | null = null;

    static async loadConfig(): Promise<PLCConfig> {
        if (this.config) {
            return this.config;
        }

        try {
            const response = await fetch('/config/plc-config.json');
            if (!response.ok) {
                throw new Error(`Failed to load config: ${response.statusText}`);
            }

            this.config = await response.json();
            return this.config!;
        } catch (error) {
            console.error('Error loading PLC configuration:', error);
            // Return default config if file not found
            return this.getDefaultConfig();
        }
    }

    static getDefaultConfig(): PLCConfig {
        return {
            plc_server: {
                name: "Beltway PLC Server",
                update_interval: 5000,
                modules: {
                    count: 4,
                    auto_generate: true,
                    templates: [
                        {
                            name: "Production Line {index}",
                            type: "production",
                            status: "online",
                            sensors: [
                                {
                                    name: "Temperature Sensor",
                                    type: "temperature",
                                    unit: "°C",
                                    min_value: 20,
                                    max_value: 80,
                                    data_pattern: "sine",
                                    status: "online"
                                },
                                {
                                    name: "Pressure Sensor",
                                    type: "pressure",
                                    unit: "bar",
                                    min_value: 0,
                                    max_value: 10,
                                    data_pattern: "noise",
                                    status: "online"
                                },
                                {
                                    name: "Vibration Monitor",
                                    type: "vibration",
                                    unit: "Hz",
                                    min_value: 0,
                                    max_value: 50,
                                    data_pattern: "square",
                                    status: "online"
                                }
                            ]
                        }
                    ]
                }
            }
        };
    }

    static generateModuleName(template: string, index: number): string {
        return template.replace('{index}', (index + 1).toString());
    }

    static generateSensorName(template: string, moduleIndex: number): string {
        return template.replace('{index}', (moduleIndex + 1).toString());
    }

    static async getModuleCount(): Promise<number> {
        const config = await this.loadConfig();
        return config.plc_server.modules.count;
    }

    static async getUpdateInterval(): Promise<number> {
        const config = await this.loadConfig();
        return config.plc_server.update_interval;
    }

    static async shouldAutoGenerate(): Promise<boolean> {
        const config = await this.loadConfig();
        return config.plc_server.modules.auto_generate;
    }
}