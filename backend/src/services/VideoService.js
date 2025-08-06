const ffmpeg = require('fluent-ffmpeg');
const ffprobeStatic = require('ffprobe-static');
const path = require('path');
const fs = require('fs').promises;

ffmpeg.setFfprobePath(ffprobeStatic.path);

class VideoService {
  constructor() {
    this.baseDir = path.join(process.cwd(), 'uploads');
    this.tempDir = path.join(this.baseDir, 'temp');
    this.outputDir = path.join(this.baseDir, 'videos');
  }

  async ensureDirectories() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      await fs.mkdir(this.outputDir, { recursive: true });
      
      // Перевіряємо, що директорії створені і доступні
      await fs.access(this.tempDir, fs.constants.W_OK);
      await fs.access(this.outputDir, fs.constants.W_OK);
      
      console.log('📁 Директорії створено успішно');
      console.log(`   Temp: ${this.tempDir}`);
      console.log(`   Output: ${this.outputDir}`);
    } catch (error) {
      console.error('❌ Помилка створення директорій:', error);
      throw error;
    }
  }

  // Перевірка існування файлу
  async validateFile(filePath) {
    try {
      await fs.access(filePath);
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        throw new Error(`Шлях не є файлом: ${filePath}`);
      }
      console.log(`✅ Файл валідний: ${filePath}`);
      return true;
    } catch (error) {
      console.error(`❌ Файл не існує або недоступний: ${filePath}`);
      throw new Error(`Файл не знайдено: ${filePath}`);
    }
  }

  _getLocalPathFromUrl(urlPath) {
    if (!urlPath) {
      throw new Error('URL-шлях до файлу не може бути порожнім.');
    }
    
    const uploadsIdentifier = '/uploads/';
    const relativePathStartIndex = urlPath.indexOf(uploadsIdentifier);
    
    if (relativePathStartIndex === -1) {
      throw new Error(`Некоректний URL-шлях, не знайдено '${uploadsIdentifier}': ${urlPath}`);
    }
    
    const relativePath = urlPath.substring(relativePathStartIndex + uploadsIdentifier.length);
    const fullPath = path.join(this.baseDir, relativePath);
    
    console.log(`🔄 Конвертація URL в шлях: ${urlPath} -> ${fullPath}`);
    return fullPath;
  }

  async generateVideo(config, musicFile, io) {
    console.log('🎬 Починаю повний процес створення відео...');
    const { blocks, settings } = config;
    const clipPaths = [];

    try {
      // КРИТИЧНО: Спочатку переконуємося, що директорії існують
      await this.ensureDirectories();

      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        const progressMessage = `Створення сцени ${i + 1}/${blocks.length}...`;
        console.log(progressMessage);
        io.emit('progress', { message: progressMessage });

        const imagePath = this._getLocalPathFromUrl(block.imageUrl);
        const audioPath = this._getLocalPathFromUrl(block.audioUrl);
        
        // Валідація файлів перед використанням
        await this.validateFile(imagePath);
        await this.validateFile(audioPath);
        
        const audioDuration = await this.getAudioDuration(audioPath);
        console.log(`🎵 Тривалість аудіо для сцени ${i + 1}: ${audioDuration}s`);
        
        const effect = settings.effects[block.id] || 'zoom_in';
        const clipPath = await this.createClip(imagePath, audioPath, audioDuration, i, effect);
        clipPaths.push({ path: clipPath, duration: audioDuration });
      }

      const concatMessage = 'Зведення сцен з переходами...';
      console.log(concatMessage);
      io.emit('progress', { message: concatMessage });
      const concatenatedVideoPath = await this.concatenateClips(clipPaths);

      const masterMessage = 'Накладання фонової музики та фіналізація...';
      console.log(masterMessage);
      io.emit('progress', { message: masterMessage });
      
      let finalVideoPath = concatenatedVideoPath;
      if (musicFile) {
        const musicFilePath = path.join(this.tempDir, musicFile.originalname);
        await fs.writeFile(musicFilePath, musicFile.buffer);
        finalVideoPath = await this.applyMastering(concatenatedVideoPath, musicFilePath, settings);
      }
      
      const finalVideoUrl = `/videos/${path.basename(finalVideoPath)}`;

      console.log('✅ Відео успішно створено!', finalVideoUrl);
      io.emit('video-complete', { url: finalVideoUrl });
      
    } catch (error) {
      console.error('❌ Помилка під час створення відео:', error);
      io.emit('generation-error', { 
        error: 'Помилка під час створення відео', 
        details: error.message 
      });
    }
  }

  getAudioDuration(audioPath) {
    return new Promise((resolve, reject) => {
      console.log(`🔍 Отримання тривалості аудіо: ${audioPath}`);
      
      ffmpeg.ffprobe(audioPath, (err, metadata) => {
        if (err) {
          console.error('❌ Помилка ffprobe:', err);
          return reject(err);
        }
        const duration = metadata.format.duration;
        console.log(`⏱️ Тривалість: ${duration}s`);
        resolve(duration);
      });
    });
  }

  createClip(imagePath, audioPath, duration, index, effect = 'zoom_in') {
    return new Promise(async (resolve, reject) => {
      const outputPath = path.join(this.tempDir, `clip_${index}.mp4`);
      
      console.log(`🎨 Створення кліпу ${index}:`);
      console.log(`   Зображення: ${imagePath}`);
      console.log(`   Аудіо: ${audioPath}`);
      console.log(`   Вихід: ${outputPath}`);
      console.log(`   Ефект: ${effect}`);
      console.log(`   Тривалість: ${duration}s`);

      // Переконуємося, що директорія для виводу існує
      try {
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        const dirStats = await fs.stat(path.dirname(outputPath));
        if (!dirStats.isDirectory()) {
          throw new Error('Шлях не є директорією');
        }
      } catch (err) {
        console.error('❌ Не вдалося створити директорію:', err);
        return reject(err);
      }

      // Округлюємо тривалість до 2 знаків після коми
      const roundedDuration = Math.round(duration * 100) / 100;
      
      // Обчислюємо кількість кадрів для ефекту (25 fps)
      const frameCount = Math.round(roundedDuration * 25);
      
      // Прості та надійні ефекти
      let filterString;
      switch(effect) {
        case 'zoom_in':
          // Плавне наближення
          filterString = `scale=-2:1080,crop=1920:1080,zoompan=z='min(zoom+0.0015,1.5)':d=${frameCount}:s=1920x1080`;
          break;
          
        case 'zoom_out':
          // Плавне віддалення
          filterString = `scale=-2:1080,crop=1920:1080,zoompan=z='if(lte(zoom,1.0),1.5,max(1.0,zoom-0.0015))':d=${frameCount}:s=1920x1080`;
          break;
          
        case 'fade':
          // Плавне затемнення на початку та в кінці
          filterString = `scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fade=t=in:st=0:d=1,fade=t=out:st=${roundedDuration - 1}:d=1`;
          break;
          
        case 'blur_in':
          // Спрощений ефект розмиття
          filterString = `scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2`;
          // Додамо розмиття окремим кроком через складність синтаксису
          break;
          
        case 'rotate':
          // Спрощене обертання без формул
          filterString = `scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2`;
          break;
          
        case 'static':
        default:
          // Статичне зображення
          filterString = 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2';
      }

      console.log(`🎭 Застосовуємо фільтр: ${filterString}`);

      // Альтернативний підхід - створюємо відео окремо, потім додаємо аудіо
      const tempVideoPath = path.join(this.tempDir, `temp_video_${index}.mp4`);
      
      try {
        // Для blur_in використовуємо спеціальний підхід
        if (effect === 'blur_in') {
          await this.createBlurInEffect(imagePath, tempVideoPath, roundedDuration);
        } else if (effect === 'rotate') {
          await this.createRotateEffect(imagePath, tempVideoPath, roundedDuration);
        } else {
          // Крок 1: Створюємо відео з ефектом
          await new Promise((resolveVideo, rejectVideo) => {
            ffmpeg()
              .input(imagePath)
              .inputOptions(['-loop', '1'])
              .outputOptions([
                '-vf', filterString,
                '-c:v', 'libx264',
                '-t', roundedDuration.toString(),
                '-pix_fmt', 'yuv420p',
                '-preset', 'fast',
                '-crf', '23'
              ])
              .on('start', (cmd) => {
                console.log('📹 Створення відео частини:', cmd);
              })
              .on('progress', (progress) => {
                if (progress.percent) {
                  console.log(`⏳ Прогрес відео ${index}: ${Math.round(progress.percent)}%`);
                }
              })
              .on('end', () => {
                console.log('✅ Відео частина готова');
                resolveVideo();
              })
              .on('error', (err) => {
                console.error('❌ Помилка створення відео:', err);
                rejectVideo(err);
              })
              .save(tempVideoPath);
          });
        }

        // Крок 2: Додаємо аудіо до відео
        await new Promise((resolveAudio, rejectAudio) => {
          ffmpeg()
            .input(tempVideoPath)
            .input(audioPath)
            .outputOptions([
              '-c:v', 'copy',
              '-c:a', 'aac',
              '-shortest',
              '-avoid_negative_ts', 'make_zero'
            ])
            .on('start', (cmd) => {
              console.log('🎵 Додавання аудіо:', cmd);
            })
            .on('progress', (progress) => {
              if (progress.percent) {
                console.log(`⏳ Прогрес аудіо ${index}: ${Math.round(progress.percent)}%`);
              }
            })
            .on('end', async () => {
              // Видаляємо тимчасовий файл
              try {
                await fs.unlink(tempVideoPath);
              } catch (e) {
                console.log('⚠️ Не вдалося видалити тимчасовий файл:', e.message);
              }
              console.log(`✅ Кліп ${index} створено успішно`);
              resolveAudio();
            })
            .on('error', (err) => {
              console.error(`❌ Помилка додавання аудіо:`, err);
              rejectAudio(err);
            })
            .save(outputPath);
        });

        resolve(outputPath);
      } catch (error) {
        reject(error);
      }
    });
  }
  
  concatenateClips(clips) {
    return new Promise(async (resolve, reject) => {
      const outputPath = path.join(this.tempDir, `concatenated_${Date.now()}.mp4`);
      const fileListPath = path.join(this.tempDir, 'filelist.txt');
      
      // Створюємо список файлів з абсолютними шляхами
      const fileContent = clips.map(c => `file '${path.resolve(c.path)}'`).join('\n');
      
      console.log('📝 Створення файлу списку для конкатенації...');
      console.log('Вміст filelist.txt:');
      console.log(fileContent);
      
      try {
        await fs.writeFile(fileListPath, fileContent);
        
        ffmpeg()
          .input(fileListPath)
          .inputOptions(['-f', 'concat', '-safe', '0'])
          .outputOptions(['-c', 'copy'])
          .on('start', (commandLine) => {
            console.log('🔗 FFmpeg конкатенація:', commandLine);
          })
          .on('progress', (progress) => {
            if (progress.percent) {
              console.log(`⏳ Прогрес конкатенації: ${Math.round(progress.percent)}%`);
            }
          })
          .on('end', async () => {
            // Видаляємо файл списку після використання
            try {
              await fs.unlink(fileListPath);
            } catch (e) {
              console.log('⚠️ Не вдалося видалити filelist.txt:', e.message);
            }
            console.log('✅ Конкатенація завершена');
            resolve(outputPath);
          })
          .on('error', (err) => {
            console.error('❌ Помилка конкатенації:', err);
            reject(err);
          })
          .save(outputPath);
      } catch (err) {
        console.error('❌ Помилка запису filelist.txt:', err);
        reject(err);
      }
    });
  }

  applyMastering(videoPath, musicPath, settings) {
    return new Promise(async (resolve, reject) => {
      const outputPath = path.join(this.outputDir, `final_video_${Date.now()}.mp4`);
      
      console.log('🎼 Застосування мастерингу...');
      console.log(`   Відео: ${videoPath}`);
      console.log(`   Музика: ${musicPath}`);
      console.log(`   Вихід: ${outputPath}`);
      console.log(`   Audio Ducking: ${settings.audioDucking}`);
      
      // Переконуємося, що вихідна директорія існує
      try {
        await fs.mkdir(this.outputDir, { recursive: true });
      } catch (err) {
        console.error('❌ Не вдалося створити директорію для фінального відео:', err);
        return reject(err);
      }
      
      // Отримуємо тривалість відео для правильного зациклення музики
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          console.error('❌ Помилка отримання метаданих відео:', err);
          return reject(err);
        }
        
        const videoDuration = metadata.format.duration;
        console.log(`⏱️ Тривалість відео: ${videoDuration}s`);
        
        // Спрощений підхід - спочатку створюємо відео з музикою без складних фільтрів
        if (settings.audioDucking) {
          // З приглушенням музики під час мовлення - розділяємо на кроки
          const tempAudioPath = path.join(this.tempDir, `mixed_audio_${Date.now()}.aac`);
          
          // Крок 1: Створюємо змішане аудіо
          ffmpeg()
            .input(videoPath)
            .input(musicPath)
            .complexFilter([
              '[1:a]aloop=loop=-1:size=2e+09,volume=0.3[bgmusic]',
              '[0:a][bgmusic]amix=inputs=2:duration=first:weights=1 0.3[mixed]'
            ])
            .map('[mixed]')
            .audioCodec('aac')
            .noVideo()
            .duration(videoDuration)
            .on('start', (cmd) => {
              console.log('🎵 Створення змішаного аудіо:', cmd);
            })
            .on('end', () => {
              console.log('✅ Аудіо змішано');
              
              // Крок 2: Об'єднуємо відео зі змішаним аудіо
              ffmpeg()
                .input(videoPath)
                .input(tempAudioPath)
                .videoCodec('copy')
                .audioCodec('copy')
                .map('[0:v]')
                .map('[1:a]')
                .on('start', (cmd) => {
                  console.log('🎬 Фіналізація відео:', cmd);
                })
                .on('end', async () => {
                  try {
                    await fs.unlink(tempAudioPath);
                  } catch (e) {
                    console.log('⚠️ Не вдалося видалити тимчасове аудіо:', e.message);
                  }
                  console.log('✅ Мастеринг завершено успішно');
                  resolve(outputPath);
                })
                .on('error', (err) => {
                  console.error('❌ Помилка фіналізації:', err);
                  reject(err);
                })
                .save(outputPath);
            })
            .on('error', (err) => {
              console.error('❌ Помилка створення аудіо міксу:', err);
              reject(err);
            })
            .save(tempAudioPath);
        } else {
          // Простий мікс без приглушення - прямий підхід
          ffmpeg()
            .input(videoPath)
            .input(musicPath)
            .videoCodec('copy')
            .audioCodec('aac')
            .outputOptions([
              '-filter_complex', '[1:a]aloop=loop=-1:size=2e+09,volume=0.25[bgmusic];[0:a][bgmusic]amix=inputs=2:duration=first[aout]',
              '-map', '0:v',
              '-map', '[aout]',
              '-shortest'
            ])
            .on('start', (commandLine) => {
              console.log('🎵 FFmpeg мастеринг команда:', commandLine);
            })
            .on('progress', (progress) => {
              if (progress.percent) {
                console.log(`⏳ Прогрес мастерингу: ${Math.round(progress.percent)}%`);
              }
            })
            .on('end', () => {
              console.log('✅ Мастеринг завершено успішно');
              resolve(outputPath);
            })
            .on('error', (err) => {
              console.error('❌ Помилка мастерингу:', err);
              reject(err);
            })
            .save(outputPath);
        }
      });
    });
  }

  // Допоміжний метод для очищення тимчасових файлів
  async cleanupTempFiles() {
    try {
      const files = await fs.readdir(this.tempDir);
      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        try {
          await fs.unlink(filePath);
          console.log(`🗑️ Видалено тимчасовий файл: ${file}`);
        } catch (err) {
          console.error(`⚠️ Не вдалося видалити ${file}:`, err.message);
        }
      }
    } catch (err) {
      console.error('❌ Помилка очищення тимчасових файлів:', err);
    }
  }
}

module.exports = new VideoService();