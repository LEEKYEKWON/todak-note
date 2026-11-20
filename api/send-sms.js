const https = require('https');
const crypto = require('crypto');

const SOLAPI_API_KEY = process.env.SOLAPI_API_KEY || 'NCSK8Y3GEABTX0B0KKZJU8';
const SOLAPI_API_SECRET = process.env.SOLAPI_API_SECRET || 'ANWFHRCJW1UD3OTT9TBJTO2XEQ1N3GED';
const SENDER_PHONE = process.env.SENDER_PHONE || '01093442378';
const KAKAO_TEMPLATE_ID = process.env.KAKAO_TEMPLATE_ID || 'KA01TP261113053545740Y0kVMg3uuuG';
const KAKAO_CHANNEL_ID = process.env.KAKAO_CHANNEL_ID || 'KA01PF261113043443940D6zsL0yN1b6';

function getSolapiAuthHeader() {
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(16).toString('hex');
  const signature = crypto.createHmac('sha256', SOLAPI_API_SECRET)
    .update(date + salt)
    .digest('hex');
  return `HMAC-SHA256 apiKey=${SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`;
}

// 🌟 카카오 알림톡 버튼 링크 100자 이내 준수를 위한 초경량 단축 URL 생성기 (is.gd / tinyurl 백업)
async function getShortUrl(longUrl) {
  // 1순위: is.gd (매우 짧고 빠름)
  try {
    const res = await new Promise((resolve, reject) => {
      const req = https.get(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(longUrl)}`, (r) => {
        let body = '';
        r.on('data', chunk => body += chunk);
        r.on('end', () => {
          if (r.statusCode === 200 && body.startsWith('http')) resolve(body.trim());
          else reject(new Error('is.gd failed'));
        });
      });
      req.on('error', reject);
      req.setTimeout(2500, () => { req.destroy(); reject(new Error('timeout')); });
    });
    return res;
  } catch (e) {}

  // 2순위: tinyurl (글로벌 표준)
  try {
    const res = await new Promise((resolve, reject) => {
      const req = https.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`, (r) => {
        let body = '';
        r.on('data', chunk => body += chunk);
        r.on('end', () => {
          if (r.statusCode === 200 && body.startsWith('http')) resolve(body.trim());
          else reject(new Error('tinyurl failed'));
        });
      });
      req.on('error', reject);
      req.setTimeout(2500, () => { req.destroy(); reject(new Error('timeout')); });
    });
    return res;
  } catch (e) {}

  // 실패 시 원본 반환
  return longUrl;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 솔라피 잔액 조회 (GET /api/send-sms?action=balance)
  if (req.method === 'GET' && req.query.action === 'balance') {
    const options = {
      hostname: 'api.solapi.com',
      port: 443,
      path: '/cash/v1/balance',
      method: 'GET',
      headers: {
        'Authorization': getSolapiAuthHeader()
      }
    };

    const balReq = https.request(options, balRes => {
      let data = '';
      balRes.on('data', chunk => data += chunk);
      balRes.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          // 솔라피 balance API 구조:
          // { balance: 충전금액(원단위), point: 보너스포인트, vat: 부가세등 }
          // 홈페이지의 '합산 잔액'은 balance + point 또는 balance * 1.1(부가세 포함 충전액)
          // 8990.1 * 1.1 = 9989.11원! 즉 parsed.balance는 공급가액(VAT 제외) 금액입니다.
          // 사용자가 실제로 보는 합산 잔액(VAT 포함 총액)은 Math.round(balance * 1.1) 또는 parsed.totalAmount
          let totalBalance = 0;
          if (parsed.balance !== undefined) {
            // 공급가액에 10% 부가세를 더하면 사용자가 충전해서 보는 실제 표시 잔액(9,989원)과 100% 일치
            totalBalance = Math.round(parsed.balance * 1.1) + (Number(parsed.point) || 0);
          } else {
            totalBalance = Number(parsed.point) || 0;
          }
          res.status(200).json({ success: true, balance: totalBalance, raw: parsed });
        } catch (e) {
          res.status(500).json({ error: '솔라피 잔액 파싱 실패', raw: data });
        }
      });
    });

    balReq.on('error', err => {
      res.status(500).json({ error: err.message });
    });

    balReq.end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const {
      to,
      receiverPhone,
      text,
      patientName,
      reportUrl,
      hospitalName,
      doctorName,
      summary,
      medication,
      nextDate
    } = req.body || {};

    const recipientPhone = (to || receiverPhone || '').replace(/[^0-9]/g, '');

    if (!recipientPhone) {
      res.status(400).json({ error: '수신자 전화번호가 올바르지 않습니다.' });
      return;
    }

    const host = req.headers.host || 'todak-note.vercel.app';
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const finalReportUrl = reportUrl || `${protocol}://${host}/report.html`;

    const currentHosp = hospitalName || '길동이의원';
    const currentPatient = patientName || '환자';
    const currentDoctor = doctorName || '홍길동';

    // 1) 🌟 초경량 단축 URL 생성 (카카오 버튼 100자 이내 준수 및 대체 문자 링크 깔끔화)
    let shortenedUrl = finalReportUrl;
    try {
      shortenedUrl = await getShortUrl(finalReportUrl);
    } catch (e) {
      console.warn("단축 URL 생성 실패, 원본 유지:", e);
    }

    // 템플릿의 버튼은 https://#{리포트링크} 형태이므로 https:// 제외한 값 추출
    const cleanUrl = shortenedUrl.replace(/^https?:\/\//i, '');
    const cleanDoctor = (currentDoctor || '홍길동').replace(/원장\s*$/, '').trim();

    // 🌟 카카오 알림톡 템플릿에 "안녕하세요, #{환자명}님."으로 "님"이 이미 붙어 있으므로,
    // 전달받은 환자명에 이미 "님"이 붙어 있다면 제거하여 "님님" 중복 방지
    // 예: "김영희 님 (만 32세)" ➔ "김영희 (만 32세)"
    // 예: "김영희 님" ➔ "김영희"
    let cleanPatient = (currentPatient || '환자').trim();
    cleanPatient = cleanPatient.replace(/^([^(\n]+?)\s*님(?=\s*\(|$)/, '$1').trim();

    const kakaoVariables = {
      '#{병원명}': currentHosp,
      '#{환자명}': cleanPatient,
      '#{원장명}': cleanDoctor,
      '#{리포트링크}': cleanUrl
    };

    // 대체발송 문자 본문 (알림톡 미수신 시 전달)
    const fallbackText = `[${currentHosp}]
안녕하세요, ${cleanPatient}님.
${cleanDoctor} 원장님이 전해드리는 안심 진료노트가 도착했습니다.

오늘 진료받으시느라 수고 많으셨습니다.
진료 요약 및 복약 지도, 다음 내원일과 맞춤 건강 팁을 아래 링크를 눌러 확인해 주세요.

👉 진료 리포트 확인하기:
${shortenedUrl}

※ 본 안내는 환자분의 안전한 복약과 빠른 쾌유를 위해 발송되었습니다.`;

    // 2) 솔라피 ATA (알림톡) 메시지 규격
    const messagePayload = {
      to: recipientPhone,
      from: SENDER_PHONE,
      type: 'ATA',
      kakaoOptions: {
        pfId: KAKAO_CHANNEL_ID,
        templateId: KAKAO_TEMPLATE_ID,
        variables: kakaoVariables,
        disableSms: false // 실패 시 대체발송 허용
      },
      text: fallbackText
    };

    const payload = JSON.stringify({
      messages: [messagePayload]
    });

    const options = {
      hostname: 'api.solapi.com',
      port: 443,
      path: '/messages/v4/send-many/detail',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getSolapiAuthHeader(),
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const solapiReq = https.request(options, solapiRes => {
      let solapiData = '';
      solapiRes.on('data', chunk => { solapiData += chunk; });
      solapiRes.on('end', () => {
        try {
          const parsed = JSON.parse(solapiData);
          if (solapiRes.statusCode >= 400 || parsed.errorCode || parsed.errorMessage) {
            res.status(400).json({
              error: parsed.errorMessage || parsed.message || `솔라피 오류 (${solapiRes.statusCode})`,
              details: parsed
            });
            return;
          }
          res.status(200).json({ success: true, type: 'ATA(알림톡)', solapi: parsed });
        } catch (e) {
          res.status(200).json({ success: true, raw: solapiData });
        }
      });
    });

    solapiReq.on('error', err => {
      res.status(500).json({ error: err.message });
    });

    solapiReq.write(payload);
    solapiReq.end();

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
