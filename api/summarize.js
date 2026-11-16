const https = require('https');

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

[중요 검증 지침]
1. 입력된 대화가 실제 의사와 환자의 진료 대화인지 판단하세요.
2. 직원/간호사 간의 업무 지시나 잡담, 점심 메뉴, 의미 없는 말소리 파편 등 진료와 무관한 경우 반드시 "isMedicalDialogue": false 로 작성하세요.
3. 실제 진료 대화인 경우 "isMedicalDialogue": true 로 작성하세요.
4. 반드시 유효한 순수 JSON 객체 하나만 출력하세요.

JSON 출력 포맷:
{
  "isMedicalDialogue": true 또는 false,
  "reason": "isMedicalDialogue가 false일 때의 사유 (예: 원장님/직원 간의 업무 대화 또는 진료와 무관한 일상 대화)",
  "greeting": "${patientNameClean}, 오늘 진료받으시느라 수고 많으셨습니다.",
  "diagnosisSummary": "대화에 언급된 실제 진단과 상태 요약 (대화에 없는 내용 지어내지 말 것)",
  "medicationGuide": "처방된 약 복용 안내 (언급 없으면 처방전 참고 안내)",
  "lifestyleCare": ["생활 관리 수칙 1", "생활 관리 수칙 2"],
  "nextVisitDate": "재방문 안내 (언급 없으면 '불편한 증상 지속 시 내원')",
  "cheeringMessage": "환자를 위한 따뜻한 응원 문장"
}`;

    const payload = JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `[환자 정보: ${patientInfo || '김영희 님'}]\n\n[진료실 실제 대화 녹음 스크립트]:\n${transcript}` }
      ],
      temperature: 0.2,
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
          if (parsed.error) {
            res.status(400).json({ error: parsed.error.message || 'OpenAI API 오류', details: parsed.error });
            return;
          }
          if (parsed.choices && parsed.choices[0] && parsed.choices[0].message) {
            const rawContent = parsed.choices[0].message.content;
            // JSON 마크다운 코드블록 제거 안전망
            const cleaned = rawContent.replace(/```json/gi, '').replace(/```/g, '').trim();
            const resultJson = JSON.parse(cleaned);
            res.status(200).json(resultJson);
          } else {
            res.status(500).json({ error: 'AI 응답 형식이 올바르지 않습니다.', raw: parsed });
          }
        } catch (e) {
          res.status(500).json({ error: `응답 파싱 오류: ${e.message}`, raw: gptData });
        }
      });
    });

    gptReq.on('error', err => {
      res.status(500).json({ error: `통신 장애: ${err.message}` });
    });

    gptReq.write(payload);
    gptReq.end();

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
