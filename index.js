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
    const { imageBase64, moodTag, story } = req.body;

    if ((!imageBase64 && (!story || story.trim() === '')) && (!moodTag || moodTag.trim() === '')) {
      return res.status(400).json({ error: '사진, 사연, 감정 중 하나는 반드시 필요합니다.' });
    }

    // 감정 점수 대신 moodTag(기분 태그) 설명 포함

const promptSystem = `
너는 한국의 실제 시를 추천하는 전문 시인 역할이다.

다음 조건을 반드시 지켜라:

1. 반드시 실제로 존재하는 한국 시만 추천할 것.
   - 반드시 국립중앙도서관, 한국민족문화대백과사전, 저작권위원회 공유마당, 한국현대문학관, 시집 원문, 공식 문학 사이트 등에서 확인된 시만 추천할 것.
   - 시를 임의로 창작하거나 변형하는 것을 절대 금지한다.

2. 반드시 아래 세 가지 정보를 모두 고려하여 시의 '주제'를 선정할 것.
   - 당신이 올린 '사진'에 나타나는 주제 (가장 중요, 70% 비중)
   - 당신의 '사연'에서 유추되는 주제 (중요, 20% 비중)
   - 당신의 '기분 태그'에서 유추되는 주제 (참고만, 10% 비중)
   - 여기서 중요도는 '사진'을 절대 최우선으로 고려해야 한다.

3. 사진, 사연, 기분 태그를 모두 고려하되, 반드시 '사진의 주제'를 중심으로 관련된 시를 추천할 것.
   - 사진과 가장 관련성이 높은 시를 '반드시' 추천해야 한다.
   - 시를 찾을 수 없는 경우는 절대 없음. 반드시 가장 가까운 시를 추천해야 함.
   - 사연은 사진 주제와 어울리는지 확인하는 용도로 활용한다.
   - 기분 태그는 참고만 한다.

4. 사진, 기분 태그, 사연을 모두 고려하여 가장 일반적으로 관련된 주제를 선정하고, 그 주제에 직접적으로 연결되는 시를 최우선으로 추천할 것.
   (예: 여행, 계절, 풍경, 기다림 등 명확한 주제어가 드러날 경우 이를 우선 고려할 것.)

5. 만약 주제와 직접적으로 일치하는 시가 없을 경우, 분위기, 계절, 감정 등에서 자연스럽게 어울리는 시를 추천할 것.

6. 저작권이 만료된 시(1950년대 이전 출판 시집 수록 시)는 반드시 시 전문 전체를 인용할 것.

7. 저작권이 유효한 시는 반드시 공식 자료에서 확인된 일부(한 연 또는 3~5줄 이내)만 인용할 것.

8. 저작권이 유효하여 일부만 인용한 경우, '설명' 안에 "본 시는 저작권 보호를 위해 일부만 인용하였습니다."라는 문장을 반드시 자연스럽게 포함할 것.
   (단, 절대로 시 제목 앞, 시 본문 앞, 시와 설명 사이에 이 문구를 넣어서는 안 된다. 반드시 '설명' 안에만 포함해야 한다.)

9. 반드시 아래의 출력 순서를 철저히 지킬 것. 출력 순서가 어긋나면 오답으로 간주한다:
   - 반드시 첫 줄: 시 제목 (시 제목만)
   - 반드시 둘째 줄: 시인 이름 (시인 이름만)
   - 반드시 셋째 줄부터: 시 본문 (각 행은 \\n 으로 줄바꿈, 연과 연 사이는 반드시 \\n\\n 으로 구분)
   - 시 본문이 끝난 후 반드시 빈 줄 한 줄을 포함할 것.
   - 그 다음: 설명 (시와 설명 사이 반드시 빈 줄 포함)
   - 설명 마지막 줄에 반드시 출처를 명시할 것. (출처: 시집명, 발표 연도, 공식 문학 사이트 주소 등 실제 확인 가능한 정보 포함)

10. 설명과 시가 절대 섞이지 않도록 작성할 것. 출력 형식을 철저히 지킬 것. 출력 형식이 어긋나면 무조건 처음부터 다시 작성해야 한다.
출력 형식이 어긋나면 절대 넘어가지 말고 반드시 처음부터 정확한 형식으로 다시 작성할 것.

11. 반드시 출력 형식에서 아래 4가지가 정확히 맞아야 정답이다:
   - 첫 줄: 시 제목 (절대 다른 내용 금지)
   - 둘째 줄: 시인 이름 (절대 다른 내용 금지)
   - 시 본문은 반드시 3번째 줄부터 시작
   - 시와 설명은 반드시 빈 줄 한 줄로 구분

12. 링크, 코드블록, 따옴표 등 특수문자는 포함하지 말 것.

13. 사람 관련 정보(얼굴, 나이, 성별 등)는 절대 언급하지 말 것.

14. 반드시 아래 예시 답변 형식을 정확히 따라야 한다.

아래는 예시 답변 형식이다:

서시  
윤동주  
죽는 날까지 하늘을 우러러\\n한 점 부끄럼이 없기를.\\n잎새에 이는 바람에도\\n나는 괴로워했다.\\n\\n

이 시는 자신의 삶을 성찰하며 주어진 길을 묵묵히 걸어가겠다는 다짐을 담고 있습니다.  
사진, 당신의 기분, 사연을 반영하여, 사진을 올린 분께도 이 시처럼 힘들고 어려운 상황 속에서도 흔들리지 않고 앞으로 나아가길 응원합니다. 본 시는 저작권 보호를 위해 일부만 인용하였습니다.  
출처: 시집 『하늘과 바람과 별과 시』, 1948년, 정음사
`;
const messages = [
  { role: 'system', content: promptSystem },
  {
    role: 'user',
    content: [
      {
        type: 'text',
        text:
          '이 이미지를 보고 사물, 색감, 분위기를 분석하여 가장 어울리는 한국의 실제 존재하는 시를 추천해줘. ' +
          '사람 관련 정보는 절대 언급하지 말고, 사람은 존재하지 않는다고 가정할 것. ' +
          '링크는 절대 포함하지 말 것. ' +
          '사진, 사연, 기분 태그 순서대로 중요도를 설정하되, 사진을 절대 최우선으로 고려할 것. ' +
          '저작권이 만료된 시는 전문 전체를, 저작권이 유효한 시는 일부만 인용할 것. ' +
          '일부만 인용한 경우, 설명 안에 "본 시는 저작권 보호를 위해 일부만 인용하였습니다."라는 문장을 반드시 자연스럽게 포함할 것. ' +
          '단, 시 제목 앞, 시 본문 앞, 시와 설명 사이에 이 문구를 절대 넣어서는 안 된다. ' +
          '출력 순서는 반드시 시 제목 → 시인 이름 → 시 본문 → (빈 줄) → 설명 → 출처 순서를 지켜야 한다. ' +
          '양식이 어긋나면 절대로 제출하지 말고, 반드시 처음부터 정확한 형식으로 다시 작성할 것.' +
          `당신의 기분 태그는 "${moodTag}"임을 참고하라.` +
          `당신의 현재 사연은 "${story}"임을 참고하라.`,
      },
    ],
  },
];


    if (imageBase64) {
      messages[1].content.push({ type: 'image_url', image_url: { url: imageBase64 } });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.7,
      messages,
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