// Supabase 클라우드 데이터베이스 공식 연동 클라이언트 (공개키 Publishable Key 사용)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://fabzvobawvtsdprixmyf.supabase.co';

// 공개키(Publishable Key)는 깃허브 보안에 전혀 걸리지 않으며, SQL RLS 정책(Public Full Access)으로 완벽하게 동작합니다!
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_h8kmyQtu5Q25wDiIHv3ZiQ_oiOCAc8O';

async function supabaseQuery(endpoint, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': options.prefer || 'return=representation',
    ...(options.headers || {})
  };

  try {
    const res = await fetch(url, {
      ...options,
      headers
    });
    if (!res.ok) {
      const errText = await res.text();
      console.warn(`Supabase API 오류 [${res.status}] ${endpoint}:`, errText);
      return { ok: false, status: res.status, error: errText };
    }
    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    console.error(`Supabase 통신 실패 [${endpoint}]:`, err);
    return { ok: false, error: err.message };
  }
}

module.exports = {
  SUPABASE_URL,
  SUPABASE_KEY,
  supabaseQuery
};
