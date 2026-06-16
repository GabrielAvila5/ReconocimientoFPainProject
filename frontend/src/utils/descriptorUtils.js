import { faceapi } from './faceApiLoader';

// Convierte el string JSON de la BD a Float32Array
export const parseDescriptor = (jsonString) => {
  return new Float32Array(JSON.parse(jsonString));
};

// Serializa Float32Array a array normal para enviar al backend
export const serializeDescriptor = (float32Array) => {
  return Array.from(float32Array);
};

// Promedia N descriptores en uno solo (para el enrolamiento de 5 poses)
export const averageDescriptors = (descriptors) => {
  const length = descriptors[0].length;
  const averaged = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    averaged[i] = descriptors.reduce((sum, d) => sum + d[i], 0) / descriptors.length;
  }
  return averaged;
};

// Distancia euclidiana entre dos Float32Array
export const euclideanDistance = (d1, d2) => {
  return faceapi.euclideanDistance(d1, d2);
};
