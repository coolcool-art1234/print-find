document.addEventListener('DOMContentLoaded', () => {
  const discoverBtn = document.getElementById('discoverBtn');
  const jsonBtn = document.getElementById('jsonBtn');
  const statusEl = document.getElementById('status');
  const localList = document.getElementById('localList');
  const networkList = document.getElementById('networkList');
  const rawJson = document.getElementById('rawJson');
  const timeoutInput = document.getElementById('timeout');

  let lastResult = null;

  function setStatus(msg, isLoading = false) {
    statusEl.textContent = msg;
    if (isLoading) statusEl.classList.add('loading'); else statusEl.classList.remove('loading');
  }

  function renderList(container, items, formatter) {
    container.innerHTML = '';
    if (!items || items.length === 0) {
      container.innerHTML = '<em>(none found)</em>';
      return;
    }
    items.forEach(it => {
      const div = document.createElement('div');
      div.className = 'printer';
      div.innerHTML = formatter(it);
      container.appendChild(div);
    });
  }

  discoverBtn.addEventListener('click', async () => {
    setStatus('Searching...', true);
    localList.innerHTML = 'Searching...';
    networkList.innerHTML = 'Searching...';
    rawJson.textContent = '{}';
    const timeoutSec = Math.max(2, Math.min(20, parseInt(timeoutInput.value || '5', 10)));
    try {
      const resp = await fetch(`/api/discover?timeout=${timeoutSec * 1000}`);
      if (!resp.ok) throw new Error('Network response not ok: ' + resp.status);
      const data = await resp.json();
      lastResult = data;
      rawJson.textContent = JSON.stringify(data, null, 2);

      renderList(localList, data.local_printers, (p) => {
        const name = p.name || p.Name || p.label || (p.raw || '');
        const d = [];
        if (p.default) d.push('<strong>(default)</strong>');
        if (p.port) d.push(`port: ${p.port}`);
        return `<div><strong>${name}</strong> ${d.join(' ')}<div style="font-size:0.9rem;color:#555">${p.raw ? p.raw : JSON.stringify(p)}</div></div>`;
      });

      renderList(networkList, data.network_printers, (s) => {
        const addrs = (s.addresses || []).join(', ');
        const txt = s.txt ? JSON.stringify(s.txt) : '';
        return `<div><strong>${s.name}</strong> <span style="color:#666">[${s.type}]</span><div style="font-size:0.9rem;color:#444">host: ${s.host || ''} port: ${s.port || ''} addrs: ${addrs}</div><div style="font-size:0.85rem;color:#555">${txt}</div></div>`;
      });

      setStatus('Done', false);
    } catch (err) {
      setStatus('Error: ' + err.message, false);
      localList.innerHTML = `<pre>${String(err)}</pre>`;
      networkList.innerHTML = `<pre>${String(err)}</pre>`;
      rawJson.textContent = '{}';
    }
  });

  jsonBtn.addEventListener('click', () => {
    if (!lastResult) return alert('No JSON to copy — run a search first.');
    navigator.clipboard?.writeText(JSON.stringify(lastResult, null, 2)).then(() => {
      alert('JSON copied to clipboard');
    }).catch(() => {
      alert('Could not copy to clipboard. Here is the JSON: \\n' + JSON.stringify(lastResult, null, 2));
    });
  });
});
