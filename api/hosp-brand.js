// 병원 브랜딩(로고, 네이버 플레이스 리뷰 주소) 전용 독립 API
const fs = require('fs');
const path = require('path');

let preloadedBrands = {};
try {
  preloadedBrands = require('./brand-data.js');
} catch (e) { }

global._brandCache = global._brandCache || Object.assign({}, preloadedBrands);
const BRAND_FILE = path.join('/tmp', 'todak_brands.json');

function loadBrands() {
  try {
    if (fs.existsSync(BRAND_FILE)) {
      const data = JSON.parse(fs.readFileSync(BRAND_FILE, 'utf-8'));
      Object.assign(global._brandCache, data);
    }
  } catch (e) { }
}

function saveBrands() {
  try {
    fs.writeFileSync(BRAND_FILE, JSON.stringify(global._brandCache), 'utf-8');
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

  loadBrands();

  // 1. 병원 브랜딩 저장 (POST /api/hosp-brand)
  if (req.method === 'POST') {
    const { hospitalName, logoUrl, naverReviewUrl } = req.body || {};
    if (!hospitalName) {
      res.status(400).json({ error: 'hospitalName required' });
      return;
    }

    const key = hospitalName.trim().replace(/^🏥\s*/, '');
    global._brandCache[key] = {
      hospitalName: key,
      logoUrl: logoUrl || (global._brandCache[key]?.logoUrl || ''),
      naverReviewUrl: naverReviewUrl || (global._brandCache[key]?.naverReviewUrl || ''),
      updatedAt: Date.now()
    };
    saveBrands();

    res.status(200).json({ success: true, brand: global._brandCache[key] });
    return;
  }

  // 2. 병원 브랜딩 조회 (GET /api/hosp-brand?hospitalName=...)
  if (req.method === 'GET') {
    const rawName = (req.query.hospitalName || req.query.name || '').trim().replace(/^🏥\s*/, '');
    if (!rawName || !global._brandCache[rawName]) {
      res.status(200).json({ success: false, brand: null });
      return;
    }

    res.status(200).json({ success: true, brand: global._brandCache[rawName] });
    return;
  }

  res.status(405).json({ error: 'Method Not Allowed' });
};

