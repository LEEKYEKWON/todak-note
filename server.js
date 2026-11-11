const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const SOLAPI_API_KEY = 'NCSK8Y3GEABTX0B0KKZJU8';
const SOLAPI_API_SECRET = 'ANWFHRCJW1UD3OTT9TBJTO2XEQ1N3GED';
const SENDER_PHONE = '01093442378';

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

  // 1. OpenAI (GPT-4o-mini) 실시간 진료 요약 API
  if (req.url === '/api/summarize' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { apiKey, transcript, patientInfo } = JSON.parse(body);
        const patientNameClean = (patientInfo || '환자').replace(/\s*\(.*?\)/, '').trim();

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        const currentDate = now.getDate();
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        const currentDay = days[now.getDay()];

        const systemPrompt = `당신은 대한민국 1위 친절한 명의가 환자에게 보내는 '맞춤 안심 진료 리포트' 작성 AI입니다.
의사와 환자의 진료실 대화 내용을 분석하여 환자(${patientNameClean})가 집에 가서도 안심하고 복약/관리할 수 있도록 친절하고 신뢰감 넘치는 한국어로 안내 리포트를 작성하세요.

오늘 기준 날짜는 ${currentYear}년 ${currentMonth}월 ${currentDate}일(${currentDay}요일)입니다.

JSON 출력 형식:
{
  "greeting": "${patientNameClean}, 오늘 진료받으시느라 수고 많으셨습니다. 빠른 쾌유를 위해 진료 내용을 정리해 드립니다.",
  "diagnosisSummary": "의사의 진단 및 현재 환자의 상태에 대한 친절한 설명 (2~3문장)",
  "medicationGuide": "처방된 약의 복용 방법과 주의사항",
  "lifestyleCare": [
    "일상생활 속 실천 지침 1",
    "일상생활 속 실천 지침 2",
    "일상생활 속 실천 지침 3"
  ],
  "nextVisitDate": "재방문 권장 일자",
  "cheeringMessage": "따뜻한 마무리 문장 (1~2문장)"
}`;

        const postData = JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `[환자 정보: ${patientInfo || '김영희 님'}]\n\n[진료실 실제 대화 녹음 스크립트]:\n${transcript}` }
          ],
          response_format: { type: "json_object" },
          temperature: 0.3
        });

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
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(aiResultJson));
              } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'AI 응답 파싱 실패' }));
              }
            } else {
              res.writeHead(gptRes.statusCode, { 'Content-Type': 'application/json' });
              res.end(data);
            }
          });
        });

        gptReq.on('error', err => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        });

        gptReq.write(postData);
        gptReq.end();

      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 2. 솔라피(Solapi) 발송 API
  if (req.url === '/api/send-sms' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { receiverPhone, patientName, summary, medication, nextDate, reportUrl, hospitalName } = JSON.parse(body);
        const toPhone = (receiverPhone || SENDER_PHONE).replace(/[^0-9]/g, '');

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
            res.writeHead(solapiRes.statusCode, { 'Content-Type': 'application/json' });
            res.end(resData);
          });
        });

        solapiReq.on('error', err => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        });

        solapiReq.write(payload);
        solapiReq.end();

      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // 3. 파일 서비스 (Vercel 및 로컬 공통 완벽 호환)
  let cleanUrl = req.url.split('?')[0];
  let fileName = cleanUrl === '/' ? 'index.html' : cleanUrl.replace(/^\//, '');

  let targetPath = path.resolve(__dirname, fileName);

  if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
    let contentType = 'text/html; charset=utf-8';
    if (fileName.endsWith('.js')) contentType = 'application/javascript';
    if (fileName.endsWith('.css')) contentType = 'text/css';
    if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) contentType = 'image/jpeg';
    if (fileName.endsWith('.png')) contentType = 'image/png';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(targetPath).pipe(res);
  } else {
    // 무조건 메인 index.html(랜딩페이지) 서빙
    let indexPath = path.resolve(__dirname, 'index.html');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(indexPath).pipe(res);
  }
});

// Vercel Serverless Function으로 내보내기
module.exports = server;

// 로컬 단독 실행 지원
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`🚀 토닥토닥노트 로컬 서버 가동 완료: http://localhost:${PORT}`);
  });
}
