const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const OpenAI = require('openai').OpenAI;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

console.log(process.env.DATABASE_URL);

// POST /api/poems - 시 등록
router.post('/poems', async (req, res) => {
  try {
    const { title, author, excerpt, source } = req.body;

    if (!title || !author || !excerpt || !source) {
      return res.status(400).json({ success: false, error: '모든 필드를 입력해주세요.' });
    }

    // GPT 임베딩 생성
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: excerpt,
    });

    const embedding = embeddingResponse.data[0].embedding;

    await pool.query(
      'INSERT INTO poems (title, author, excerpt, source, embedding) VALUES ($1, $2, $3, $4, $5)',
      [title, author, excerpt, source, JSON.stringify(embedding)]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('시 등록 오류:', err);
    res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;