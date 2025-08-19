const { Client } = require('ads-client');

const client = new Client({
  targetAmsNetId: '192.168.1.100.1.1',
  targetAdsPort: 48899,
  targetHost: '127.0.0.1',
  routerTcpPort: 48899,
  allowHalfOpen: true,
});

async function test() {
  try {
    console.log('Connecting to ADS server...');
    await client.connect();
    console.log('Connected');

    // Read Module1_Sensor1 (check server logs for indices)
    const data = await client.readRaw(1, 1, 4);
    console.log('Sensor value:', data.readFloatLE());

    // Subscribe to notifications
    const sub = await client.subscribeRaw(1, 1, 4, (data) => {
      console.log('Notification received:', data.readFloatLE());
    }, 1000);
    console.log('Subscribed');

    // Unsubscribe after 10 seconds
    setTimeout(async () => {
      await sub.unsubscribe();
      console.log('Unsubscribed');
      await client.disconnect();
      console.log('Disconnected');
    }, 10000);
  } catch (err) {
    console.error('Test failed:', err);
  }
}

test();