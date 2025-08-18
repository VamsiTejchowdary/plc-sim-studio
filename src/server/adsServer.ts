
import { Server } from 'ads-server';
import { readFileSync } from 'fs';
import { resolve } from 'path';


function loadConfig() {
  const configPath = resolve(__dirname, '../../public/plc-config.json');
  const raw = readFileSync(configPath, 'utf-8');
  return JSON.parse(raw);
}


function sinePattern(t: number, cfg: any) {
  return cfg.amplitude * Math.sin(cfg.frequency * t + cfg.phase_offset) + cfg.dc_offset;
}

const config = loadConfig();
const updateInterval = config.plc_server.update_interval || 1000;
const modules = [];

for (let i = 0; i < config.plc_server.modules.count; i++) {
  const templateIdx = i % config.plc_server.modules.templates.length;
  const template = config.plc_server.modules.templates[templateIdx];
  const moduleName = template.name.replace('{index}', String(i + 1));
  const sensors = template.sensors.map((sensor, idx) => {
    const sensorName = sensor.name.replace('{index}', String(i + 1));
    return {
      name: sensorName,
      type: sensor.type,
      unit: sensor.unit,
      pattern: sensor.data_pattern,
      patternConfig: sensor.pattern_config,
      value: 0,
      timestamp: Date.now()
    };
  });
  modules.push({ name: moduleName, sensors });
}


const server = new Server({
  localAdsPort: 30012
});


function updateSensors() {
  const t = Date.now();
  modules.forEach(module => {
    module.sensors.forEach(sensor => {
      if (sensor.pattern === 'sine') {
        sensor.value = sinePattern(t, sensor.patternConfig);
      }

      sensor.timestamp = t;
    });
  });
}

setInterval(updateSensors, updateInterval);


server.connect()
  .then(async conn => {
    console.log('Connected to ADS:', conn);

    server.onReadReq(async (req, res) => {

      const sensorIndex = req.indexOffset;
      let sensor;
      let flatIndex = 0;
      for (const module of modules) {
        for (const s of module.sensors) {
          if (flatIndex === sensorIndex) {
            sensor = s;
            break;
          }
          flatIndex++;
        }
        if (sensor) break;
      }
      if (sensor) {
        const data = Buffer.alloc(4);
        data.writeFloatLE(sensor.value);
        await res({ data });
        console.log(`Read request for ${sensor.name}: ${sensor.value}`);
      } else {
        await res({ error: 1793 });
        console.log(`Read request for unknown sensor index: ${sensorIndex}`);
      }
    });

    // Listen for Write requests (optional, for demo)
    server.onWriteReq(async (req, res) => {
      const sensorIndex = req.indexOffset;
      let sensor;
      let flatIndex = 0;
      for (const module of modules) {
        for (const s of module.sensors) {
          if (flatIndex === sensorIndex) {
            sensor = s;
            break;
          }
          flatIndex++;
        }
        if (sensor) break;
      }
      if (sensor) {
        // For demo, just log the write request
        console.log(`Write request received for ${sensor.name}`);
        await res({});
      } else {
        await res({ error: 1793 });
        console.log(`Write request for unknown sensor index: ${sensorIndex}`);
      }
    });

    // Listen for ReadDeviceInfo requests
    server.onReadDeviceInfo(async (req, res) => {
      await res({
        deviceName: 'Mock PLC Server',
        majorVersion: 1,
        minorVersion: 0,
        versionBuild: 1
      });
    });

    // Listen for ReadState requests
    server.onReadState(async (req, res) => {
      await res({
        adsState: 5, // Config state
        deviceState: 123
      });
    });
  })
  .catch(err => {
    console.error('ADS connection failed:', err);
  });