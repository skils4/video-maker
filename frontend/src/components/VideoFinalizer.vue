<template>
  <div class="finalizer-section">
    <h2>🚀 Фіналізація відео</h2>
    
    <div class="settings-grid">
      <div class="setting-card">
        <label for="bg-music">🎵 Фонова музика (опціонально)</label>
        <input type="file" id="bg-music" @change="handleFileUpload" accept="audio/mpeg,audio/wav">
      </div>

      <div class="setting-card">
        <label>📄 Субтитри</label>
        <div class="checkbox-group">
          <input type="checkbox" id="burn-subs" v-model="settings.burnSubtitles" disabled>
          <label for="burn-subs">Додати субтитри на відео (в розробці)</label>
        </div>
        <div class="checkbox-group">
          <input type="checkbox" id="create-srt" v-model="settings.createSrtFile" disabled>
          <label for="create-srt">Створити окремий .srt файл (в розробці)</label>
        </div>
      </div>

      <div class="setting-card">
        <label>🎧 Аудіо</label>
        <div class="checkbox-group">
          <input type="checkbox" id="audio-ducking" v-model="settings.audioDucking">
          <label for="audio-ducking">Приглушувати музику під час голосу</label>
        </div>
      </div>
    </div>
    
    <div class="global-actions">
      <button @click="randomizeEffects" class="btn-secondary">✨ Застосувати випадкові ефекти</button>
    </div>

    <div class="blocks-effects-container">
      <div v-for="block in localBlocks" :key="block.id" class="effect-item">
        <h4>Блок {{ block.id }}</h4>
        <div class="effect-controls">
          <select v-model="settings.effects[block.id]" class="effect-select">
            <option value="zoom_in">🔍 Наближення</option>
            <option value="zoom_out">🔎 Віддалення</option>
            <option value="fade">🌅 Затемнення</option>
            <option value="blur_in">🌫️ Розмиття → Чіткість</option>
            <option value="rotate">🔄 Обертання</option>
            <option value="static">📷 Без ефекту</option>
          </select>
          <select v-model="settings.transitions[block.id]" disabled>
            <option value="fade">Перехід: Затухання (в розробці)</option>
          </select>
        </div>
      </div>
    </div>

    <div class="finalize-button-container">
      <button @click="startVideoGeneration" class="btn-finalize" :disabled="isGenerating">
        {{ isGenerating ? 'Збірка відео...' : '🎥 Згенерувати фінальне відео' }}
      </button>
    </div>

    <div v-if="progressMessage" class="progress-message">
      {{ progressMessage }}
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { socket } from '@/services/api';

const props = defineProps({
  blocks: { type: Array, required: true }
});
const emit = defineEmits(['start-generation']);

const isGenerating = ref(false);
const musicFile = ref(null);
const localBlocks = ref(props.blocks);
const progressMessage = ref('');

const settings = reactive({
  burnSubtitles: false,
  createSrtFile: true,
  audioDucking: true,
  effects: {},
  transitions: {}
});

// Оновлений список ефектів
const availableEffects = ['zoom_in', 'zoom_out', 'fade', 'blur_in', 'rotate', 'static'];

// Ваги для випадкового вибору (частіше вибираються zoom ефекти)
const effectWeights = {
  'zoom_in': 30,
  'zoom_out': 30,
  'fade': 15,
  'blur_in': 10,
  'rotate': 10,
  'static': 5
};

// Функція для випадкового вибору з вагами
const getWeightedRandomEffect = () => {
  const totalWeight = Object.values(effectWeights).reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;
  
  for (const [effect, weight] of Object.entries(effectWeights)) {
    random -= weight;
    if (random <= 0) {
      return effect;
    }
  }
  
  return 'zoom_in'; // За замовчуванням
};

const randomizeEffects = () => {
  localBlocks.value.forEach(block => {
    settings.effects[block.id] = getWeightedRandomEffect();
  });
};

onMounted(() => {
  randomizeEffects(); // Застосовуємо випадкові ефекти при завантаженні
  
  // Слухаємо події прогресу генерації відео
  socket.on('progress', (data) => {
    progressMessage.value = data.message;
  });

  socket.on('video-complete', (data) => {
    progressMessage.value = '✅ Відео успішно створено!';
    isGenerating.value = false;
    // Відкриваємо відео в новій вкладці
    window.open('http://localhost:3000' + data.url, '_blank');
  });

  socket.on('generation-error', (data) => {
    progressMessage.value = `❌ Помилка: ${data.error}`;
    isGenerating.value = false;
  });
});

onUnmounted(() => {
  socket.off('progress');
  socket.off('video-complete');
  socket.off('generation-error');
});

const handleFileUpload = (event) => {
  musicFile.value = event.target.files[0];
};

const startVideoGeneration = () => {
  isGenerating.value = true;
  progressMessage.value = 'Початок генерації відео...';
  
  const finalConfig = {
    blocks: props.blocks,
    settings: settings,
  };
  emit('start-generation', finalConfig, musicFile.value);
};
</script>

<style scoped>
.finalizer-section {
  background: #f9f9f9;
  padding: 30px;
  border-radius: 10px;
  margin-top: 30px;
}

.finalizer-section h2 {
  text-align: center;
  color: #333;
  margin-bottom: 30px;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.setting-card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.setting-card label {
  display: block;
  font-weight: bold;
  color: #555;
  margin-bottom: 10px;
}

.checkbox-group {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.checkbox-group input[type="checkbox"] {
  margin-right: 8px;
}

.checkbox-group label {
  font-weight: normal;
  margin-bottom: 0;
}

.global-actions {
  text-align: center;
  margin-bottom: 20px;
}

.btn-secondary {
  padding: 10px 20px;
  background: #f0f0f0;
  border: 2px solid #42b883;
  color: #42b883;
  border-radius: 5px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-secondary:hover {
  background: #42b883;
  color: white;
}

.blocks-effects-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 15px;
  margin: 30px 0;
}

.effect-item {
  background: white;
  border: 1px solid #e0e0e0;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.effect-item h4 {
  margin: 0 0 10px 0;
  color: #555;
}

.effect-controls {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.effect-select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 5px;
  font-size: 14px;
  cursor: pointer;
  background: white;
}

.effect-select:hover {
  border-color: #42b883;
}

.finalize-button-container {
  text-align: center;
  margin-top: 30px;
}

.btn-finalize {
  padding: 15px 40px;
  background: #42b883;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 4px 6px rgba(66, 184, 131, 0.3);
}

.btn-finalize:hover:not(:disabled) {
  background: #369b6f;
  transform: translateY(-2px);
  box-shadow: 0 6px 8px rgba(66, 184, 131, 0.4);
}

.btn-finalize:disabled {
  background: #ccc;
  cursor: not-allowed;
  box-shadow: none;
}

.progress-message {
  text-align: center;
  padding: 15px;
  background-color: #e0f2fe;
  color: #0c5460;
  border-radius: 8px;
  margin-top: 20px;
  font-weight: bold;
  font-size: 16px;
}

.progress-message:has-text('❌') {
  background-color: #fee;
  color: #c33;
}
</style>