// 토닥토닥노트 데이터 계층 통일 모듈 (Supabase Direct SDK)
const SUPABASE_URL = 'https://fabzvobawvtsdprixmyf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_h8kmyQtu5Q25wDiIHv3ZiQ_oiOCAc8O';

const TodakDB = {
  // 1. 회원가입
  async signUp({ email, password, doctorName, hospitalName, phone, plan }) {
    const cleanEmail = email.trim().toLowerCase();
    const res = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        email: cleanEmail,
        password: password,
        doctor_name: doctorName.trim(),
        hospital_name: hospitalName.trim(),
        phone: (phone || '').trim(),
        plan: plan || 'Pro',
        updated_at: new Date().toISOString()
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (res.status === 409 || err.code === '23505') {
        throw new Error('이미 등록된 이메일 주소입니다. 로그인해 주세요.');
      }
      throw new Error(err.message || `회원가입 실패 (${res.status})`);
    }

    const data = await res.json();
    const user = Array.isArray(data) ? data[0] : data;
    return this.normalizeUser(user);
  },

  // 2. 로그인 (DB 직접 대조)
  async signIn({ email, password }) {
    const cleanEmail = email.trim().toLowerCase();
    const res = await fetch(`${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(cleanEmail)}&select=*`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    if (!res.ok) {
      throw new Error(`서버 통신 실패 (${res.status})`);
    }

    const list = await res.json();
    if (!Array.isArray(list) || list.length === 0) {
      throw new Error('등록되지 않은 이메일 주소입니다. 회원가입을 먼저 진행해 주세요.');
    }

    const row = list[0];
    if (row.password !== password) {
      throw new Error('비밀번호가 일치하지 않습니다.');
    }

    return this.normalizeUser(row);
  },

  // 3. 현재 로그인된 사용자 최신 프로필 DB에서 불러오기
  async getCurrentUserProfile() {
    const userStr = localStorage.getItem('todak_current_user');
    if (!userStr) return null;
    let localUser = null;
    try { localUser = JSON.parse(userStr); } catch (e) { return null; }
    if (!localUser || !localUser.email) return localUser;

    try {
      const cleanEmail = localUser.email.trim().toLowerCase();
      const res = await fetch(`${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(cleanEmail)}&select=*`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      });
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list) && list.length > 0) {
          const fresh = this.normalizeUser(list[0]);
          localStorage.setItem('todak_current_user', JSON.stringify(fresh));
          return fresh;
        }
      }
    } catch (e) {
      console.warn('DB 프로필 갱신 실패, 로컬 사용:', e);
    }
    return localUser;
  },

  // 4. 프로필 정보 영구 수정 (병원명, 원장명, 로고, 네이버링크, 요금제 플랜 등)
  async updateProfile({ email, hospitalName, doctorName, phone, naverReviewUrl, logoUrl, plan }) {
    if (!email) {
      const userStr = localStorage.getItem('todak_current_user');
      if (userStr) {
        try { email = JSON.parse(userStr).email; } catch (e) {}
      }
    }
    const cleanEmail = (email || '').trim().toLowerCase();
    const updateBody = {
      updated_at: new Date().toISOString()
    };
    if (hospitalName !== undefined) updateBody.hospital_name = hospitalName.trim();
    if (doctorName !== undefined) updateBody.doctor_name = doctorName.trim();
    if (phone !== undefined) updateBody.phone = phone.trim();
    if (naverReviewUrl !== undefined) updateBody.naver_review_url = naverReviewUrl.trim();
    if (logoUrl !== undefined) updateBody.logo_url = logoUrl;
    if (plan !== undefined) updateBody.plan = plan;

    const res = await fetch(`${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(cleanEmail)}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(updateBody)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `프로필 저장 실패 (${res.status})`);
    }

    const data = await res.json();
    const updated = Array.isArray(data) && data.length > 0 ? data[0] : updateBody;
    const normalized = this.normalizeUser({ ...updated, email: cleanEmail });

    // 브라우저 세션 동기화
    localStorage.setItem('todak_current_user', JSON.stringify(normalized));
    return normalized;
  },

  // 5. 플랜 업그레이드 / 전환 (Supabase DB 직접 반영)
  async updatePlan(email, newPlan) {
    if (!email) {
      const userStr = localStorage.getItem('todak_current_user');
      if (userStr) {
        try { email = JSON.parse(userStr).email; } catch (e) {}
      }
    }
    return await this.updateProfile({ email, plan: newPlan });
  },

  // 규격 통일 헬퍼
  normalizeUser(row) {
    if (!row) return null;
    return {
      email: row.email,
      doctorName: row.doctor_name || row.doctorName || '원장',
      hospitalName: row.hospital_name || row.hospitalName || '우리병원',
      phone: row.phone || '',
      plan: row.plan || 'Pro',
      naverReviewUrl: row.naver_review_url || row.naverReviewUrl || '',
      logoUrl: row.logo_url || row.logoUrl || '',
      joinedAt: row.created_at || row.joinedAt
    };
  }
};

