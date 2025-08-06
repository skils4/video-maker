<template>
  <div class="video-maker">
    <h1>🎬 Video Maker Service</h1>
    
    <div class="mode-selector">
      <button 
        :class="{ active: mode === 'custom' }"
        @click="mode = 'custom'"
      >
        ✏️ Власний текст
      </button>
      <button 
        :class="{ active: mode === 'rewrite' }"
        @click="mode = 'rewrite'"
      >
        🔄 Текст для рерайту
      </button>
      <button 
        :class="{ active: mode === 'youtube' }"
        @click="mode = 'youtube'"
      >
        📺 YouTube відео
      </button>
    </div>

    <div class="language-selector">
      <label>Мова готового відео:</label>
      <select v-model="outputLanguage">
        <option value="uk">🇺🇦 Українська</option>
        <option value="en">🇬🇧 English</option>
        <option value="ru">🇷🇺 Русский</option>
      </select>
    </div>

    <div class="provider-selector">
      <label>Генерація зображень:</label>
      <select v-model="imageProvider">
        <option value="pollinations">🟩 Pollinations (безкоштовно)</option>
        <option value="stable-diffusion">🟦 Stable Diffusion</option>
        <option value="vertex">🔷 Google Imagen (Vertex AI)</option>
      </select>
    </div>

    <div class="voice-settings">
      <div class="setting-group">
        <label for="voice-select">Голос:</label>
        <select id="voice-select" v-model="selectedVoice" :disabled="voicesLoading">
          <option v-if="voicesLoading" value="">Завантаження голосів...</option>
          <option v-for="voice in availableVoices" :key="voice.name" :value="voice.name">
            {{ voice.name }}
          </option>
        </select>
      </div>
      <div class="setting-group">
        <label for="speaking-rate">Швидкість: {{ speakingRate.toFixed(2) }}x</label>
        <input type="range" id="speaking-rate" min="0.5" max="1.5" step="0.05" v-model.number="speakingRate">
      </div>
      <div class="setting-group">
        <label for="pitch">Тон: {{ pitch.toFixed(1) }}</label>
        <input type="range" id="pitch" min="-10" max="10" step="0.5" v-model.number="pitch">
      </div>
      <div class="setting-group ssml-group">
        <label for="ssml-template">Стиль озвучки (інструкція)</label>
        <input 
          id="ssml-template" 
          type="text" 
          v-model="ssmlTemplate" 
          placeholder="Наприклад: читай бадьоро та голосно"
        >
      </div>
    </div>

    <div class="input-section">
      <div v-if="mode === 'custom'" class="input-group">
        <label>Введіть текст для відео:</label>
        <textarea 
          v-model="customText"
          placeholder="Напишіть вашу історію тут..."
          rows="8"
        ></textarea>
        <button @click="processCustomText" :disabled="!customText || loading">
          {{ loading ? 'Обробка...' : 'Обробити текст' }}
        </button>
      </div>

      <div v-if="mode === 'rewrite'" class="input-group">
        <label>Введіть текст для рерайту:</label>
        <textarea 
          v-model="rewriteText"
          placeholder="Вставте текст який потрібно переписати..."
          rows="8"
        ></textarea>
        <button @click="processRewrite" :disabled="!rewriteText || loading">
          {{ loading ? 'Обробка...' : 'Рерайт тексту' }}
        </button>
      </div>

      <div v-if="mode === 'youtube'" class="input-group">
        <label>YouTube посилання:</label>
        <input 
          v-model="youtubeUrl"
          type="url"
          placeholder="https://www.youtube.com/watch?v=..."
        >
        <button @click="processYouTube" :disabled="!youtubeUrl || loading">
          {{ loading ? 'Обробка...' : 'Витягти субтитри' }}
        </button>
      </div>
    </div>
    
    <div v-if="progressMessage" class="progress-message">
      {{ progressMessage }}
    </div>

    <div v-if="blocks.length > 0" class="results-section">
      <h2>📝 Блоки тексту ({{ blocks.length }})</h2>
      
      <div class="blocks-container">
        <div v-for="block in blocks" :key="block.id" class="block-item">
          <div class="block-header">
            <h3>Блок {{ block.id }}</h3>
          </div>
          
          <div class="block-content">
            <div class="text-section">
              <label>Текст:</label>
              <p>{{ block.text }}</p>
            </div>
            
            <div class="prompt-section">
              <label>Промпт для картинки:</label>
              <input 
                v-model="block.imagePrompt" 
                type="text"
                placeholder="Опис для генерації зображення"
              >
            </div>
            <div v-if="block.imageUrl" class="image-section">
              <label>Згенероване зображення:</label>
              <img :src="block.imageUrl" :alt="block.imagePrompt" />
            </div>
            <div class="actions">
              <button @click="generateImage(block)" class="btn-generate" :disabled="loading || block.isGeneratingImage">
                <span v-if="block.isGeneratingImage">🖼️ Генерація...</span>
                <span v-else>{{ block.imageUrl ? '🔄 Перегенерувати' : '🖼️ Генерувати картинку' }}</span>
              </button>
              <button @click="generateAudioForBlock(block)" class="btn-audio" :disabled="loading || block.isVoicing">
                <span v-if="block.isVoicing">🔊 Обробка...</span>
                <span v-else>🔊 {{ block.audioUrl ? 'Переозвучити' : 'Озвучити' }}</span>
              </button>
              <button v-if="block.audioUrl" @click="playAudio(block.audioUrl)" class="btn-play">
                ▶️
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="global-actions">
        <button @click="generateAllImages" class="btn-primary" :disabled="loading">
          {{ loading ? 'Генерація...' : '🖼️ Генерувати всі зображення' }}
        </button>
        <button @click="generateAudioForAllBlocks" class="btn-primary" :disabled="loading || isVoicingAll">
           <span v-if="isVoicingAll">🔊 Обробка...</span>
           <span v-else>🔊 Озвучити весь текст</span>
        </button>
        <button @click="showFinalizer = true" class="btn-primary">
          ➡️ Перейти до фіналізації
        </button>
      </div>
    </div>

    <div v-if="error" class="error-message">
      ❌ {{ error }}
    </div>
    
    <VideoFinalizer 
      v-if="showFinalizer" 
      :blocks="blocks"
      @start-generation="handleFinalGeneration"
    />

    <audio ref="audioPlayer" style="display: none;"></audio>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { textAPI, generationAPI, socket } from '@/services/api';
import VideoFinalizer from '@/components/VideoFinalizer.vue';

// Стан компонента
const mode = ref('custom');
const customText = ref('');
const rewriteText = ref('');
const youtubeUrl = ref('');
const blocks = ref([]);
const loading = ref(false);
const error = ref('');
const outputLanguage = ref('uk');
const imageProvider = ref('pollinations');
const audioPlayer = ref(null);
const isVoicingAll = ref(false);

const availableVoices = ref([]);
const voicesLoading = ref(false);
const selectedVoice = ref('');
const speakingRate = ref(1.0);
const pitch = ref(0.0);
const ssmlTemplate = ref(''); // Назва змінної залишена для сумісності
const progressMessage = ref('');
const showFinalizer = ref(false);

// --- ОНОВЛЕНА ФУНКЦІЯ ЗАВАНТАЖЕННЯ ГОЛОСІВ ---
const fetchVoices = async () => {
  voicesLoading.value = true;
  availableVoices.value = [];
  try {
    // Просто отримуємо список голосів, мова більше не є параметром
    const response = await generationAPI.getVoices();
    availableVoices.value = response.data;
    if (availableVoices.value.length > 0) {
      // Встановлюємо якісний голос за замовчуванням, якщо він є у списку
      const defaultVoice = availableVoices.value.find(v => v.name === 'Charon');
      selectedVoice.value = defaultVoice ? defaultVoice.name : availableVoices.value[0].name;
    }
  } catch (err) {
    console.error("Не вдалося завантажити голоси:", err);
    error.value = "Не вдалося завантажити список голосів";
  } finally {
    voicesLoading.value = false;
  }
};

// --- Керування WebSocket ---
onMounted(() => {
  fetchVoices(); // Завантажуємо голоси один раз при старті
  
  socket.connect();
  console.log('WebSocket з\'єднання встановлюється...');

  socket.on('image-generated', (data) => {
    if (data.success) {
      console.log('Отримано нове зображення:', data);
      const block = blocks.value.find(b => b.id === data.blockId);
      if (block) {
        block.imageUrl = 'http://localhost:3000' + data.imageUrl;
      }
      progressMessage.value = `Зображення для блоку #${data.blockId} готове.`;
    }
  });

  socket.on('generation-error', (data) => {
    console.error('Помилка генерації для блоку:', data);
    error.value = `Помилка для блоку #${data.blockId}: ${data.error}`;
  });
  
  socket.on('generation-complete', (data) => {
    console.log(data.message);
    loading.value = false;
    progressMessage.value = 'Всі зображення успішно згенеровано!';
    setTimeout(() => progressMessage.value = '', 5000);
  });
});

onUnmounted(() => {
  socket.disconnect();
  console.log('WebSocket з\'єднання закрито.');
});

// Обробка власного тексту
const processCustomText = async () => {
  try {
    loading.value = true;
    error.value = '';
    
    const response = await textAPI.processCustomText(customText.value, outputLanguage.value);
    blocks.value = response.data.blocks.map(b => ({ 
      ...b, 
      imageUrl: null,
      audioUrl: null, 
      isVoicing: false,
      isGeneratingImage: false
    }));
    
    console.log('Отримано блоки:', blocks.value);
  } catch (err) {
    error.value = err.response?.data?.error || 'Помилка обробки тексту';
    console.error('Помилка:', err);
  } finally {
    loading.value = false;
  }
};

// Обробка рерайту
const processRewrite = async () => {
  try {
    loading.value = true;
    error.value = '';
    
    const response = await textAPI.rewriteText(rewriteText.value);
    console.log('Рерайт:', response.data);
    
    if (response.data.rewrittenText) {
      customText.value = response.data.rewrittenText;
      mode.value = 'custom';
      await processCustomText();
    }
  } catch (err) {
    error.value = err.response?.data?.error || 'Помилка рерайту';
    console.error('Помилка:', err);
  } finally {
    loading.value = false;
  }
};

// Обробка YouTube
const processYouTube = async () => {
  try {
    loading.value = true;
    error.value = '';
    
    const response = await textAPI.processYouTubeLink(youtubeUrl.value);
    console.log('YouTube:', response.data);
    
    error.value = 'YouTube функція ще в розробці';
  } catch (err) {
    error.value = err.response?.data?.error || 'Помилка обробки YouTube';
    console.error('Помилка:', err);
  } finally {
    loading.value = false;
  }
};

// Генерація одного зображення
const generateImage = async (block) => {
  block.isGeneratingImage = true;
  error.value = '';
  try {
    const response = await generationAPI.generateImage(block.imagePrompt, {
      aspectRatio: '16:9',
      provider: imageProvider.value
    });
    
    block.imageUrl = 'http://localhost:3000' + response.data.imageUrl;
    console.log('Зображення згенеровано:', block.imageUrl);
  } catch (err) {
    error.value = 'Помилка генерації зображення';
    console.error('Помилка:', err);
  } finally {
    block.isGeneratingImage = false;
  }
};

// Генерація всіх зображень
const generateAllImages = async () => {
  loading.value = true;
  error.value = '';
  progressMessage.value = 'Запускаю генерацію...';
  try {
    await generationAPI.generateAllImages(blocks.value, {
      aspectRatio: '16:9',
      provider: imageProvider.value
    });
    progressMessage.value = 'Генерація триває. Очікуйте на зображення...';
  } catch (err) {
    error.value = 'Не вдалося запустити масову генерацію';
    console.error('Помилка:', err);
    loading.value = false;
  }
};

// Функція для відтворення аудіо
const playAudio = (audioUrl) => {
  if (audioPlayer.value && audioUrl) {
    audioPlayer.value.src = 'http://localhost:3000' + audioUrl;
    audioPlayer.value.play();
  }
};

// Генерація аудіо для одного блоку
const generateAudioForBlock = async (block) => {
  block.isVoicing = true;
  error.value = '';
  try {
    const voiceSettings = {
      voiceName: selectedVoice.value,
      ssmlTemplate: ssmlTemplate.value // Це поле буде оброблено на бекенді
    };
    
    const response = await generationAPI.generateAudio(block.text, voiceSettings);
    block.audioUrl = response.data.audioUrl;
    playAudio(block.audioUrl);
  } catch (err) {
    error.value = 'Помилка генерації аудіо';
    console.error(err);
  } finally {
    block.isVoicing = false;
  }
};

// Генерація аудіо для всіх блоків
const generateAudioForAllBlocks = async () => {
  isVoicingAll.value = true;
  for (const block of blocks.value) {
    if (!block.audioUrl) { // Озвучуємо тільки ті, що ще не озвучені
      await generateAudioForBlock(block);
    }
  }
  isVoicingAll.value = false;
};

// Обробка запуску фінальної генерації
const handleFinalGeneration = async (config, musicFile) => {
  progressMessage.value = 'Завантаження даних та запуск збірки відео...';
  error.value = '';

  try {
    const formData = new FormData();
    formData.append('config', JSON.stringify(config));
    
    if (musicFile) {
      formData.append('musicFile', musicFile);
    }

    await generationAPI.createVideo(formData);
    
  } catch (err) {
    error.value = 'Не вдалося запустити фінальну збірку';
    console.error(err);
    progressMessage.value = '';
  }
};
</script>

<style scoped>
.video-maker {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

h1 {
  text-align: center;
  color: #333;
  margin-bottom: 30px;
}

.mode-selector {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-bottom: 30px;
}

.mode-selector button {
  padding: 10px 20px;
  border: 2px solid #ddd;
  background: white;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  font-size: 16px;
}

.mode-selector button:hover {
  border-color: #42b883;
}

.mode-selector button.active {
  background: #42b883;
  color: white;
  border-color: #42b883;
}

.input-section {
  background: #f5f5f5;
  padding: 20px;
  border-radius: 10px;
  margin-bottom: 30px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.input-group label {
  font-weight: bold;
  color: #555;
}

.input-group textarea,
.input-group input[type="url"] {
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 5px;
  font-size: 16px;
  font-family: inherit;
}

.input-group button {
  padding: 12px 24px;
  background: #42b883;
  color: white;
  border: none;
  border-radius: 5px;
  font-size: 16px;
  cursor: pointer;
  transition: background 0.3s;
}

.input-group button:hover:not(:disabled) {
  background: #369b6f;
}

.input-group button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.results-section h2 {
  color: #333;
  margin-bottom: 20px;
}

.blocks-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 30px;
}

.block-item {
  background: white;
  border: 1px solid #ddd;
  border-radius: 10px;
  overflow: hidden;
}

.block-header {
  background: #f0f0f0;
  padding: 10px 15px;
  border-bottom: 1px solid #ddd;
}

.block-header h3 {
  margin: 0;
  color: #555;
  font-size: 18px;
}

.block-content {
  padding: 15px;
}

.text-section,
.prompt-section {
  margin-bottom: 15px;
}

.text-section label,
.prompt-section label {
  display: block;
  font-weight: bold;
  color: #555;
  margin-bottom: 5px;
}

.text-section p {
  margin: 0;
  color: #333;
  line-height: 1.5;
}

.prompt-section input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 5px;
  font-size: 14px;
}

.actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.actions button {
  padding: 8px 16px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.3s;
}

.actions button:hover {
  background: #f0f0f0;
  border-color: #42b883;
}

.btn-play {
  padding: 8px 12px;
  font-size: 16px;
  line-height: 1;
}

.global-actions {
  display: flex;
  gap: 15px;
  justify-content: center;
}

.btn-primary {
  padding: 12px 24px;
  background: #42b883;
  color: white;
  border: none;
  border-radius: 5px;
  font-size: 16px;
  cursor: pointer;
  transition: background 0.3s;
}

.btn-primary:hover:not(:disabled) {
  background: #369b6f;
}

.btn-primary:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.error-message {
  background: #fee;
  color: #c33;
  padding: 15px;
  border-radius: 5px;
  margin-top: 20px;
  text-align: center;
}

.progress-message {
  text-align: center;
  padding: 10px;
  background-color: #e0f2fe;
  color: #0c5460;
  border-radius: 8px;
  margin-bottom: 20px;
  font-weight: bold;
}

.image-section {
  margin: 15px 0;
}

.image-section label {
  display: block;
  font-weight: bold;
  color: #555;
  margin-bottom: 10px;
}

.image-section img {
  width: 100%;
  max-width: 400px;
  height: auto;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.btn-generate, .btn-audio {
  position: relative;
}

.btn-generate:disabled, .btn-audio:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.language-selector,
.provider-selector {
  text-align: center;
  margin-bottom: 20px;
}

.language-selector label,
.provider-selector label {
  font-weight: bold;
  margin-right: 10px;
  color: #555;
}

.language-selector select,
.provider-selector select {
  padding: 8px 15px;
  border: 2px solid #ddd;
  border-radius: 5px;
  font-size: 16px;
  cursor: pointer;
  background: white;
}

.language-selector select:hover,
.provider-selector select:hover {
  border-color: #42b883;
}

.voice-settings {
  display: flex;
  justify-content: center;
  gap: 20px;
  align-items: flex-start;
  flex-wrap: wrap;
  background: #f5f5f5;
  padding: 20px;
  border-radius: 10px;
  margin-bottom: 30px;
}

.setting-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.setting-group label {
  font-weight: bold;
  color: #555;
  font-size: 14px;
}

.setting-group select, .setting-group input[type="range"] {
  cursor: pointer;
}

.setting-group select {
  padding: 5px 10px;
  border-radius: 5px;
  border: 1px solid #ddd;
  min-width: 150px;
}

.ssml-group {
  flex-grow: 1;
  max-width: 250px;
}

.ssml-group input {
  width: 100%;
  padding: 5px 10px;
  border-radius: 5px;
  border: 1px solid #ddd;
}
</style>