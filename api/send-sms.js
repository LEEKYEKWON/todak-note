const https = require('https');
const crypto = require('crypto');

const SOLAPI_API_KEY = process.env.SOLAPI_API_KEY || 'NCSK8Y3GEABTX0B0KKZJU8';
const SOLAPI_API_SECRET = process.env.SOLAPI_API_SECRET || 'ANWFHRCJW1UD3OTT9TBJTO2XEQ1N3GED';
const SENDER_PHONE = process.env.SENDER_PHONE || '01093442378';
const KAKAO_TEMPLATE_ID = process.env.KAKAO_TEMPLATE_ID || 'KA01TP261113053545740Y0kVMg3uuuG';
const KAKAO_CHANNEL_ID = process.env.KAKAO_CHANNEL_ID || '@todaknote';

function getSolapiAuthHeader() {
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(16).toString('hex');
  const signature = crypto.createHmac('sha256', SOLAPI_API_SECRET)
    .update(date + salt)
    .digest('hex');
  return `HMAC-SHA256 apiKey=${SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
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
    const currentDoctor = doctorName || '원장';

    // 1) 알림톡 변수 매핑
    // 템플릿 등록 변수: #{병원명}, #{환자명}, #{원장명}, #{리포트링크}
    // 링크 변수의 경우 프로토콜(https://)을 제외한 도메인/경로 형태 지원
    const cleanUrl = finalReportUrl.replace(/^https?:\/\//i, '');

    const kakaoVariables = {
      '#{병원명}': currentHosp,
      '#{환자명}': currentPatient,
      '#{원장명}': currentDoctor,
      '#{리포트링크}': cleanUrl
    };

    // 대체발송 문자 본문 (알림톡 미수신 시 전달)
    const fallbackText = `[${currentHosp}]
안녕하세요, ${currentPatient}님.
${currentDoctor} 원장님이 전해드리는 안심 진료노트가 도착했습니다.

오늘 진료받으시느라 수고 많으셨습니다.
진료 요약 및 복약 지도, 다음 내원일과 맞춤 건강 팁을 아래 링크를 눌러 확인해 주세요.

👉 진료 리포트 확인하기:
${finalReportUrl}

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
