import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

env.allowLocalModels = false;
env.useBrowserCache = true;

class PipelineSingleton {
  static task = 'automatic-speech-recognition';
  static model = 'Xenova/whisper-tiny.en';
  static instance = null;

  static async getInstance(progress_callback = null) {
    if (!this.instance) {
      this.instance = await pipeline(this.task, this.model, {
        progress_callback,
        quantized: true,
      });
    }
    return this.instance;
  }
}

self.addEventListener('message', async (event) => {
  const { type, audioData } = event.data;

  if (type === 'transcribe') {
    try {
      const transcriber = await PipelineSingleton.getInstance((progress) => {
        self.postMessage({ type: 'progress', data: progress });
      });

      self.postMessage({ type: 'status', message: 'Transcribing speech & word timestamps...' });

      const output = await transcriber(audioData, {
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: 'word',
      });

      self.postMessage({ type: 'complete', data: output });
    } catch (err) {
      self.postMessage({ type: 'error', error: err.message });
    }
  }
});