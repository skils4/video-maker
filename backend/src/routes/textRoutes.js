const express = require('express');
const router = express.Router();
const textController = require('../controllers/textController');

// Маршрут для обробки власного тексту
router.post('/custom', textController.processCustomText);

// Маршрут для рерайту тексту
router.post('/rewrite', textController.rewriteText);

// Маршрут для обробки YouTube посилання
router.post('/youtube', textController.processYouTubeLink);

module.exports = router;