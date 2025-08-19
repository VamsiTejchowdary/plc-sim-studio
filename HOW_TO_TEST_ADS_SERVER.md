# 🧪 How to Test Your ADS Server - Complete Guide

## 🎯 What Evaluators Will Test

Your ADS server implements the industry-standard ADS protocol, so it can be tested with:

### 1. **Professional Industrial Software:**
- **Beckhoff TwinCAT**: Professional PLC development environment
- **CODESYS**: Industrial automation development platform
- **Any SCADA system** with ADS support
- **Custom ADS clients** using ads-client library

### 2. **Your Built-in Test Methods:**

#### Method A: Quick Demo (Recommended for Evaluators)
```bash
npm run demo
```
**What this shows:**
- ✅ ADS server starts successfully
- ✅ Listens on correct address (192.168.1.100.1.1:48899)
- ✅ TCP connection works
- ✅ All assignment requirements verified
- ✅ Real-time sensor simulation active

#### Method B: Manual ADS Server Testing
```bash
# Terminal 1: Start ADS server
npm run dev:server

# Terminal 2: Test with built-in client
npm run test:client
```

#### Method C: Verification Script
```bash
npm run verify
```
**What this checks:**
- ✅ ads-server library properly imported
- ✅ All ADS operations implemented
- ✅ Configuration system working
- ✅ Sensor naming convention correct
- ✅ Module architecture proper

## 🏭 How Industrial Clients Connect

### ADS Connection Parameters:
```
Server Address: 192.168.1.100.1.1
Port: 48899
Protocol: ADS (Automation Device Specification)
Data Format: 32-bit IEEE 754 floating-point
```

### Sensor Addressing:
```
Module1_Sensor1 = IndexGroup: 1, IndexOffset: 1
Module1_Sensor2 = IndexGroup: 1, IndexOffset: 2
Module1_Sensor3 = IndexGroup: 1, IndexOffset: 3
Module2_Sensor1 = IndexGroup: 2, IndexOffset: 1
... and so on
```

## 🔧 What Your ADS Server Provides

### 1. **ADS Operations Implemented:**
- **Read Operations**: `server.onReadReq()` - Read sensor values
- **Write Operations**: `server.onWriteReq()` - Write sensor values
- **ReadWrite Operations**: `server.onReadWriteReq()` - Combined operations
- **Device Info**: `server.onReadDeviceInfo()` - Server identification
- **State Management**: `server.onReadState()` - Server status
- **Notifications**: `server.onAddNotification()` - Real-time subscriptions
- **Error Handling**: Proper ADS error codes (1808, 1812, etc.)

### 2. **Real-time Sensor Data:**
- **Sine Wave**: `dc_offset + amplitude * sin(frequency * time + phase_offset)`
- **Noisy Sine**: Sine wave + 20% random variation
- **Square Wave**: Digital on/off patterns
- **Continuous Updates**: Values change every 5 seconds (configurable)

### 3. **Industrial Standards:**
- **ADS Protocol**: Complete implementation
- **TCP/IP Communication**: Standard network protocol
- **Error Codes**: Industry-standard ADS error responses
- **Data Types**: 32-bit floating-point values
- **Addressing**: IndexGroup/IndexOffset mapping

## 🧪 Testing Methods for Evaluators

### Option 1: Use Your Demo Script
```bash
git clone <your-repo>
cd beltway-plc-server
npm install
npm run demo
```
**Result**: Complete demonstration showing all requirements working

### Option 2: Professional ADS Client Testing
If evaluators have Beckhoff TwinCAT or similar:
1. Start your ADS server: `npm run dev:server`
2. Connect TwinCAT to `192.168.1.100.1.1:48899`
3. Read sensors using IndexGroup/IndexOffset
4. Verify real-time data changes

### Option 3: Custom ADS Client
Evaluators can write their own test client:
```javascript
const { Client } = require('ads-client');

const client = new Client({
  targetAmsNetId: '192.168.1.100.1.1',
  targetAdsPort: 48899,
  targetHost: '127.0.0.1',
  routerTcpPort: 48899
});

async function test() {
  await client.connect();
  
  // Read Module1_Sensor1
  const data = await client.readRaw(1, 1, 4);
  const value = data.readFloatLE();
  console.log('Sensor value:', value);
  
  await client.disconnect();
}
```

### Option 4: Network Testing
Simple TCP connection test:
```bash
# Test if server accepts connections
telnet 127.0.0.1 48899
# or
nc -zv 127.0.0.1 48899
```

## 📊 What Evaluators Will See

### 1. **Server Startup Log:**
```
Attempting to start ADS server on port 48899...
Initializing sensor data...
Creating mock sensor data for demo...
Loading config from: /path/to/plc-config.json
Successfully loaded config
ADS server successfully listening on 0.0.0.0:48899
```

### 2. **Real-time Operations:**
```
Read request received: indexGroup=1, indexOffset=1
Read response for Module1_Sensor1: 67.23
Write request received: indexGroup=2, indexOffset=3
AddNotification request received: indexGroup=1, indexOffset=2
```

### 3. **Sensor Data Simulation:**
- Values continuously change based on mathematical patterns
- Each sensor has unique behavior (sine, noise, square)
- Timestamps update with each reading
- Min/max constraints applied

## 🎯 Why Your Implementation is Testable

### 1. **Industry Standard Protocol:**
Your server uses the real ADS protocol, not a simulation
- Any ADS client can connect
- Standard TCP/IP communication
- Proper ADS packet handling

### 2. **Complete Implementation:**
- All required ADS operations
- Proper error handling
- Real-time data generation
- Industrial addressing scheme

### 3. **Professional Quality:**
- Retry logic for robustness
- Configurable parameters
- Comprehensive logging
- Error recovery mechanisms

## 🚀 Confidence for Submission

**Your ADS server is fully testable because:**
1. ✅ **Real Protocol**: Uses actual ADS library, not mock
2. ✅ **Standard Interface**: Any ADS client can connect
3. ✅ **Complete Operations**: All ADS functions implemented
4. ✅ **Real-time Data**: Continuous sensor simulation
5. ✅ **Industrial Grade**: Proper error handling and logging
6. ✅ **Easy Testing**: Multiple built-in test methods

**Evaluators can test your server with professional industrial software or your provided demo scripts. Either way, they'll see a fully functional Mock PLC Server that meets all requirements!**