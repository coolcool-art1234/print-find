const express = require('express');
const cors = require('cors');
const path = require('path');
const { exec } = require('child_process');
const bonjour = require('bonjour')();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function parseLpstat(output) {
  const printers = [];
  let defaultPrinter = null;
  output.split(/\r?\n/).forEach(line => {
    line = line.trim();
    if (!line) return;
    if (line.startsWith('printer ')) {
      const m = line.match(/^printer\s+([^\s]+)\s+(.*)$/);
      if (m) {
        printers.push({ name: m[1], raw: line, description: m[2] });
      }
    } else if (line.startsWith('system default destination:')) {
      defaultPrinter = line.split(':', 2)[1].trim();
    }
  });
  if (defaultPrinter) {
    printers.forEach(p => { if (p.name === defaultPrinter) p.default = true; });
  }
  return printers;
}

function getLocalPrinters() {
  return new Promise((resolve) => {
    const platform = process.platform;
    if (platform === 'win32') {
      // Use PowerShell Get-Printer and ConvertTo-Json (Windows 8+/Server 2012+)
      const cmd = 'powershell -NoProfile -Command "Get-Printer | Select-Object Name,ShareName,PortName,PrinterStatus | ConvertTo-Json -Depth 2"';
      exec(cmd, { windowsHide: true, timeout: 5000 }, (err, stdout) => {
        if (err || !stdout) {
          // fallback to wmic (older)
          exec('wmic printer get Name /format:csv', { timeout: 3000 }, (e2, out2) => {
            if (e2 || !out2) return resolve([]);
            const lines = out2.split(/\r?\n/).filter(Boolean);
            const results = [];
            lines.forEach(l => {
              const parts = l.split(',');
              if (parts.length >= 2 && parts[1] !== 'Name') results.push({ name: parts[1] });
            });
            resolve(results);
          });
          return;
        }
        try {
          const data = JSON.parse(stdout);
          if (Array.isArray(data)) {
            resolve(data.map(d => ({ name: d.Name || d.name, share: d.ShareName, port: d.PortName, status: d.PrinterStatus || null })));
          } else if (data && typeof data === 'object') {
            resolve([{ name: data.Name || data.name, share: data.ShareName, port: data.PortName }]);
          } else {
            resolve([]);
          }
        } catch (parseErr) {
          resolve([]);
        }
      });
    } else {
      // macOS / Linux: lpstat
      exec('lpstat -p -d', { timeout: 4000 }, (err, stdout) => {
        if (err || !stdout) {
          return resolve([]);
        }
        try {
          resolve(parseLpstat(stdout));
        } catch (e) {
          resolve([]);
        }
      });
    }
  });
}

function discoverNetworkPrinters(timeoutMs = 5000) {
  return new Promise((resolve) => {
    const found = {};
    const servicesToBrowse = [{ type: 'ipp' }, { type: 'printer' }];
    const browsers = [];

    function addServiceCallback(service) {
      // uniq by fullname (name + host + port)
      const key = `${service.name}@${service.host}:${service.port}`;
      if (!found[key]) {
        const addresses = (service.addresses || []).map(a => a);
        const props = {};
        if (service.txt) {
          Object.keys(service.txt).forEach(k => { props[k] = service.txt[k]; });
        }
        found[key] = {
          name: service.name,
          type: service.type,
          host: service.host,
          port: service.port,
          addresses,
          txt: props
        };
      }
    }

    servicesToBrowse.forEach(s => {
      const browser = bonjour.find(s, (service) => {
        addServiceCallback(service);
      });
      browsers.push(browser);
    });

    // After timeout, stop and return
    setTimeout(() => {
      // stop browsers
      browsers.forEach(b => {
        try { b.stop(); } catch (e) {}
      });
      // bonjour.destroy(); // don't destroy global instance, keep process stable
      const list = Object.values(found);
      resolve(list);
    }, timeoutMs);
  });
}

app.get('/api/discover', async (req, res) => {
  const timeout = Math.max(2000, parseInt(req.query.timeout || '5000', 10));
  try {
    const [local, network] = await Promise.all([
      getLocalPrinters(),
      discoverNetworkPrinters(timeout)
    ]);
    res.json({ platform: process.platform, local_printers: local, network_printers: network });
  } catch (err) {
    res.status(500).json({ error: 'internal_error', detail: String(err) });
  }
});

// fallback to index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Printer discovery web app listening on http://localhost:${port}`);
});
