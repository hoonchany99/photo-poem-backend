require('dotenv').config();
const express = require('express');
const cors = require('cors');

const uploadRoutes = require('./routes/upload');
const recommendRoutes = require('./routes/recommend');
const imageRoutes = require('./routes/image');

const app = express();

console.log('DATABASE_URL:', process.env.DATABASE_URL);
console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY);

app.use(cors({
  origin: ['http://localhost:3000','https://photo-poem-frontend.vercel.app'],
  optionsSuccessStatus: 200,
}));

app.use(express.json({ limit: '50mb' }));

app.use('/api/image', imageRoutes);
// 시 데이터 업로드 API
app.use('/api', uploadRoutes);

// 추천 시 조회 API (벡터 DB 검색만 수행)
app.use('/api', recommendRoutes);

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`서버 실행 중: http://localhost:${port}`);
});