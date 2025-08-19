
const { StandAloneServer, ADS } = require('ads-server');
const { ConfigLoader } = require('./configLoader');

// Optional Supabase integration
let supabase: any = null;
try {
  supabase = require('../integrations/supabase/client').supabase;
} catch (err) {
  console.log('Supabase not available, using mock data only');
}

// Interface for sensor data in memory
interface SensorData {
  id: string;
  module_id: string;
  name: string;
  data_pattern: 'sine' | 'noise' | 'square';
  pattern_config: {
    amplitude: number;
    frequency: number;
    phase_offset: number;
    dc_offset: number;
  };
  min_value: number | null;
  max_value: number | null;
  value: number;
  timestamp: Date;
}

// Maps for UUID to numeric index conversion
const moduleIdToIndex = new Map<string, number>();
const sensorIdToIndex = new Map<string, number>();
const sensorDataMap: { [key: string]: SensorData } = {};

// Map to store notification subscribers
interface NotificationSubscriber {
  notificationHandle: number;
  targetAmsNetId: string;
  targetAdsPort: number;
  indexGroup: number;
  indexOffset: number;
  cycleTime: number;
  lastSendTime: number;
}
let subscribers: NotificationSubscriber[] = [];
let nextHandle = 1;

// Generate sensor value based on pattern and config
function generateSensorValue(sensor: SensorData): number {
  const time = Date.now() / 1000; // Time in seconds
  let value: number;

  const { amplitude, frequency, phase_offset, dc_offset } = sensor.pattern_config;

  switch (sensor.data_pattern) {
    case 'sine':
      value = dc_offset + amplitude * Math.sin(frequency * time + phase_offset);
      break;
    case 'noise':
      value = dc_offset + amplitude * Math.sin(frequency * time + phase_offset) + (Math.random() - 0.5) * amplitude * 0.2;
      break;
    case 'square':
      value = dc_offset + (Math.sin(frequency * time + phase_offset) > 0 ? amplitude : -amplitude);
      break;
    default:
      value = dc_offset;
  }

  // Apply min/max constraints
  if (sensor.min_value !== null && value < sensor.min_value) value = sensor.min_value;
  if (sensor.max_value !== null && value > sensor.max_value) value = sensor.max_value;

  return value;
}

// Initialize sensor data from Supabase or use mock data
async function initializeSensorData() {
  console.log('Initializing sensor data...');
  
  try {
    // Try to fetch from Supabase first (if available)
    if (supabase) {
      const { data: sensors, error } = await supabase
        .from('sensors')
        .select('id, module_id, name, data_pattern, min_value, max_value');

      if (!error && sensors && sensors.length > 0) {
        let moduleIndex = 1;
        let sensorIndex = 1;
        const moduleIds = new Set<string>();

        sensors.forEach((sensor: any) => {
          if (!moduleIds.has(sensor.module_id)) {
            moduleIds.add(sensor.module_id);
            moduleIdToIndex.set(sensor.module_id, moduleIndex++);
          }
          sensorIdToIndex.set(sensor.id, sensorIndex++);

          const sensorKey = `Module${moduleIdToIndex.get(sensor.module_id)}_Sensor${sensorIdToIndex.get(sensor.id)}`;
          sensorDataMap[sensorKey] = {
            id: sensor.id,
            module_id: sensor.module_id,
            name: sensor.name,
            data_pattern: (sensor.data_pattern as 'sine' | 'noise' | 'square') || 'sine',
            pattern_config: {
              amplitude: 50,
              frequency: 0.001,
              phase_offset: 0,
              dc_offset: 50,
            },
            min_value: sensor.min_value,
            max_value: sensor.max_value,
            value: 0,
            timestamp: new Date(),
          };
        });

        console.log('Initialized sensor data from database:', Object.keys(sensorDataMap));
        updateSensorData();
        return;
      }
    }
    
    // Fallback to mock data
    console.log('Database not available or empty, using mock data for demo...');
    createMockSensorData();
  } catch (err) {
    console.log('Database connection failed, using mock data for demo...');
    createMockSensorData();
  }

  // Update sensor values initially
  updateSensorData();
}

// Create mock sensor data for demo purposes
function createMockSensorData() {
  console.log('Creating mock sensor data for demo...');
  
  for (let module = 1; module <= 5; module++) {
    for (let sensor = 1; sensor <= 3; sensor++) {
      const sensorKey = `Module${module}_Sensor${sensor}`;
      sensorDataMap[sensorKey] = {
        id: `mock-${module}-${sensor}`,
        module_id: `mock-module-${module}`,
        name: sensorKey,
        data_pattern: sensor === 1 ? 'sine' : sensor === 2 ? 'noise' : 'square',
        pattern_config: {
          amplitude: 30 + (sensor * 10),
          frequency: 0.001 + (sensor * 0.0005),
          phase_offset: sensor * 1.57,
          dc_offset: 50 + (sensor * 10),
        },
        min_value: 0,
        max_value: 100,
        value: 0,
        timestamp: new Date(),
      };
    }
  }
}

// Update sensor values periodically
function updateSensorData() {
  Object.values(sensorDataMap).forEach((sensor) => {
    sensor.value = generateSensorValue(sensor);
    sensor.timestamp = new Date();
  });
}

// Start the ADS server
const server = new StandAloneServer({
  localAmsNetId: '192.168.1.100.1.1',
  listeningTcpPort: 48899,
  listeningAddress: '0.0.0.0',
  hideConsoleWarnings: false,
});

// Handle Read requests
server.onReadReq(async (req, res, packet, adsPort) => {
  console.log(`Read request received for port ${adsPort}: indexGroup=${req.indexGroup}, indexOffset=${req.indexOffset}`);
  const sensorKey = `Module${req.indexGroup}_Sensor${req.indexOffset}`;
  
  if (sensorDataMap[sensorKey]) {
    const sensor = sensorDataMap[sensorKey];
    const data = Buffer.alloc(4);
    data.writeFloatLE(sensor.value);
    console.log(`Read response for ${sensorKey}: ${sensor.value}`);
    await res({ data }).catch((err) => console.error('Read response failed:', err));
  } else {
    console.warn(`Symbol not found: ${sensorKey}`);
    await res({ error: 1808 }).catch((err) => console.error('Read response failed:', err)); // Symbol not found
  }
});

// Handle Write requests
server.onWriteReq(async (req, res) => {
  console.log(`Write request received: indexGroup=${req.indexGroup}, indexOffset=${req.indexOffset}, data=${req.data.readFloatLE()}`);
  const sensorKey = `Module${req.indexGroup}_Sensor${req.indexOffset}`;
  
  if (sensorDataMap[sensorKey]) {
    const sensor = sensorDataMap[sensorKey];
    const newValue = req.data.readFloatLE();
    sensor.value = newValue;
    sensor.timestamp = new Date();

    // Persist to Supabase (optional)
    if (supabase) {
      try {
        const { error } = await supabase.from('sensor_readings').insert({
          sensor_id: sensor.id,
          value: newValue,
          timestamp: sensor.timestamp.toISOString(),
        });

        if (error) {
          console.log('Note: Could not persist to database (demo mode)');
        }
      } catch (err) {
        console.log('Note: Database not available (demo mode)');
      }
    }

    await res({}).catch((err) => console.error('Write response failed:', err));
  } else {
    console.warn(`Symbol not found: ${sensorKey}`);
    await res({ error: 1808 }).catch((err) => console.error('Write response failed:', err)); // Symbol not found
  }
});

// Handle ReadWrite requests
server.onReadWriteReq(async (req, res) => {
  console.log(`ReadWrite request received: indexGroup=${req.indexGroup}, indexOffset=${req.indexOffset}`);
  const sensorKey = `Module${req.indexGroup}_Sensor${req.indexOffset}`;
  
  if (sensorDataMap[sensorKey]) {
    const sensor = sensorDataMap[sensorKey];
    const data = Buffer.alloc(4);
    data.writeFloatLE(sensor.value);
    console.log(`ReadWrite response for ${sensorKey}: ${sensor.value}`);
    await res({ data }).catch((err) => console.error('ReadWrite response failed:', err));
  } else {
    console.warn(`Symbol not found: ${sensorKey}`);
    await res({ error: 1808 }).catch((err) => console.error('ReadWrite response failed:', err)); // Symbol not found
  }
});

// Handle ReadDeviceInfo requests
server.onReadDeviceInfo(async (req, res) => {
  console.log('ReadDeviceInfo request received');
  await res({
    deviceName: 'Mock PLC Server',
    majorVersion: 1,
    minorVersion: 0,
    versionBuild: 1,
  }).catch((err) => console.error('ReadDeviceInfo response failed:', err));
});

// Handle ReadState requests
server.onReadState(async (req, res) => {
  console.log('ReadState request received');
  await res({
    adsState: ADS.ADS_STATE.Run,
    deviceState: 0,
  }).catch((err) => console.error('ReadState response failed:', err));
});

// Handle WriteControl requests
server.onWriteControl(async (req, res) => {
  console.log('WriteControl request received:', req);
  await res({}).catch((err) => console.error('WriteControl response failed:', err));
});

// Handle AddNotification requests
server.onAddNotification(async (req, res) => {
  console.log(`AddNotification request received: indexGroup=${req.indexGroup}, indexOffset=${req.indexOffset}`);
  const sensorKey = `Module${req.indexGroup}_Sensor${req.indexOffset}`;
  
  if (sensorDataMap[sensorKey]) {
    const notificationHandle = nextHandle++;
    subscribers.push({
      notificationHandle,
      targetAmsNetId: req.notificationTarget.targetAmsNetId,
      targetAdsPort: req.notificationTarget.targetAdsPort,
      indexGroup: req.indexGroup,
      indexOffset: req.indexOffset,
      cycleTime: req.cycleTime,
      lastSendTime: 0,
    });
    console.log(`Added notification handle ${notificationHandle} for ${sensorKey}`);
    await res({ notificationHandle }).catch((err) => console.error('AddNotification response failed:', err));
  } else {
    console.warn(`Symbol not found: ${sensorKey}`);
    await res({ error: 1808 }).catch((err) => console.error('AddNotification response failed:', err)); // Symbol not found
  }
});

// Handle DeleteNotification requests
server.onDeleteNotification(async (req, res) => {
  console.log(`DeleteNotification request received: handle=${req.notificationHandle}`);
  const subscriber = subscribers.find((sub) => sub.notificationHandle === req.notificationHandle);
  
  if (subscriber) {
    subscribers = subscribers.filter((sub) => sub.notificationHandle !== req.notificationHandle);
    console.log(`Deleted notification handle ${req.notificationHandle}`);
    await res({}).catch((err) => console.error('DeleteNotification response failed:', err));
  } else {
    console.warn(`Invalid notification handle: ${req.notificationHandle}`);
    await res({ error: 1812 }).catch((err) => console.error('DeleteNotification response failed:', err)); // Invalid notification handle
  }
});

// Periodically send notifications
setInterval(async () => {
  for (const sub of subscribers) {
    if (new Date().getTime() - sub.lastSendTime >= sub.cycleTime) {
      const sensorKey = `Module${sub.indexGroup}_Sensor${sub.indexOffset}`;
      const sensor = sensorDataMap[sensorKey];
      if (sensor) {
        const data = Buffer.alloc(4);
        data.writeFloatLE(sensor.value);
        await server.sendDeviceNotification(
          {
            notificationHandle: sub.notificationHandle,
            targetAmsNetId: sub.targetAmsNetId,
            targetAdsPort: sub.targetAdsPort,
            sourceAdsPort: sub.targetAdsPort,
            socket: null,
          },
          data
        ).catch((err) => console.error(`Send notification failed for handle ${sub.notificationHandle}:`, err));
        sub.lastSendTime = new Date().getTime();
      }
    }
  }
}, 100);

// Start the server with retry logic
async function startServer() {
  let retries = 3;
  const ports = [48899, 48900, 48901]; // Fallback ports
  let portIndex = 0;

  while (retries > 0 && portIndex < ports.length) {
    const port = ports[portIndex];
    console.log(`Attempting to start ADS server on port ${port} (attempt ${4 - retries})...`);
    server.settings.listeningTcpPort = port;

    try {
      await initializeSensorData();
      const config = await ConfigLoader.loadConfig();
      const updateInterval = config.plc_server.update_interval || 5000;
      setInterval(updateSensorData, updateInterval);

      await server.listen();
      console.log(`ADS server successfully listening on 0.0.0.0:${port}`);
      return;
    } catch (err) {
      console.error(`Failed to start ADS server on port ${port}:`, err);
      retries--;
      portIndex++;
      if (retries === 0 || portIndex === ports.length) {
        console.error('Max retries reached or no available ports. ADS server failed to start.');
        throw err;
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

startServer().catch((err) => {
  console.error('ADS server startup failed:', err);
  process.exit(1);
});

module.exports = server;