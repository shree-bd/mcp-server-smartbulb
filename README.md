# MCP Server for Smart Bulb Control

An MCP (Model Context Protocol) server that enables AI assistants to control smart bulbs via UDP communication.

## Architecture

```
AI Assistant <-> MCP Server <-> Smart Bulb (UDP 192.168.1.45:4000)
```

## Features

- Control smart bulb power (on/off)
- Adjust brightness (0-100%)
- Change color (RGB/HSV)
- Get bulb status
- Discover bulbs on network
- Real-time status monitoring

## Installation

```bash
npm install
npm run build
```

## Configuration

Create a `.env` file:

```env
BULB_IP=192.168.1.45
BULB_PORT=4000
MCP_SERVER_PORT=3000
```

## Usage

### As MCP Server
```bash
npm start
```

### Development Mode
```bash
npm run dev
```

## MCP Tools Available

1. **turn_on_bulb** - Turn the smart bulb on
2. **turn_off_bulb** - Turn the smart bulb off
3. **set_brightness** - Set bulb brightness (0-100%)
4. **set_color** - Set bulb color (RGB or HSV)
5. **get_bulb_status** - Get current bulb status
6. **discover_bulbs** - Discover bulbs on network

## Protocol

The server communicates with smart bulbs using UDP packets with JSON payloads:

```json
{
  "command": "set_power",
  "params": {
    "power": true
  }
}
```

## Supported Bulb Commands

- `set_power`: Turn bulb on/off
- `set_brightness`: Set brightness level
- `set_color`: Set RGB/HSV color
- `get_status`: Get current status
- `discover`: Network discovery

## License

MIT 