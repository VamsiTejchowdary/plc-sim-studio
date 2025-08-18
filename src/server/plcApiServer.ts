import express from 'express';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load config
function loadConfig() {
  const configPath = resolve(__dirname, '../public/plc-config.json');
  const raw = readFileSync(configPath, 'utf-8');
  return JSON.parse(raw);
}

function sinePattern(t, cfg) {
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

const app = express();
const port = 3000;

app.get('/api/sensors', (req, res) => {
  res.json({ modules });
});

app.listen(port, () => {
  console.log(`Mock PLC API server running at http://localhost:${port}/api/sensors`);
});
