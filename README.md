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
git clone <YOUR_GIT_URL>

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

## System Architecture

### Database Schema
- `plc_modules`: Industrial modules (Production Line, Quality Control, etc.)
- `sensors`: Individual sensors per module (Temperature, Pressure, Vibration)
- `sensor_readings`: Time-series data storage

### Data Simulation Patterns
- **Sine Wave**: Smooth oscillating values for temperature sensors
- **Noisy Sine**: Sine wave with random variations for pressure sensors  
- **Square Wave**: Digital on/off patterns for vibration monitoring

## Demo

The dashboard displays:
- Real-time sensor readings updated every 5 seconds
- System status indicators and connection monitoring
- Historical data visualization with progress bars
- Module-based organization of sensor data

## Assessment Completion

This implementation covers the core requirements of the Mock PLC Server assignment:
- ✅ Modular architecture with configurable modules
- ✅ Real-time sensor data simulation
- ✅ Multiple data patterns (sine, noise, square)
- ✅ Dashboard with live visualization
- ✅ Historical data storage
- ✅ Timestamp management and real-time updates
