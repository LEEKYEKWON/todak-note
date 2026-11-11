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

    const systemPrompt = `당신은 대한민국 1위 친절한 명의가 환자에게 보내는 '맞춤 안심 진료 리포트' 작성 AI입니다.
의사와 환자의 진료실 대화 내용을 분석하여 환자(${patientNameClean})가 집에 가서도 안심하고 복약/관리할 수 있도록 친절하고 신뢰감 넘치는 한국어로 안내 리포트를 작성하세요.

오늘 기준 날짜는 ${currentYear}년 ${currentMonth}월 ${currentDate}일(${currentDay}요일)입니다.

[작성 및 환각(Hallucination) 방지 절대 규칙]
1. 진료실 대화에 등장하지 않은 가상의 병명, 가상의 약물, 가상의 증상을 절대 지어내지 마세요.
2. 환자가 의사로부터 직접 들은 진단, 안내사항, 처방 주의사항을 핵심 위주로 명확히 정리하세요.
3. 재방문 예정일(nextVisitDate)은 진료실 대화에 날짜/요일이나 기간(예: "3일 뒤에 오세요", "다음 주 목요일")이 명시된 경우 오늘 날짜(${currentYear}년 ${currentMonth}월 ${currentDate}일) 기준으로 정확한 날짜/요일로 계산해서 적고, 특별한 언급이 없으면 "불편한 증상이 지속되거나 심해지실 경우 내원"이라고 적으세요.
4. 반드시 아래 지정된 JSON 형식으로만 응답해야 하며, 마크다운 코드블록(\`\`\`json) 없이 순수 JSON 문자열만 출력하세요.

JSON 출력 형식:
{
  "greeting": "${patientNameClean}, 오늘 진료받으시느라 수고 많으셨습니다. 빠른 쾌유를 위해 진료 내용을 정리해 드립니다.",
  "diagnosisSummary": "의사의 진단 및 현재 환자의 상태에 대한 친절한 설명 (2~3문장)",
  "medicationGuide": "처방된 약의 복용 방법과 꼭 지켜야 할 주의사항 (예: 식후 즉시 복용, 졸릴 수 있음 등)",
  "lifestyleCare": [
    "일상생활 속 실천 지침 1",
    "일상생활 속 실천 지침 2",
    "일상생활 속 실천 지침 3"
  ],
  "nextVisitDate": "재방문 권장 일자 (예: ${currentMonth}월 12일(목) 또는 증상 지속 시 내원)",
  "cheeringMessage": "환자의 빠른 쾌유를 진심으로 응원하는 따뜻한 마무리 문장 (1~2문장)"
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
          res.status(500).json({ error: e.message });
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

