require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const cors = require('cors');

const uploadRoutes = require('./routes/upload');
const recommendRoutes = require('./routes/recommend');

const app = express();

console.log('DATABASE_URL:', process.env.DATABASE_URL);

app.use(cors({
  origin: 'http://localhost:3000',
  optionsSuccessStatus: 200,
}));

app.use(express.json({ limit: '50mb' }));

// 시 데이터 업로드 API
app.use('/api', uploadRoutes);

// 추천 시 조회 API (벡터 DB 검색만 수행)
app.use('/api', recommendRoutes);

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`서버 실행 중: http://localhost:${port}`);
});