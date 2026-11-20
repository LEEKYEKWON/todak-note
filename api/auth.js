// Vercel Serverless: 회원가입, 로그인 및 병원 프로필 클라우드 동기화 API - Supabase 영구 연동
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://fabzvobawvtsdprixmyf.supabase.co';
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
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, status: res.status, error: errText };
    }
    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

global._usersCache = global._usersCache || {};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const action = req.query.action || req.body?.action;

  // 1. 회원가입 (POST /api/auth?action=signup)
  if (req.method === 'POST' && action === 'signup') {
    const { email, password, doctorName, hospitalName, phone, plan } = req.body || {};
    if (!email || !password || !hospitalName) {
      res.status(400).json({ error: '필수 가입 정보(이메일, 비밀번호, 병원명)가 누락되었습니다.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const newUser = {
      email: cleanEmail,
      password,
      doctorName: (doctorName || '원장').trim(),
      hospitalName: hospitalName.trim(),
      phone: (phone || '').trim(),
      plan: plan || 'Pro',
      joinedAt: new Date().toISOString()
    };

    // Supabase users 테이블에 저장 (없으면 insert, 있으면 upsert)
    let dbInsertError = null;
    try {
      const dbInsertRes = await supabaseQuery('users', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify({
          email: cleanEmail,
          password: password,
          doctor_name: newUser.doctorName,
          hospital_name: newUser.hospitalName,
          phone: newUser.phone,
          plan: newUser.plan,
          updated_at: new Date().toISOString()
        })
      });
      if (!dbInsertRes.ok) {
        dbInsertError = dbInsertRes.error || dbInsertRes.status;
      }
    } catch (dbErr) {
      dbInsertError = dbErr.message;
      console.warn('Supabase users signup error:', dbErr);
    }

    if (dbInsertError) {
      res.status(500).json({ error: 'DB 회원 등록 실패: ' + JSON.stringify(dbInsertError) });
      return;
    }

    global._usersCache[cleanEmail] = newUser;
    res.status(200).json({ success: true, user: newUser });
    return;
  }

  // 2. 로그인 (POST /api/auth?action=login)
  if (req.method === 'POST' && action === 'login') {
    const { email, password } = req.body || {};
    if (!email || !password) {
      res.status(400).json({ error: '이메일과 비밀번호를 입력해 주세요.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    let user = global._usersCache[cleanEmail];

    // 1) Supabase DB에서 최신 회원정보 조회
    let dbError = null;
    try {
      const dbRes = await supabaseQuery(`users?email=eq.${encodeURIComponent(cleanEmail)}&select=*`);
      if (dbRes.ok && Array.isArray(dbRes.data) && dbRes.data.length > 0) {
        const row = dbRes.data[0];
        user = {
          email: row.email,
          password: row.password,
          doctorName: row.doctor_name || '원장',
          hospitalName: row.hospital_name || '',
          phone: row.phone || '',
          plan: row.plan || 'Pro',
          naverReviewUrl: row.naver_review_url || '',
          logoUrl: row.logo_url || '',
          joinedAt: row.created_at
        };
        global._usersCache[cleanEmail] = user;
      } else if (!dbRes.ok) {
        dbError = dbRes.error || dbRes.status;
      }
    } catch (e) {
      dbError = e.message;
      console.warn('Supabase login check failed:', e);
    }

    if (!user) {
      res.status(401).json({ 
        error: `등록되지 않은 이메일 주소입니다. 회원가입을 먼저 진행해 주세요.${dbError ? ' (DB 응답: ' + JSON.stringify(dbError) + ')' : ''}` 
      });
      return;
    }

    if (user.password !== password) {
      res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
      return;
    }

    res.status(200).json({ success: true, user });
    return;
  }

  // 3. 프로필 저장/업데이트 (POST /api/auth?action=update_profile)
  if (req.method === 'POST' && action === 'update_profile') {
    const { email, hospitalName, doctorName, phone, naverReviewUrl, logoUrl } = req.body || {};
    if (!email) {
      res.status(400).json({ error: '이메일이 필요합니다.' });
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!global._usersCache[cleanEmail]) {
      global._usersCache[cleanEmail] = { email: cleanEmail };
    }
    if (hospitalName) global._usersCache[cleanEmail].hospitalName = hospitalName;
    if (doctorName) global._usersCache[cleanEmail].doctorName = doctorName;
    if (phone) global._usersCache[cleanEmail].phone = phone;
    if (naverReviewUrl !== undefined) global._usersCache[cleanEmail].naverReviewUrl = naverReviewUrl;
    if (logoUrl !== undefined) global._usersCache[cleanEmail].logoUrl = logoUrl;

    // Supabase users 테이블 업데이트 동기화
    try {
      const updateData = {
        updated_at: new Date().toISOString()
      };
      if (hospitalName) updateData.hospital_name = hospitalName;
      if (doctorName) updateData.doctor_name = doctorName;
      if (phone) updateData.phone = phone;
      if (naverReviewUrl !== undefined) updateData.naver_review_url = naverReviewUrl;
      if (logoUrl !== undefined) updateData.logo_url = logoUrl;

      await supabaseQuery(`users?email=eq.${encodeURIComponent(cleanEmail)}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData)
      });
    } catch (e) {
      console.warn('Supabase users profile update error:', e);
    }

    res.status(200).json({ success: true, user: global._usersCache[cleanEmail] });
    return;
  }

  // 4. 프로필 조회 (GET /api/auth?email=...) 및 전체 초기화 (GET /api/auth?action=reset_all)
  if (req.method === 'GET') {
    if (action === 'reset_all') {
      global._usersCache = {};
      res.status(200).json({ success: true, message: '서버의 모든 회원 계정 캐시가 초기화되었습니다.' });
      return;
    }

    const email = (req.query.email || '').trim().toLowerCase();
    if (!email) {
      res.status(400).json({ error: 'Email parameter required' });
      return;
    }

    try {
      const dbRes = await supabaseQuery(`users?email=eq.${encodeURIComponent(email)}&select=*`);
      if (dbRes.ok && Array.isArray(dbRes.data) && dbRes.data.length > 0) {
        const row = dbRes.data[0];
        const user = {
          email: row.email,
          password: row.password,
          doctorName: row.doctor_name || '원장',
          hospitalName: row.hospital_name || '',
          phone: row.phone || '',
          plan: row.plan || 'Pro',
          naverReviewUrl: row.naver_review_url || '',
          logoUrl: row.logo_url || '',
          joinedAt: row.created_at
        };
        global._usersCache[email] = user;
        res.status(200).json({ success: true, user });
        return;
      }
    } catch (e) {}

    if (global._usersCache[email]) {
      res.status(200).json({ success: true, user: global._usersCache[email] });
      return;
    }

    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.status(405).json({ error: 'Method Not Allowed' });
};

