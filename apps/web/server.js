const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use('/api/polymarket', createProxyMiddleware({
  target: 'https://gamma-api.polymarket.com',
  changeOrigin: true,
  pathRewrite: { '^/api/polymarket': '' },
  secure: true,
}));

app.use('/api/kalshi', createProxyMiddleware({
  target: 'https://api.elections.kalshi.com',
  changeOrigin: true,
  pathRewrite: { '^/api/kalshi': '' },
  secure: true,
}));

app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
