import { createSocket, Socket } from 'dgram';
import { SmartBulb, BulbConfig, BulbStatus } from './smartbulb.js';

export interface DiscoveredBulb {
  ip: string;
  port: number;
  name?: string;
  model?: string;
  firmwareVersion?: string;
  macAddress?: string;
}

export class BulbDiscovery {
  private discoverySocket: Socket;
  private discoveredBulbs: Map<string, DiscoveredBulb> = new Map();
  private managedBulbs: Map<string, SmartBulb> = new Map();

  constructor() {
    this.discoverySocket = createSocket('udp4');
    this.setupDiscoverySocket();
  }

  private setupDiscoverySocket(): void {
    this.discoverySocket.on('message', (msg, rinfo) => {
      try {
        const response = JSON.parse(msg.toString());
        if (response.type === 'discovery_response') {
          const bulb: DiscoveredBulb = {
            ip: rinfo.address,
            port: rinfo.port,
            ...response.data
          };
          
          const key = `${bulb.ip}:${bulb.port}`;
          this.discoveredBulbs.set(key, bulb);
          console.log(`Discovered bulb: ${key}`, bulb);
        }
      } catch (error) {
        // Ignore non-JSON responses
      }
    });

    this.discoverySocket.on('error', (error) => {
      console.error('Discovery socket error:', error);
    });

    // Bind to a random port for discovery
    this.discoverySocket.bind(() => {
      this.discoverySocket.setBroadcast(true);
    });
  }

  async discoverBulbs(timeout: number = 5000): Promise<DiscoveredBulb[]> {
    return new Promise((resolve) => {
      this.discoveredBulbs.clear();

      // Send discovery broadcast
      const discoveryMessage = JSON.stringify({
        type: 'discovery',
        command: 'discover'
      });

      // Broadcast to common IoT ports
      const broadcastPorts = [4000, 4001, 4002, 8000, 8080];
      const broadcastIP = '255.255.255.255';

      broadcastPorts.forEach(port => {
        this.discoverySocket.send(
          discoveryMessage,
          port,
          broadcastIP,
          (error) => {
            if (error) {
              console.error(`Failed to send discovery to port ${port}:`, error);
            }
          }
        );
      });

      // Also try specific subnet broadcast (assumes 192.168.1.x)
      const subnetBroadcast = '192.168.1.255';
      broadcastPorts.forEach(port => {
        this.discoverySocket.send(
          discoveryMessage,
          port,
          subnetBroadcast,
          (error) => {
            if (error) {
              console.error(`Failed to send discovery to ${subnetBroadcast}:${port}:`, error);
            }
          }
        );
      });

      setTimeout(() => {
        resolve(Array.from(this.discoveredBulbs.values()));
      }, timeout);
    });
  }

  async connectToBulb(ip: string, port: number): Promise<SmartBulb> {
    const key = `${ip}:${port}`;
    
    if (this.managedBulbs.has(key)) {
      return this.managedBulbs.get(key)!;
    }

    const bulb = new SmartBulb({ ip, port });
    this.managedBulbs.set(key, bulb);

    // Test connection
    try {
      await bulb.ping();
      console.log(`Successfully connected to bulb at ${key}`);
    } catch (error) {
      console.warn(`Failed to ping bulb at ${key}, but keeping connection:`, error);
    }

    return bulb;
  }

  getBulb(ip: string, port: number): SmartBulb | undefined {
    const key = `${ip}:${port}`;
    return this.managedBulbs.get(key);
  }

  getAllManagedBulbs(): SmartBulb[] {
    return Array.from(this.managedBulbs.values());
  }

  async getAllBulbStatuses(): Promise<Array<{ config: BulbConfig; status: BulbStatus }>> {
    const statuses = await Promise.allSettled(
      this.getAllManagedBulbs().map(async (bulb) => ({
        config: bulb.getConfig(),
        status: await bulb.getStatus()
      }))
    );

    return statuses
      .filter((result): result is PromiseFulfilledResult<{ config: BulbConfig; status: BulbStatus }> => 
        result.status === 'fulfilled'
      )
      .map(result => result.value);
  }

  getDiscoveredBulbs(): DiscoveredBulb[] {
    return Array.from(this.discoveredBulbs.values());
  }

  disconnectBulb(ip: string, port: number): void {
    const key = `${ip}:${port}`;
    const bulb = this.managedBulbs.get(key);
    
    if (bulb) {
      bulb.close();
      this.managedBulbs.delete(key);
      console.log(`Disconnected from bulb at ${key}`);
    }
  }

  disconnectAllBulbs(): void {
    for (const [key, bulb] of this.managedBulbs) {
      bulb.close();
      console.log(`Disconnected from bulb at ${key}`);
    }
    this.managedBulbs.clear();
  }

  close(): void {
    this.disconnectAllBulbs();
    this.discoverySocket.close();
  }
} 