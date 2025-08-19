const fs = require("fs");
const path = require("path");

class ConfigLoader {
  static config = null;

  static async loadConfig() {
    if (this.config) {
      return this.config;
    }

    try {
      const configPath = path.join(process.cwd(), "public", "plc-config.json");
      console.log("Loading config from:", configPath);

      const configData = fs.readFileSync(configPath, "utf8");
      this.config = JSON.parse(configData);
      console.log("Successfully loaded config");
      return this.config;
    } catch (error) {
      console.error("Error loading PLC configuration:", error);
      console.log("Falling back to default config");
      return this.getDefaultConfig();
    }
  }

  static getDefaultConfig() {
    return {
      plc_server: {
        name: "Beltway PLC Server",
        update_interval: 5000,
        connection: {
          database_url: "https://vmojbnsdljjdnqzotmuz.supabase.co",
          api_key:
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtb2pibnNkbGpqZG5xem90bXV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1NDI1NzcsImV4cCI6MjA3MTExODU3N30.iJBX5qdrG3p9UxWcTkrDXxist6-Hus9AYUPE0uJ-7RQ",
          timeout: 30000,
          retry_attempts: 3,
        },
        modules: {
          count: 5,
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
                  status: "online",
                  pattern_config: {
                    amplitude: 30,
                    frequency: 0.001,
                    phase_offset: 0,
                    dc_offset: 50,
                  },
                },
                {
                  name: "Pressure Sensor",
                  type: "pressure",
                  unit: "bar",
                  min_value: 0,
                  max_value: 10,
                  data_pattern: "noise",
                  status: "online",
                  pattern_config: {
                    amplitude: 5,
                    frequency: 0.002,
                    phase_offset: 1.57,
                    dc_offset: 5,
                  },
                },
                {
                  name: "Vibration Monitor",
                  type: "vibration",
                  unit: "Hz",
                  min_value: 0,
                  max_value: 50,
                  data_pattern: "square",
                  status: "online",
                  pattern_config: {
                    amplitude: 25,
                    frequency: 0.003,
                    phase_offset: 3.14,
                    dc_offset: 25,
                  },
                },
              ],
            },
          ],
        },
      },
    };
  }
}

module.exports = { ConfigLoader };
