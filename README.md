# Beltway PLC Server

## Project Overview

A Mock PLC (Programmable Logic Controller) Server that simulates an industrial automation system with modular sensor components. This system provides real-time monitoring and data visualization for industrial automation environments.

## Features

- **Modular Architecture**: Configurable PLC server with multiple industrial modules
- **Real-time Data Simulation**: Continuous sensor data generation with configurable patterns
- **Live Dashboard**: Real-time visualization of sensor readings and system status
- **Historical Data Storage**: Persistent storage of all sensor readings with timestamps
- **Multiple Sensor Types**: Temperature, Pressure, and Vibration monitoring

## How to run this project

Requirements: Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

### Local Development Setup

```sh
# Clone the repository
git clone

# Navigate to project directory
cd beltway-plc-server

# Install dependencies
npm install

# Start development server
npm run dev
```

### Supabase Setup

1. Create a Supabase project at https://supabase.com
2. Copy your project URL and anon key to `.env` file
3. Run the database migrations in the `supabase/migrations/` folder
4. Deploy the edge function: `supabase functions deploy plc-data-simulator`

## Technology Stack

**Frontend:**
- React 18 with TypeScript
- Vite for build tooling
- shadcn/ui component library
- Tailwind CSS for styling
- Recharts for data visualization

**Backend:**
- Supabase (PostgreSQL database)
- Supabase Edge Functions (Deno runtime)
- Real-time subscriptions


### Database Schema
- `plc_modules`: Industrial modules (Production Line, Quality Control, etc.)
- `sensors`: Individual sensors per module (Temperature, Pressure, Vibration)
- `sensor_readings`: Time-series data storage

### Data Simulation Patterns
- **Sine Wave**: Smooth oscillating values for temperature sensors
- **Noisy Sine**: Sine wave with random variations for pressure sensors  
- **Square Wave**: Digital on/off patterns for vibration monitoring

## Development Timeline & Demo

### **2:40 PM - 3:00 PM: Project Foundation**
- Used Lovable AI to create base structure for PLC Dashboard due to time constraints
- Set up initial React TypeScript project with shadcn/ui components
- Created database tables and schema using Lovable (previously created manually for Beltways alarm assignment)
- Established Supabase integration for real-time data management

### **3:00 PM - 3:45 PM: Modular PLC Server Architecture** ✅
**1. Configurable PLC Server (N modules where N is configurable)**
- ✅ **Done**: Implemented in `src/utils/configLoader.ts` - Loads module count from configuration
- ✅ **Done**: Created `src/utils/moduleInitializer.ts` - Automatically initializes modules if no DB data exists
- ✅ **Done**: Each module represents an independent industrial unit (Production Line, Quality Control, etc.)
- ✅ **Done**: System is easily extensible - Added features for dynamically adding new modules and sensors via UI dialogs (`AddModuleDialog.tsx`, `AddSensorDialog.tsx`)

### **3:45 PM - 4:15 PM: Sensor Data Simulation** ✅
**2. Sensor Data Requirements**
- ✅ **Done**: Each module provides exactly 3 sensor measurements
- ✅ **Done**: Naming convention: Module{X}_Sensor{Y} (e.g., Module1_Sensor1, Module1_Sensor2, Module1_Sensor3)
- ✅ **Done**: Pre-defined patterns with configurable parameters:
  - **Sinusoidal pattern** with amplitude, frequency, phase_offset, dc_offset
  - **Refer to `public/plc-config.json`** for complete configuration structure
  - Supports sine wave, noisy sine, and square wave patterns

### **4:15 PM - 5:30 PM: Configuration & Real-time System** ✅
**3. Configuration System**
- ✅ **Done**: JSON configuration in `public/plc-config.json`
  - Number of modules (configurable count)
  - Per-module sensor configurations with pattern parameters
  - Server connection parameters (database_url, api_key, timeout)
  - Update intervals (5-second default, configurable)

**4. Real-time Data Updates**
- ✅ **Done**: Continuous sensor updates at configurable intervals (`src/components/PLCDashboard.tsx`)
- ✅ **Done**: Proper timestamp management with PostgreSQL timestamps
- ✅ **Done**: Thread-safe operations with update locks and retry mechanisms
- ✅ **Done**: Real-time subscriptions using Supabase real-time features
- ✅ **Done**: Edge function for data generation (`supabase/functions/plc-data-simulator/index.ts`)

### **5:30 PM - 6:15 PM: Issues, Fixes & Bonus Features** ✅
**Major Issues Resolved:**
- Fixed sensor update timing (was updating every 1 second instead of 5 seconds)
- Resolved identical sensor values issue - each sensor now generates unique data patterns
- Implemented fallback data generation when edge function fails
- Added retry mechanisms with exponential backoff for resilience


### AdsServer:
### Runnuing Server: 
-- ADS_LISTEN_ADDR=127.0.0.1 ADS_PORT=49011 npm run dev:server

### Testing Client: 
-- ADS_LISTEN_ADDR=127.0.0.1 ADS_PORT=49011 npm run test:client

### Issue: I am able to make suceesful server connection but not able to test the client connection.


###  npm run demo