const fs = require('fs');
const path = require('path');

// 메모리 캐시 및 /tmp 파일 캐시 결합
global._reportCache = global._reportCache || {};

const TMP_FILE = path.join('/tmp', 'todak_reports.json');

function loadCache() {
  try {
    if (fs.existsSync(TMP_FILE)) {
      const data = JSON.parse(fs.readFileSync(TMP_FILE, 'utf-8'));
      Object.assign(global._reportCache, data);
    }
  } catch (e) { }
}

function saveCache() {
  try {
    fs.writeFileSync(TMP_FILE, JSON.stringify(global._reportCache), 'utf-8');
  } catch (e) { }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  loadCache();

  if (req.method === 'POST') {
    const { id, reportData } = req.body || {};
    if (!id || !reportData) {
      res.status(400).json({ error: 'id and reportData required' });
      return;
    }
    global._reportCache[id] = reportData;
    saveCache();
    res.status(200).json({ success: true, id });
    return;
  }

  if (req.method === 'GET') {
    const { id } = req.query || {};
    if (!id || !global._reportCache[id]) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }
    res.status(200).json(global._reportCache[id]);
    return;
  }

  res.status(405).json({ error: 'Method Not Allowed' });
};

