#!/usr/bin/env node

import { SmartBulb } from './smartbulb.js';
import { BulbDiscovery } from './discovery.js';

async function testSmartBulb() {
  console.log('Smart Bulb Test Client');
  console.log('=====================\n');

  const discovery = new BulbDiscovery();
  
  try {
    // Test discovery
    console.log('1. Discovering bulbs...');
    const discoveredBulbs = await discovery.discoverBulbs(3000);
    console.log(`Found ${discoveredBulbs.length} bulbs:`);
    discoveredBulbs.forEach(bulb => {
      console.log(`  - ${bulb.ip}:${bulb.port} (${bulb.name || 'Unknown'})`);
    });
    console.log();

    // Connect to default bulb
    const bulbIP = process.env.BULB_IP || '192.168.1.45';
    const bulbPort = parseInt(process.env.BULB_PORT || '4000');
    
    console.log(`2. Connecting to bulb at ${bulbIP}:${bulbPort}...`);
    const bulb = await discovery.connectToBulb(bulbIP, bulbPort);
    
    // Test ping
    console.log('3. Testing connection...');
    const pingResult = await bulb.ping();
    console.log(`   Ping result: ${pingResult ? 'SUCCESS' : 'FAILED'}`);
    
    if (!pingResult) {
      console.log('   Warning: Ping failed, but continuing with tests...');
    }
    console.log();

    // Get initial status
    console.log('4. Getting initial status...');
    const initialStatus = await bulb.getStatus();
    console.log('   Status:', JSON.stringify(initialStatus, null, 2));
    console.log();

    // Test power control
    console.log('5. Testing power control...');
    console.log('   Turning bulb ON...');
    await bulb.turnOn();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('   Turning bulb OFF...');
    await bulb.turnOff();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('   Turning bulb ON again...');
    await bulb.turnOn();
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log();

    // Test brightness
    console.log('6. Testing brightness control...');
    const brightnessLevels = [25, 50, 75, 100];
    for (const brightness of brightnessLevels) {
      console.log(`   Setting brightness to ${brightness}%...`);
      await bulb.setBrightness(brightness);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log();

    // Test colors
    console.log('7. Testing color control...');
    const colors = [
      { name: 'Red', r: 255, g: 0, b: 0 },
      { name: 'Green', r: 0, g: 255, b: 0 },
      { name: 'Blue', r: 0, g: 0, b: 255 },
      { name: 'White', r: 255, g: 255, b: 255 },
    ];
    
    for (const color of colors) {
      console.log(`   Setting color to ${color.name} (${color.r}, ${color.g}, ${color.b})...`);
      await bulb.setColor(color.r, color.g, color.b);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    console.log();

    // Test hex colors
    console.log('8. Testing hex color control...');
    const hexColors = ['#FF00FF', '#FFFF00', '#00FFFF', '#FFFFFF'];
    for (const hex of hexColors) {
      console.log(`   Setting color to ${hex}...`);
      await bulb.setColorHex(hex);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    console.log();

    // Get final status
    console.log('9. Getting final status...');
    const finalStatus = await bulb.getStatus();
    console.log('   Status:', JSON.stringify(finalStatus, null, 2));
    console.log();

    console.log('✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    discovery.close();
  }
}

// Run tests
if (import.meta.url === `file://${process.argv[1]}`) {
  testSmartBulb().catch(console.error);
} 