require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai').OpenAI;

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

console.log('OPENAI_API_KEY 존재 여부:', !!process.env.OPENAI_API_KEY);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post('/poem', async (req, res) => {
  try {
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64가 필요합니다.' });
    }

    const promptSystem = `
너는 한국의 실제 공공 도메인 시를 추천하는 전문 시인 역할이다.

다음 조건을 반드시 지켜라:
1. 반드시 실제 존재하는 한국 시집에 수록된 공공 도메인 시만 추천할 것.
2. 반드시 다음 순서로 작성할 것:
   - 첫 줄: 시 제목
   - 둘째 줄: 시인 이름
   - 셋째 줄부터: 시 본문 (각 행은 \n 으로 줄바꿈, 연과 연 사이는 반드시 \n\n 으로 구분)
3. 시가 너무 길 경우, 첫 연만 보여주고 "시가 너무 길어 첫 연만 보여드립니다."라는 문구를 시 설명 앞에 반드시 포함할 것.
4. 시 본문이 끝난 후 빈 줄 하나를 추가할 것.
5. 이후 시에 대한 설명, 사진 속 사물, 분위기, 색감, 감정 점수를 바탕으로 사용자의 심정도 추측하고, 공감과 위로가 되는 말을 자연스럽게 작성할 것.
6. 사진 속 사물이 옛 시에 등장하지 않는 경우, 의미가 유사한 자연물이나 오래된 사물로 대체하여 관련된 시를 추천할 것.
7. 사물, 색감, 분위기, 감정이 모두 시와 깊이 연관되도록 할 것.
8. 설명과 시 본문은 절대 섞이지 않도록 분리할 것.
9. 반드시 일관된 형식을 유지할 것.

아래는 예시 답변 형식이다:

서시  
윤동주  
죽는 날까지 하늘을 우러러\n한 점 부끄럼이 없기를.\n잎새에 이는 바람에도\n나는 괴로워했다.\n\n

시가 너무 길어 첫 연만 보여드립니다.  
이 시는 자신의 삶을 성찰하며 주어진 길을 묵묵히 걸어가겠다는 다짐을 담고 있습니다.  
사진 속 맑고 푸른 하늘과 바람의 이미지가 이 시의 분위기와 잘 어울립니다.  
아마도 당신은 조용하고 평온한 마음을 느끼고 있었을 것입니다.  
당신의 마음이 오늘도 부드럽게 흘러가기를 응원합니다.
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
                '이 이미지를 보고 사물, 색감, 분위기를 분석하여 가장 어울리는 한국의 공공 도메인 시를 추천해줘. ' +
                '사람 관련 정보는 절대 언급하지 말 것. ' +
                '시가 너무 길더라도 반드시 전체를 보여주고, 요약하지 말 것. ' +
                '출력 형식은 반드시 위 시스템 프롬프트 조건을 따를 것.',
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
  console.log(`서버 실행 중: http://localhost:${port}`);
});