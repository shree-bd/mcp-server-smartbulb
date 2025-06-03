import { createSocket, Socket } from 'dgram';
import { EventEmitter } from 'events';

export interface BulbConfig {
  ip: string;
  port: number;
  timeout?: number;
}

export interface BulbStatus {
  power: boolean;
  brightness: number;
  color: {
    r: number;
    g: number;
    b: number;
  };
  temperature?: number;
  connected: boolean;
}

export interface BulbCommand {
  command: string;
  params?: Record<string, any>;
  id?: string;
}

export interface BulbResponse {
  success: boolean;
  data?: any;
  error?: string;
  id?: string;
}

export class SmartBulb extends EventEmitter {
  private socket: Socket;
  private config: BulbConfig;
  private lastStatus: BulbStatus;
  private pendingCommands: Map<string, {
    resolve: (value: BulbResponse) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();

  constructor(config: BulbConfig) {
    super();
    this.config = {
      timeout: 5000,
      ...config
    };
    
    this.socket = createSocket('udp4');
    this.lastStatus = {
      power: false,
      brightness: 0,
      color: { r: 255, g: 255, b: 255 },
      connected: false
    };

    this.setupSocket();
  }

  private setupSocket(): void {
    this.socket.on('message', (msg, rinfo) => {
      try {
        const response: BulbResponse = JSON.parse(msg.toString());
        this.handleResponse(response);
      } catch (error) {
        console.error('Failed to parse bulb response:', error);
      }
    });

    this.socket.on('error', (error) => {
      console.error('UDP socket error:', error);
      this.emit('error', error);
    });
  }

  private handleResponse(response: BulbResponse): void {
    if (response.id && this.pendingCommands.has(response.id)) {
      const pending = this.pendingCommands.get(response.id)!;
      clearTimeout(pending.timeout);
      this.pendingCommands.delete(response.id);

      if (response.success) {
        pending.resolve(response);
      } else {
        pending.reject(new Error(response.error || 'Unknown error'));
      }
    }

    // Update status if response contains status data
    if (response.data && typeof response.data === 'object') {
      this.updateStatus(response.data);
    }
  }

  private updateStatus(data: Partial<BulbStatus>): void {
    this.lastStatus = { ...this.lastStatus, ...data, connected: true };
    this.emit('statusUpdate', this.lastStatus);
  }

  private generateCommandId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private async sendCommand(command: BulbCommand): Promise<BulbResponse> {
    return new Promise((resolve, reject) => {
      const id = this.generateCommandId();
      const commandWithId = { ...command, id };
      
      const timeout = setTimeout(() => {
        this.pendingCommands.delete(id);
        reject(new Error('Command timeout'));
      }, this.config.timeout);

      this.pendingCommands.set(id, { resolve, reject, timeout });

      const message = Buffer.from(JSON.stringify(commandWithId));
      this.socket.send(message, this.config.port, this.config.ip, (error) => {
        if (error) {
          clearTimeout(timeout);
          this.pendingCommands.delete(id);
          reject(error);
        }
      });
    });
  }

  async turnOn(): Promise<void> {
    await this.sendCommand({
      command: 'set_power',
      params: { power: true }
    });
  }

  async turnOff(): Promise<void> {
    await this.sendCommand({
      command: 'set_power',
      params: { power: false }
    });
  }

  async setBrightness(brightness: number): Promise<void> {
    if (brightness < 0 || brightness > 100) {
      throw new Error('Brightness must be between 0 and 100');
    }

    await this.sendCommand({
      command: 'set_brightness',
      params: { brightness }
    });
  }

  async setColor(r: number, g: number, b: number): Promise<void> {
    if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
      throw new Error('RGB values must be between 0 and 255');
    }

    await this.sendCommand({
      command: 'set_color',
      params: { color: { r, g, b } }
    });
  }

  async setColorHex(hex: string): Promise<void> {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) {
      throw new Error('Invalid hex color format');
    }

    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);

    await this.setColor(r, g, b);
  }

  async getStatus(): Promise<BulbStatus> {
    try {
      const response = await this.sendCommand({
        command: 'get_status'
      });

      if (response.data) {
        this.updateStatus(response.data);
      }

      return this.lastStatus;
    } catch (error) {
      // Return last known status with disconnected flag
      return { ...this.lastStatus, connected: false };
    }
  }

  async ping(): Promise<boolean> {
    try {
      await this.sendCommand({
        command: 'ping'
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  getLastStatus(): BulbStatus {
    return { ...this.lastStatus };
  }

  getConfig(): BulbConfig {
    return { ...this.config };
  }

  close(): void {
    // Clear all pending commands
    for (const [id, pending] of this.pendingCommands) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Connection closed'));
    }
    this.pendingCommands.clear();

    this.socket.close();
  }
} 