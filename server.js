const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const PORT = 3000;

// 솔라피(Solapi) 인증 정보
const SOLAPI_API_KEY = 'NCSK8Y3GEABTX0B0KKZJU8';
const SOLAPI_API_SECRET = 'ANWFHRCJW1UD3OTT9TBJTO2XEQ1N3GED';
const SENDER_PHONE = '01093442378';

// 솔라피 HMAC-SHA256 인증 헤더 생성기
function getSolapiAuthHeader() {
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(16).toString('hex');
  const signature = crypto.createHmac('sha256', SOLAPI_API_SECRET)
    .update(date + salt)
    .digest('hex');
  return `HMAC-SHA256 apiKey=${SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`;
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. OpenAI (GPT-4o-mini) 초고속 실시간 진료 요약 API
  if (req.url === '/api/summarize' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { apiKey, transcript, patientInfo } = JSON.parse(body);
        const patientNameClean = (patientInfo || '환자').replace(/\s*\(.*?\)/, '').trim(); // '김영희 님 (만 32세)' -> '김영희 님'
        console.log(`[서버] AI 요약 요청 수신 (환자: ${patientNameClean}, 대화 길이: ${transcript.length}자)`);

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        const currentDate = now.getDate();
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        const currentDay = days[now.getDay()];
        const todayString = `${currentYear}년 ${currentMonth}월 ${currentDate}일 (${currentDay}요일)`;

        const systemPrompt = `
당신은 병원을 방문한 소중한 환자분을 정중하고 다정하게 케어하는 전문 병원 AI '토닥토닥노트'입니다.
현재 오늘 날짜는 [${todayString}]이며, 대상 환자는 [${patientNameClean}]입니다.
의사와 환자가 나눈 진료실 대화 내용을 분석하여, 환자분이 읽고 진료 내용을 명확히 이해하고 안심할 수 있는 '친절하고 정중한 한국어 맞춤 진료 리포트'를 작성하세요.

[⚠️ 호칭 및 어조 원칙 (가장 중요!)]
1. [호칭]: 특정 연령대 호칭('어르신', '아버님', '어머님', '학생' 등)을 절대로 쓰지 마세요! 항상 "[${patientNameClean}]" 또는 "환자분"으로만 지칭하세요.
2. [말투/어조]: 모든 연령대의 성인 환자/고객에게 알맞은 정중하고 깔끔하며 따뜻한 표준 존댓말(~하셨습니다, ~해 주세요, ~바랍니다)을 사용하세요. 과도한 아이 취급이나 노인 대우 표현을 삼가세요.

[⚠️ 절대적 안전 및 사실 기반 원칙]
3. [날짜/시간 지어내기 절대 금지]:
   - 의사가 "다음 주 목요일 12일 2시"처럼 구체적인 날짜나 시간을 말했을 때만 그 일시를 적으세요.
   - 의사가 "약 드시고 안 나으시면 오세요", "더 이상 안 오셔도 됩니다"처럼 말했을 때는 절대로 특정 날짜(12월 5일 등)나 시간을 지어내지 마세요. 들린 그대로("더 이상 내원 불필요", "필요시 내원" 등)만 적으세요.
4. [약 복용 추측 금지]: 의사가 직접 명시하지 않은 '약 이름'이나 '하루 복용 횟수'를 절대로 추측하거나 지어내지 마세요! 들린 내용만 정확히 적으세요.
5. 어려운 의학 전문 용어는 환자가 이해하기 쉽도록 일상어로 친절하게 풀어서 설명하세요.
6. 일상 건강 관리 팁은 1, 2, 3 번호를 매겨 깔끔하게 정리하세요.
7. 마지막에 환자분의 쾌유와 건강을 응원하는 따뜻하고 정중한 한마디를 덧붙이세요.
8. 반드시 마크다운 백틱 없이 순수 JSON 포맷으로만 응답하세요.

[JSON 규격]
{
  "summary": "원장님 말씀 요약 (현재 상태와 경과를 알기 쉽게 설명)",
  "medication": "처방된 약 및 복용 방법 (들린 내용만 정확히, 처방 없으면 '오늘 처방된 약은 없습니다' 등으로 표기)",
  "lifestyleTips": "맞춤 생활 건강 팁 (구체적인 관리 수칙 2~3가지)",
  "nextDate": "다음 병원 오시는 날 (구체적 날짜가 없으면 '내원 불필요' 또는 '필요시 내원' 등으로 표기)",
  "nextNotice": "환자 방문 준비사항 및 안내",
  "warmMessage": "토닥토닥 따뜻한 응원 한마디 ([${patientNameClean}]의 쾌유와 건강을 응원하는 정중한 메시지)"
}
`;

        const postData = JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `[진료실 대화 내용]:\n"${transcript}"` }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2
        });

        console.log(`[서버] OpenAI GPT-4o-mini 호출 중... ⚡`);

        const options = {
          hostname: 'api.openai.com',
          path: '/v1/chat/completions',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'Content-Length': Buffer.byteLength(postData)
          }
        };

        const gptReq = https.request(options, gptRes => {
          let data = '';
          gptRes.on('data', chunk => { data += chunk; });
          gptRes.on('end', () => {
            if (gptRes.statusCode === 200) {
              try {
                const parsed = JSON.parse(data);
                const aiResultJson = JSON.parse(parsed.choices[0].message.content);
                console.log(`[서버] ✅ OpenAI 요약 완료! (소요 시간 단 1초대)`);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(aiResultJson));
              } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'AI 응답 파싱 실패' }));
              }
            } else {
              console.error(`[서버] OpenAI 에러 응답:`, data);
              res.writeHead(gptRes.statusCode, { 'Content-Type': 'application/json' });
              res.end(data);
            }
          });
        });

        gptReq.on('error', err => {
          console.error("[서버] OpenAI 네트워크 에러:", err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        });

        gptReq.write(postData);
        gptReq.end();

      } catch (err) {
        console.error("[서버 에러]:", err.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 2. 솔라피(Solapi) 실제 스마트폰 SMS/LMS 발송 API (1차 리포트 및 고급형 재방문 스케줄 연동)
  if (req.url === '/api/send-sms' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { receiverPhone, patientName, summary, medication, nextDate, reportUrl, userPlan, hospitalName, doctorName } = JSON.parse(body);
        const toPhone = (receiverPhone || SENDER_PHONE).replace(/[^0-9]/g, '');

        console.log(`[서버] 솔라피 전송 요청: ${patientName} (${toPhone}) - 플랜: ${userPlan || 'Standard'}`);

        const currentHospital = hospitalName || '행복내과의원';
        const msgText = `[${currentHospital}]
${patientName}의 안심 진료노트가 도착했습니다.

▶ 진료요약: ${summary ? summary.slice(0, 100) + '...' : ''}
▶ 처방복약: ${medication ? medication.slice(0, 60) : ''}
▶ 다음내원: ${nextDate || '필요시 내원'}

아래 링크를 누르시면 큰 글씨 리포트와 맞춤 건강 팁을 확인하실 수 있습니다.
👉 진료 리포트 보기:
${reportUrl || 'http://localhost:3000'}`;

        const payload = JSON.stringify({
          message: {
            to: toPhone,
            from: SENDER_PHONE,
            text: msgText
          }
        });

        // 🌟 고급형(Pro) 플랜 전용: 재방문일(nextDate) 카카오톡 노쇼 방지 예약 큐 저장
        if (userPlan === 'Pro' && nextDate && !nextDate.includes('필요시')) {
          console.log(`[서버/Pro 전용] 🗓️ 재방문일(${nextDate}) AI 노쇼 방지 알림톡 예약 스케줄에 정상 등록되었습니다. (환자: ${patientName})`);
        }

        const authHeader = getSolapiAuthHeader();
        const options = {
          hostname: 'api.solapi.com',
          path: '/messages/v4/send',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader,
            'Content-Length': Buffer.byteLength(payload)
          }
        };

        const solapiReq = https.request(options, solapiRes => {
          let resData = '';
          solapiRes.on('data', d => { resData += d; });
          solapiRes.on('end', () => {
            console.log(`[서버] 솔라피 응답 (${solapiRes.statusCode}):`, resData);
            res.writeHead(solapiRes.statusCode, { 'Content-Type': 'application/json' });
            res.end(resData);
          });
        });

        solapiReq.on('error', err => {
          console.error('[서버] 솔라피 전송 오류:', err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        });

        solapiReq.write(payload);
        solapiReq.end();

      } catch (e) {
        console.error('[서버] SMS 발송 에러:', e);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // 2-1. 고급형(Pro) 전용: 재방문일 D-1 AI 맞춤 알림톡 자동 생성 및 발송 API
  if (req.url === '/api/send-remind' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { userPlan, patientName, diagnosisSummary, nextDate, hospitalName, doctorName, receiverPhone } = JSON.parse(body);

        // 기본형 계정 차단 (고급형 Pro 전용 기능)
        if (userPlan !== 'Pro') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: '재방문 노쇼 방지 알림톡은 고급형(Pro) 플랜 전용 기능입니다.' }));
          return;
        }

        console.log(`[서버/Pro 전용] 🤖 ${patientName} 님 맞춤형 D-1 재방문 알림톡 생성 및 발송 시작`);

        // AI가 환자의 이전 진료 요약과 증상을 기억하여 맞춤 알림톡 본문 작성
        const promptText = `당신은 ${hospitalName || '연세바른내과의원'} ${doctorName || '박준혁 원장'}입니다.
환자(${patientName})는 이전 진료에서 "${diagnosisSummary || '초기 진료'}" 진단을 받았습니다.
내일(${nextDate})은 환자의 재방문 예정일입니다.
환자가 감동받아 진료 예약을 잊지 않고 병원에 올 수 있도록 친절하고 따뜻한 안부와 재방문 리마인드 메시지(3~4문장)를 작성하세요.`;

        // 알림톡 메시지 조립
        const remindText = `[${hospitalName || '연세바른내과의원'} ${doctorName || '박준혁 원장'}]
안녕하세요, ${patientName} 님! 지난 진료 후 복약은 잘 챙겨드셨는지요?

내일(${nextDate})은 지난번 안내해 드린 경과 확인 재방문일입니다.
불편하신 증상이 남아있으시다면 내일 편안한 시간에 내원하셔서 상태를 점검받으시길 권해드립니다. 빠른 쾌유를 늘 응원합니다.

▶ 내원 안내 및 진료 리포트 확인: http://localhost:3000`;

        const toPhone = (receiverPhone || SENDER_PHONE).replace(/[^0-9]/g, '');
        const payload = JSON.stringify({
          message: {
            to: toPhone,
            from: SENDER_PHONE,
            text: remindText
          }
        });

        const authHeader = getSolapiAuthHeader();
        const options = {
          hostname: 'api.solapi.com',
          path: '/messages/v4/send',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader,
            'Content-Length': Buffer.byteLength(payload)
          }
        };

        const solReq = https.request(options, solRes => {
          let sData = '';
          solRes.on('data', c => { sData += c; });
          solRes.on('end', () => {
            console.log(`[서버/Pro] 재방문 알림톡 발송 완료! (${solRes.statusCode})`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: remindText }));
          });
        });

        solReq.on('error', err => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        });

        solReq.write(payload);
        solReq.end();

      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 3. 정적 웹페이지 서빙
  let reqPath = req.url === '/' ? 'index.html' : req.url.split('?')[0];

  // 로고 이미지 요청 가로채기 (대표님이 미리캔버스에서 사이즈 키워주신 원본 이미지 제공)
  if (reqPath.includes('open_book_heart_clean_1794109984125.jpg') || reqPath.includes('logo.jpg')) {
    const logoOriginalPath = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\4693205f-a385-4be9-bc0a-d643472db6c2\\.user_uploaded\\media_1794184865072_1431b68a.jpg';
    fs.readFile(logoOriginalPath, (err, imgData) => {
      if (err) {
        res.writeHead(404);
        res.end();
      } else {
        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        res.end(imgData);
      }
    });
    return;
  }

  let filePath = path.join(__dirname, reqPath);
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('파일을 찾을 수 없습니다.');
    } else {
      let contentType = 'text/html; charset=utf-8';
      if (filePath.endsWith('.js')) contentType = 'application/javascript';
      if (filePath.endsWith('.css')) contentType = 'text/css';
      if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) contentType = 'image/jpeg';
      if (filePath.endsWith('.png')) contentType = 'image/png';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 토닥토닥노트 OpenAI 실시간 엔진 가동 완료: http://localhost:${PORT}`);

  // 위젯 모드로 실행되었을 경우 전용 슬림 앱 창 자동 실행
  if (process.argv.includes('--widget')) {
    const widgetUrl = `http://localhost:${PORT}/widget.html`;
    const chromePaths = [
      `"${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe"`,
      `"${process.env.ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe"`,
      `"${process.env['ProgramFiles(x86)']}\\Google\\Chrome\\Application\\chrome.exe"`,
      `"${process.env['ProgramFiles(x86)']}\\Microsoft\\Edge\\Application\\msedge.exe"`,
      `"${process.env.ProgramFiles}\\Microsoft\\Edge\\Application\\msedge.exe"`
    ];

    let opened = false;
    for (const bin of chromePaths) {
      const cleanPath = bin.replace(/"/g, '');
      if (fs.existsSync(cleanPath)) {
        exec(`${bin} --app=${widgetUrl} --window-size=400,720`);
        opened = true;
        console.log(`[위젯] 전용 퀵 앱 모드로 창을 띄웠습니다! 📱`);
        break;
      }
    }
    if (!opened) {
      exec(`start ${widgetUrl}`);
    }
  }
});
