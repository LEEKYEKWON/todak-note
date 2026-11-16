const https = require('https');

module.exports = async (req, res) => {
  // CORS 설정
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
    const { apiKey, transcript, patientInfo } = req.body || {};
    const patientNameClean = (patientInfo || '환자').replace(/\s*\(.*?\)/, '').trim();

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDate = now.getDate();
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const currentDay = days[now.getDay()];

    const systemPrompt = `당신은 의사와 환자의 진료실 대화 내용을 분석하여 환자(${patientNameClean}) 맞춤 안심 진료 리포트를 작성하는 전문 의료 AI 어시스턴트입니다.

오늘 기준 날짜는 ${currentYear}년 ${currentMonth}월 ${currentDate}일(${currentDay}요일)입니다.

[최우선 필수 판별]
입력된 스크립트가 실제 의사-환자 간의 진료 대화(환자의 질환, 증상, 진단, 처방약, 치료 지침 등)인지 확인하세요.
만약 원장님과 직원/간호사 간의 잡담/업무지시(예: "김 간호사 주문한 거 언제 들어온대"), 안부 인사, 일상 잡담, 의미 없는 파편일 경우 반드시 아래와 같이 isMedicalDialogue: false 로 응답하세요:
{
  "isMedicalDialogue": false,
  "reason": "원장님/직원 간의 업무 대화 또는 진료와 무관한 일상 대화로 감지되었습니다."
}

[실제 진료 대화일 때만 응답 형식]
{
  "isMedicalDialogue": true,
  "greeting": "${patientNameClean}, 오늘 진료받으시느라 수고 많으셨습니다.",
  "diagnosisSummary": "대화에 언급된 실제 진단과 상태 요약",
  "medicationGuide": "처방된 약 복용 안내 (언급 없으면 처방전 참고 안내)",
  "lifestyleCare": ["생활 관리 수칙 1", "생활 관리 수칙 2"],
  "nextVisitDate": "재방문 안내",
  "cheeringMessage": "환자를 위한 따뜻한 응원 문장"
}`;

    const payload = JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `[환자 정보: ${patientInfo || '김영희 님'}]\n\n[진료실 실제 대화 녹음 스크립트]:\n${transcript}` }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const openAiApiKey = apiKey || process.env.OPENAI_API_KEY;

    if (!openAiApiKey) {
      res.status(400).json({ error: 'OpenAI API 키가 필요합니다.' });
      return;
    }

    const options = {
      hostname: 'api.openai.com',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openAiApiKey}`,
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const gptReq = https.request(options, gptRes => {
      let gptData = '';
      gptRes.on('data', chunk => { gptData += chunk; });
      gptRes.on('end', () => {
        try {
          const parsed = JSON.parse(gptData);
          if (parsed.choices && parsed.choices[0]) {
            const resultJson = JSON.parse(parsed.choices[0].message.content);
            res.status(200).json(resultJson);
          } else {
            res.status(500).json({ error: 'AI 응답 파싱 실패', raw: parsed });
          }
        } catch (e) {
          res.status(500).json({ error: e.message, raw: gptData });
        }
      });
    });

    gptReq.on('error', err => {
      res.status(500).json({ error: err.message });
    });

    gptReq.write(payload);
    gptReq.end();

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
