require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai').OpenAI;

const app = express();

// CORS: 모든 출처 허용
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));

console.log('OPENAI_API_KEY 존재 여부:', !!process.env.OPENAI_API_KEY);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post('/poem', async (req, res) => {
  try {
    const { imageBase64, emotionScore } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64가 필요합니다.' });
    }

    const promptSystem = `
너는 한국의 실제 시를 추천하는 전문 시인 역할이다.

다음 조건을 반드시 지켜라:
1. 반드시 실제 존재하는 한국 시집에 수록된 시만 추천할 것.
2. 사진 속에서 보이는 사물을 최우선으로 상세히 분석할 것. 뚜렷하게 인식되는 사물이 가장 중요하며, 반드시 해당 사물이 시의 본문에 포함되어야 한다.
3. 사물이 명확하지 않은 경우, 색감과 분위기, 그리고 감정 점수를 함께 고려할 것.
4. 감정 점수는 0에서 10까지의 범위이며, 0은 매우 잔잔하고 평온한 상태, 10은 매우 흥분되고 격한 상태를 의미한다. 감정 점수를 시 추천과 설명에 반드시 반영하라.
5. 시는 반드시 다음 순서로 작성할 것:
   - 첫 줄: 시 제목
   - 둘째 줄: 시인 이름
   - 셋째 줄부터: 시 본문 (각 행은 \\n 으로 줄바꿈, 연과 연 사이는 반드시 \\n\\n 으로 구분)
6. 시가 너무 길 경우, 첫 연만 보여주고 반드시 "시가 너무 길어 첫 연만 보여드립니다."라는 문구를 시 해설 앞부분에 반드시 포함할 것.
7. 시 본문이 끝난 후 빈 줄 하나를 추가할 것.
8. 이후 시에 대한 설명을 작성할 것. 이 설명에서는 반드시 사진 속 사물과 시의 연결성을 구체적으로 설명하고, 색감, 분위기, 감정 점수를 바탕으로 시를 추천한 이유를 자연스럽게 작성할 것.
9. 마지막으로, 사진을 올린 사람의 심정을 사진 속 사물, 색감, 분위기, 감정 점수를 바탕으로 추측하고, 해당 사람에게 도움이 될 수 있는 짧은 위로의 말을 한 문장으로 작성할 것.
10. 설명과 시는 절대 섞이지 않도록 구분해서 작성할 것.
11. 링크, 코드블록, 따옴표 등 특수문자는 포함하지 말 것.
12. 사람 관련 정보(얼굴, 나이, 성별 등)는 절대 언급하지 말 것.
13. 반드시 일관된 형식을 유지할 것.
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: promptSystem,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
              '이 이미지를 보고 사진 속 사물을 최우선으로 구체적이고 상세하게 분석하여, 해당 사물이 시의 본문에 반드시 등장하는 한국의 시를 최우선으로 추천해줘. ' +
'사물이 명확하지 않다면 색감과 분위기를 분석하여 어울리는 시를 추천해. ' +
'사물은 반드시 명시적으로 분석하고, 시와의 관련성을 정확히 고려할 것. ' +
'사람에 대한 정보는 절대 언급하지 말고, 사람은 존재하지 않는다고 가정할 것. ' +
'시가 너무 길면 첫 연만 보여주고, 그 사실을 반드시 명시할 것. ' +
'링크는 절대 포함하지 말 것. ' +
'출력 형식은 반드시 위 시스템 프롬프트 조건을 따를 것.'
            },
            { type: 'image_url', image_url: { url: imageBase64 } },
          ],
        },
      ],
    });

    console.log('GPT 응답:', completion.choices[0].message.content);

    res.json({ poem: completion.choices[0].message.content });
  } catch (error) {
    console.error('API 호출 실패:', error);
    res.status(500).json({ error: error.message || '서버 오류가 발생했습니다.' });
  }
});

const port = process.env.PORT || 3001;

app.listen(port, '0.0.0.0', () => {
  console.log(`서버 실행 중: http://localhost:${port} (0.0.0.0 바인딩)`);
});