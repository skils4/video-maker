// routes/generationRoutes.js
const express = require('express');
const router = express.Router();
const generationController = require('../controllers/generationController');
const multer = require('multer');

// Налаштування для збереження файлів у пам'яті
const upload = multer({ storage: multer.memoryStorage() });

// Отримання списку голосів
router.get('/voices', generationController.getVoices);

// Генерація одного зображення
router.post('/image', generationController.generateImage);

// Генерація всіх зображень
router.post('/images-all', generationController.generateAllImages);

// Генерація одного аудіофайлу
router.post('/audio', generationController.generateAudio);

// Створення фінального відео (тільки один правильний запис)
router.post('/video', upload.single('musicFile'), generationController.createVideo);

module.exports = router;