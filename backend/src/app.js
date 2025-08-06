// src/app.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const path = require('path');
const { initSocket } = require('./socket'); // Імпортуємо ініціалізатор

dotenv.config();

const app = express();
const server = http.createServer(app);

// Ініціалізуємо Socket.IO, передаючи йому HTTP сервер
initSocket(server);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Статичні файли
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Маршрути
const textRoutes = require('./routes/textRoutes');
app.use('/api/text', textRoutes);

const generationRoutes = require('./routes/generationRoutes');
app.use('/api/generate', generationRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Сервер працює! 🎉' });
});

// Запускаємо сервер
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Сервер запущено на порту ${PORT}`);
  console.log(`📍 Відкрийте http://localhost:${PORT} у браузері`);
});

// Нічого не експортуємо, щоб уникнути циклічних залежностей