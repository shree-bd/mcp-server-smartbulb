#!/usr/bin/env node

import { createSocket, Socket } from 'dgram';

interface MockBulbState {
  power: boolean;
  brightness: number;
  color: {
    r: number;
    g: number;
    b: number;
  };
  temperature?: number;
}

class MockSmartBulb {
  private socket: Socket;
  private state: MockBulbState;
  private port: number;
  private name: string;

  constructor(port: number = 4000, name: string = 'Mock Smart Bulb') {
    this.port = port;
    this.name = name;
    this.socket = createSocket('udp4');
    
    this.state = {
      power: false,
      brightness: 50,
      color: { r: 255, g: 255, b: 255 },
      temperature: 3000
    };

    this.setupSocket();
  }

  private setupSocket(): void {
    this.socket.on('message', (msg, rinfo) => {
      try {
        const request = JSON.parse(msg.toString());
        this.handleRequest(request, rinfo);
      } catch (error) {
        console.error('Failed to parse request:', error);
      }
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    this.socket.bind(this.port, () => {
      console.log(`🔵 Mock Smart Bulb "${this.name}" listening on port ${this.port}`);
      console.log('Initial state:', this.state);
    });
  }

  private handleRequest(request: any, rinfo: any): void {
    console.log(`📨 Received command: ${request.command} from ${rinfo.address}:${rinfo.port}`);
    
    let response: any = {
      success: true,
      id: request.id
    };

    try {
      switch (request.command) {
        case 'ping':
          response.data = { pong: true };
          break;

        case 'discover':
          if (request.type === 'discovery') {
            response = {
              type: 'discovery_response',
              data: {
                name: this.name,
                model: 'MockBulb v1.0',
                firmwareVersion: '1.0.0',
                macAddress: '00:11:22:33:44:55'
              }
            };
          }
          break;

        case 'set_power':
          if (typeof request.params?.power === 'boolean') {
            this.state.power = request.params.power;
            response.data = { power: this.state.power };
            console.log(`💡 Power ${this.state.power ? 'ON' : 'OFF'}`);
          } else {
            throw new Error('Invalid power parameter');
          }
          break;

        case 'set_brightness':
          if (typeof request.params?.brightness === 'number' && 
              request.params.brightness >= 0 && 
              request.params.brightness <= 100) {
            this.state.brightness = request.params.brightness;
            response.data = { brightness: this.state.brightness };
            console.log(`🔆 Brightness set to ${this.state.brightness}%`);
          } else {
            throw new Error('Invalid brightness parameter (must be 0-100)');
          }
          break;

        case 'set_color':
          const color = request.params?.color;
          if (color && 
              typeof color.r === 'number' && color.r >= 0 && color.r <= 255 &&
              typeof color.g === 'number' && color.g >= 0 && color.g <= 255 &&
              typeof color.b === 'number' && color.b >= 0 && color.b <= 255) {
            this.state.color = { r: color.r, g: color.g, b: color.b };
            response.data = { color: this.state.color };
            console.log(`🎨 Color set to RGB(${color.r}, ${color.g}, ${color.b})`);
          } else {
            throw new Error('Invalid color parameter (RGB values must be 0-255)');
          }
          break;

        case 'get_status':
          response.data = {
            ...this.state,
            connected: true
          };
          console.log('📊 Status requested');
          break;

        default:
          throw new Error(`Unknown command: ${request.command}`);
      }

    } catch (error) {
      response.success = false;
      response.error = error instanceof Error ? error.message : String(error);
      console.error(`❌ Command failed: ${response.error}`);
    }

    // Send response
    const responseMsg = Buffer.from(JSON.stringify(response));
    this.socket.send(responseMsg, rinfo.port, rinfo.address, (error) => {
      if (error) {
        console.error('Failed to send response:', error);
      } else {
        console.log(`📤 Response sent to ${rinfo.address}:${rinfo.port}`);
      }
    });
  }

  getCurrentState(): MockBulbState {
    return { ...this.state };
  }

  close(): void {
    this.socket.close();
    console.log(`🔴 Mock Smart Bulb "${this.name}" stopped`);
  }
}

// CLI interface
function main() {
  const port = parseInt(process.argv[2]) || 4000;
  const name = process.argv[3] || 'Mock Smart Bulb';

  console.log('🚀 Starting Mock Smart Bulb Server');
  console.log(`   Name: ${name}`);
  console.log(`   Port: ${port}`);
  console.log('   Press Ctrl+C to stop\n');

  const mockBulb = new MockSmartBulb(port, name);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n👋 Shutting down mock bulb...');
    mockBulb.close();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n👋 Shutting down mock bulb...');
    mockBulb.close();
    process.exit(0);
  });

  // Display current state every 10 seconds
  setInterval(() => {
    console.log('\n📊 Current State:', mockBulb.getCurrentState());
  }, 10000);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
} 