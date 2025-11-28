# Printer Discovery Web (multi-platform)

A minimal website + Node backend that discovers local and network printers when you click a button.

Features:
- Local printers:
  - Linux / macOS: uses `lpstat -p -d` (CUPS).
  - Windows: uses PowerShell `Get-Printer` (falls back to `wmic`).
- Network printers: mDNS / Bonjour for `_ipp._tcp` and `_printer._tcp` using `bonjour` npm package.
- Single-page web UI that calls `/api/discover` and shows results; JSON can be copied.

Requirements:
- Node.js v14+ (recommended).
- On Linux/macOS: `lpstat` (from CUPS) in PATH for local detection.
- On Windows: PowerShell should be available (most modern Windows).
- For ChromeOS: run inside the Linux container (Crostini) where Node is installed.

Quickstart:
1. Clone or create the repo and save these files.
2. Install:
   ```
   npm install
   ```
3. Run:
   ```
   npm start
   ```
4. Open http://localhost:3000 in a browser and click "Search printers".

Notes:
- The server executes system commands to list local printers; ensure the environment where you run it has the needed command/tools.
- mDNS discovery requires network visibility to the printers (same LAN, not blocked by firewall).
- On ChromeOS host (not Crostini), the host printing system is managed by Chrome OS; running this outside the Linux container may not show host printers. Use the Linux (Beta) terminal.

Security:
- This example is intended for local use. If you expose it to a network, add authentication and tighten CORS or bind to localhost only.

Extending:
- Add SNMP scanning for raw IP printers on subnets.
- Add authentication and a small REST API for integration.
- Package as an Electron app for a cross-platform desktop application.
- Add optional user-supplied subnet for active scanning.

License: MIT
