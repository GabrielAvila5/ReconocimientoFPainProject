import * as faceapi from 'face-api.js';

let modelsLoaded = false;

export const loadFaceApiModels = async () => {
  if (modelsLoaded) return;
  
  const MODEL_URL = '/models';
  
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);
  
  modelsLoaded = true;
};

export { faceapi };
