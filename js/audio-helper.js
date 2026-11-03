export async function extractAudioFromMedia(file) {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  
  const decodedAudio = await audioContext.decodeAudioData(arrayBuffer);
  
  const targetSampleRate = 16000;
  const numberOfChannels = 1;
  const duration = decodedAudio.duration;

  const offlineContext = new OfflineAudioContext(
    numberOfChannels,
    Math.ceil(duration * targetSampleRate),
    targetSampleRate
  );

  const source = offlineContext.createBufferSource();
  source.buffer = decodedAudio;
  source.connect(offlineContext.destination);
  source.start(0);

  const renderedBuffer = await offlineContext.startRendering();
  await audioContext.close();

  return renderedBuffer.getChannelData(0);
}