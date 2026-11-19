// 병원 브랜딩(로고, 네이버 플레이스 리뷰 주소) 전용 독립 API - Supabase 영구 DB 연동
const { supabaseQuery } = require('./supabase');

// 오프라인/캐시 대비 로컬 백업
let preloadedBrands = {};
try {
  preloadedBrands = require('./brand-data.js');
} catch (e) { }

global._brandCache = global._brandCache || Object.assign({}, preloadedBrands);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  // 1. 병원 브랜딩 저장 (POST /api/hosp-brand)
  if (req.method === 'POST') {
    const { hospitalName, logoUrl, naverReviewUrl } = req.body || {};
    if (!hospitalName) {
      res.status(400).json({ error: 'hospitalName required' });
      return;
    }

    const key = hospitalName.trim().replace(/^🏥\s*/, '');
    const brandData = {
      hospital_name: key,
      logo_url: logoUrl || (global._brandCache[key]?.logoUrl || ''),
      naver_review_url: naverReviewUrl || (global._brandCache[key]?.naverReviewUrl || ''),
      updated_at: new Date().toISOString()
    };

    // 메모리 캐시 동기화
    global._brandCache[key] = {
      hospitalName: key,
      logoUrl: brandData.logo_url,
      naverReviewUrl: brandData.naver_review_url,
      updatedAt: Date.now()
    };

    // 🌟 Supabase 클라우드 영구 저장 (upsert: 있으면 갱신, 없으면 신규 삽입)
    try {
      await supabaseQuery('hospitals', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=representation',
        body: JSON.stringify(brandData)
      });
    } catch (e) {
      console.warn("Supabase 병원 저장 실패:", e);
    }

    res.status(200).json({ success: true, brand: global._brandCache[key] });
    return;
  }

  // 2. 병원 브랜딩 조회 (GET /api/hosp-brand?hospitalName=...)
  if (req.method === 'GET') {
    const rawName = (req.query.hospitalName || req.query.name || '').trim().replace(/^🏥\s*/, '');
    if (!rawName) {
      res.status(200).json({ success: false, brand: null });
      return;
    }

    // 1순위: Supabase 클라우드 영구 DB에서 조회
    try {
      const sbRes = await supabaseQuery(`hospitals?hospital_name=eq.${encodeURIComponent(rawName)}&select=*`);
      if (sbRes.ok && sbRes.data && sbRes.data.length > 0) {
        const item = sbRes.data[0];
        const brand = {
          hospitalName: item.hospital_name,
          logoUrl: item.logo_url || '',
          naverReviewUrl: item.naver_review_url || ''
        };
        global._brandCache[rawName] = brand;
        res.status(200).json({ success: true, brand });
        return;
      }
    } catch (sbErr) {
      console.warn("Supabase 병원 조회 실패, 캐시 확인:", sbErr);
    }

    // 2순위: 로컬 메모리/파일 백업 캐시 확인
    if (global._brandCache[rawName]) {
      res.status(200).json({ success: true, brand: global._brandCache[rawName] });
      return;
    }

    res.status(200).json({ success: false, brand: null });
    return;
  }

  res.status(405).json({ error: 'Method Not Allowed' });
};
