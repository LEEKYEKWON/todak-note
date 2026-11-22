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

  // 3. 현재 로그인된 사용자 최신 프로필 DB에서 불러오기 (날짜 도래 시 자동 전환 검사 포함)
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
          let fresh = this.normalizeUser(list[0]);

          // 🌟 [자동 전환 엔진] 만약 오늘 날짜가 전환 예정일(pending_date)에 도달했거나 지났다면 자동으로 기본형으로 영구 전환
          fresh = await this.checkAndExecuteAutoTransition(fresh);

          localStorage.setItem('todak_current_user', JSON.stringify(fresh));
          return fresh;
        }
      }
    } catch (e) {
      console.warn('DB 프로필 갱신 실패, 로컬 사용:', e);
    }
    return localUser;
  },

  // 🌟 결제일 도래 시 자동 전환 실행 엔진 (12월 1일이 되면 자동으로 Standard로 영구 전환)
  async checkAndExecuteAutoTransition(user) {
    if (!user || !user.email || !user.pendingPlan || !user.pendingDate) {
      return user;
    }

    // 날짜 파싱 (예: "2026-12-01" 또는 "12월 1일")
    let targetYear = new Date().getFullYear();
    let targetMonth = null;
    let targetDay = null;

    if (user.pendingDate.includes('-')) {
      const parts = user.pendingDate.split('-');
      targetYear = parseInt(parts[0], 10);
      targetMonth = parseInt(parts[1], 10) - 1;
      targetDay = parseInt(parts[2], 10);
    } else if (user.pendingDate.includes('월')) {
      const mMatch = user.pendingDate.match(/(\d+)월\s*(\d+)일/);
      if (mMatch) {
        targetMonth = parseInt(mMatch[1], 10) - 1;
        targetDay = parseInt(mMatch[2], 10);
      }
    }

    if (targetMonth !== null && targetDay !== null) {
      const targetDate = new Date(targetYear, targetMonth, targetDay, 0, 0, 0);
      const now = new Date();

      // 오늘 날짜가 예약일을 지났거나 도래한 경우 실제 전환 DB 반영
      if (now >= targetDate) {
        console.log(`[AutoTransition] 전환 예정일(${user.pendingDate}) 도래 -> ${user.pendingPlan} 플랜으로 자동 전환 실행`);
        const switched = await this.updateProfile({
          email: user.email,
          plan: user.pendingPlan,
          pendingPlan: null,
          pendingDate: null
        });
        return switched;
      }
    }

    return user;
  },

  // 4. 프로필 정보 영구 수정 (정식 DB 컬럼: plan, pending_plan, pending_date 정석 연동)
  async updateProfile({ email, hospitalName, doctorName, phone, naverReviewUrl, logoUrl, plan, pendingPlan, pendingDate }) {
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

    // Supabase 정식 컬럼에 정확하게 반영 (null 전달 시 null로 DB 업데이트)
    if (pendingPlan !== undefined) updateBody.pending_plan = pendingPlan;
    if (pendingDate !== undefined) updateBody.pending_date = pendingDate;

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

    const normalized = this.normalizeUser({
      ...updated,
      email: cleanEmail
    });

    // 브라우저 세션 동기화
    localStorage.setItem('todak_current_user', JSON.stringify(normalized));
    return normalized;
  },

  // 5. 플랜 업그레이드 / 전환 (Supabase DB 직접 반영)
  async updatePlan(email, newPlan, pendingPlan = null, pendingDate = null) {
    if (!email) {
      const userStr = localStorage.getItem('todak_current_user');
      if (userStr) {
        try { email = JSON.parse(userStr).email; } catch (e) {}
      }
    }
    return await this.updateProfile({ email, plan: newPlan, pendingPlan, pendingDate });
  },

  // 규격 통일 헬퍼 (DB 컬럼 값 그대로 정규화)
  normalizeUser(row) {
    if (!row) return null;
    return {
      email: row.email,
      doctorName: row.doctor_name || row.doctorName || '원장',
      hospitalName: row.hospital_name || row.hospitalName || '우리병원',
      phone: row.phone || '',
      plan: row.plan || 'Pro',
      pendingPlan: row.pending_plan || '',
      pendingDate: row.pending_date || '',
      billingKey: row.billing_key || row.billingKey || '',
      billingRegisteredAt: row.billing_registered_at || row.billingRegisteredAt || '',
      naverReviewUrl: row.naver_review_url || row.naverReviewUrl || '',
      logoUrl: row.logo_url || row.logoUrl || '',
      joinedAt: row.created_at || row.joinedAt
    };
  }
};

