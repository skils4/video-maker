// test_api.js
const { VertexAI } = require('@google-cloud/vertexai');
const fs = require('fs').promises;
const path = require('path');

// --- Налаштування ---
const PROJECT_ID = 'mindful-path-464920-e6'; // Ваш ID проєкту
const LOCATION = 'us-central1';             // Регіон
const KEY_FILE_PATH = './gcloud-credentials.json'; // Шлях до вашого JSON ключа

// --- Ініціалізація ---
// Ми видалили `keyFile` звідси, бо передаємо його через термінал
const vertex_ai = new VertexAI({
  project: PROJECT_ID,
  location: LOCATION,
});

const model = 'imagegeneration@006'; // Стабільна модель для генерації зображень

// --- Основна функція ---
async function generateImageFinalTest() {
  console.log('Фінальний тест генерації зображень через Vertex AI...');
  
  try {
    const generativeModel = vertex_ai.getGenerativeModel({
      model: model,
    });

    const prompt = "A photorealistic, high-resolution image of a red cat sitting on a blue chair";
    
    const request = {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generation_config: {
        "sampleCount": 1
      }
    };

    console.log('Відправляю запит до Vertex AI з правильним методом...');
    
    const [response] = await generativeModel.generateContent(request);

    console.log('✅ Успіх! Отримано відповідь від Vertex AI.');
    
    const imageBase64 = response.candidates[0].content.parts[0].fileData.data;
    
    const filename = `test_image_${Date.now()}.png`;
    const filepath = path.join(process.cwd(), filename);
    await fs.writeFile(filepath, Buffer.from(imageBase64, 'base64'));

    console.log(`✅ Зображення успішно збережено у файл: ${filename}`);

  } catch (error) {
    console.error('❌ ВИНИКЛА ПОМИЛКА ПРИ РОБОТІ З VERTEX AI:');
    console.error(error);
  }
}

generateImageFinalTest();