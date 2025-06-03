#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { SmartBulb } from './smartbulb.js';
import { BulbDiscovery } from './discovery.js';

// Configuration
const DEFAULT_BULB_IP = process.env.BULB_IP || '192.168.1.45';
const DEFAULT_BULB_PORT = parseInt(process.env.BULB_PORT || '4000');

// Global instances
const discovery = new BulbDiscovery();
let defaultBulb: SmartBulb | null = null;

// Initialize default bulb
async function initializeDefaultBulb() {
  try {
    defaultBulb = await discovery.connectToBulb(DEFAULT_BULB_IP, DEFAULT_BULB_PORT);
    console.log(`Connected to default bulb at ${DEFAULT_BULB_IP}:${DEFAULT_BULB_PORT}`);
  } catch (error) {
    console.error('Failed to connect to default bulb:', error);
  }
}

// Helper function to get bulb instance
function getBulb(ip?: string, port?: number): SmartBulb {
  if (ip && port) {
    const bulb = discovery.getBulb(ip, port);
    if (!bulb) {
      throw new McpError(ErrorCode.InvalidRequest, `No connection to bulb at ${ip}:${port}`);
    }
    return bulb;
  }
  
  if (!defaultBulb) {
    throw new McpError(ErrorCode.InvalidRequest, 'No default bulb connection available');
  }
  
  return defaultBulb;
}

// Create MCP server
const server = new Server(
  {
    name: 'smartbulb-server',
    version: '1.0.0',
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'turn_on_bulb',
        description: 'Turn on the smart bulb',
        inputSchema: {
          type: 'object',
          properties: {
            ip: {
              type: 'string',
              description: 'IP address of the bulb (optional, uses default if not provided)',
            },
            port: {
              type: 'number',
              description: 'Port number of the bulb (optional, uses default if not provided)',
            },
          },
        },
      },
      {
        name: 'turn_off_bulb',
        description: 'Turn off the smart bulb',
        inputSchema: {
          type: 'object',
          properties: {
            ip: {
              type: 'string',
              description: 'IP address of the bulb (optional, uses default if not provided)',
            },
            port: {
              type: 'number',
              description: 'Port number of the bulb (optional, uses default if not provided)',
            },
          },
        },
      },
      {
        name: 'set_brightness',
        description: 'Set the brightness of the smart bulb (0-100%)',
        inputSchema: {
          type: 'object',
          properties: {
            brightness: {
              type: 'number',
              description: 'Brightness level from 0 to 100',
              minimum: 0,
              maximum: 100,
            },
            ip: {
              type: 'string',
              description: 'IP address of the bulb (optional, uses default if not provided)',
            },
            port: {
              type: 'number',
              description: 'Port number of the bulb (optional, uses default if not provided)',
            },
          },
          required: ['brightness'],
        },
      },
      {
        name: 'set_color',
        description: 'Set the color of the smart bulb using RGB values or hex color',
        inputSchema: {
          type: 'object',
          properties: {
            color: {
              oneOf: [
                {
                  type: 'string',
                  description: 'Hex color code (e.g., #FF0000 for red)',
                  pattern: '^#?[0-9A-Fa-f]{6}$',
                },
                {
                  type: 'object',
                  properties: {
                    r: { type: 'number', minimum: 0, maximum: 255 },
                    g: { type: 'number', minimum: 0, maximum: 255 },
                    b: { type: 'number', minimum: 0, maximum: 255 },
                  },
                  required: ['r', 'g', 'b'],
                  description: 'RGB color object',
                },
              ],
            },
            ip: {
              type: 'string',
              description: 'IP address of the bulb (optional, uses default if not provided)',
            },
            port: {
              type: 'number',
              description: 'Port number of the bulb (optional, uses default if not provided)',
            },
          },
          required: ['color'],
        },
      },
      {
        name: 'get_bulb_status',
        description: 'Get the current status of the smart bulb',
        inputSchema: {
          type: 'object',
          properties: {
            ip: {
              type: 'string',
              description: 'IP address of the bulb (optional, uses default if not provided)',
            },
            port: {
              type: 'number',
              description: 'Port number of the bulb (optional, uses default if not provided)',
            },
          },
        },
      },
      {
        name: 'discover_bulbs',
        description: 'Discover smart bulbs on the network',
        inputSchema: {
          type: 'object',
          properties: {
            timeout: {
              type: 'number',
              description: 'Discovery timeout in milliseconds (default: 5000)',
              default: 5000,
            },
          },
        },
      },
      {
        name: 'connect_to_bulb',
        description: 'Connect to a specific smart bulb',
        inputSchema: {
          type: 'object',
          properties: {
            ip: {
              type: 'string',
              description: 'IP address of the bulb',
            },
            port: {
              type: 'number',
              description: 'Port number of the bulb',
            },
          },
          required: ['ip', 'port'],
        },
      },
      {
        name: 'get_all_bulb_statuses',
        description: 'Get status of all connected smart bulbs',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'turn_on_bulb': {
        const bulb = getBulb(args?.ip as string, args?.port as number);
        await bulb.turnOn();
        return {
          content: [
            {
              type: 'text',
              text: `Successfully turned on bulb at ${bulb.getConfig().ip}:${bulb.getConfig().port}`,
            },
          ],
        };
      }

      case 'turn_off_bulb': {
        const bulb = getBulb(args?.ip as string, args?.port as number);
        await bulb.turnOff();
        return {
          content: [
            {
              type: 'text',
              text: `Successfully turned off bulb at ${bulb.getConfig().ip}:${bulb.getConfig().port}`,
            },
          ],
        };
      }

      case 'set_brightness': {
        if (typeof args?.brightness !== 'number') {
          throw new McpError(ErrorCode.InvalidParams, 'Brightness must be a number between 0 and 100');
        }

        const bulb = getBulb(args?.ip as string, args?.port as number);
        await bulb.setBrightness(args.brightness);
        return {
          content: [
            {
              type: 'text',
              text: `Successfully set brightness to ${args.brightness}% on bulb at ${bulb.getConfig().ip}:${bulb.getConfig().port}`,
            },
          ],
        };
      }

      case 'set_color': {
        if (!args?.color) {
          throw new McpError(ErrorCode.InvalidParams, 'Color parameter is required');
        }

        const bulb = getBulb(args?.ip as string, args?.port as number);

        if (typeof args.color === 'string') {
          // Hex color
          await bulb.setColorHex(args.color);
          return {
            content: [
              {
                type: 'text',
                text: `Successfully set color to ${args.color} on bulb at ${bulb.getConfig().ip}:${bulb.getConfig().port}`,
              },
            ],
          };
        } else if (typeof args.color === 'object' && args.color !== null && 'r' in args.color) {
          // RGB object
          const colorObj = args.color as { r: number; g: number; b: number };
          const { r, g, b } = colorObj;
          await bulb.setColor(r, g, b);
          return {
            content: [
              {
                type: 'text',
                text: `Successfully set color to RGB(${r}, ${g}, ${b}) on bulb at ${bulb.getConfig().ip}:${bulb.getConfig().port}`,
              },
            ],
          };
        } else {
          throw new McpError(ErrorCode.InvalidParams, 'Color must be a hex string or RGB object');
        }
      }

      case 'get_bulb_status': {
        const bulb = getBulb(args?.ip as string, args?.port as number);
        const status = await bulb.getStatus();
        const config = bulb.getConfig();
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                bulb: `${config.ip}:${config.port}`,
                status,
              }, null, 2),
            },
          ],
        };
      }

      case 'discover_bulbs': {
        const timeout = (args?.timeout as number) || 5000;
        const discoveredBulbs = await discovery.discoverBulbs(timeout);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                discovered: discoveredBulbs,
                count: discoveredBulbs.length,
              }, null, 2),
            },
          ],
        };
      }

      case 'connect_to_bulb': {
        if (!args?.ip || !args?.port) {
          throw new McpError(ErrorCode.InvalidParams, 'Both ip and port are required');
        }

        await discovery.connectToBulb(args.ip as string, args.port as number);
        return {
          content: [
            {
              type: 'text',
              text: `Successfully connected to bulb at ${args.ip}:${args.port}`,
            },
          ],
        };
      }

      case 'get_all_bulb_statuses': {
        const allStatuses = await discovery.getAllBulbStatuses();
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                bulbs: allStatuses,
                count: allStatuses.length,
              }, null, 2),
            },
          ],
        };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down MCP server...');
  discovery.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down MCP server...');
  discovery.close();
  process.exit(0);
});

// Start the server
async function main() {
  console.log('Starting MCP Smart Bulb Server...');
  
  // Initialize default bulb connection
  await initializeDefaultBulb();
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.log('MCP Smart Bulb Server running on stdio');
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
}); 