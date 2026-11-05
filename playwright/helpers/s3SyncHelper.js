const crypto = require('crypto');
const { S3_BUCKET, S3_ENDPOINT, KAFKA_BOOTSTRAP } = require('./services');

const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';
const DEC_KEY_B64 = process.env.S3_DEC_KEY_B64; // base64 AES key shared with consumer
const DEC_ALGO = process.env.S3_DEC_ALGO || 'aes-256-gcm';

function decryptS3Payload(encryptedBuffer) {
  const key = Buffer.from(DEC_KEY_B64, 'base64');
  const iv = encryptedBuffer.slice(0, 12);
  const tag = encryptedBuffer.slice(12, 28);
  const data = encryptedBuffer.slice(28);
  const decipher = crypto.createDecipheriv(DEC_ALGO, key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(plain.toString('utf8'));
}

async function downloadAndDecryptS3Object(employeeId) {
  const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
  const s3 = new S3Client({
    region: AWS_REGION,
    endpoint: S3_ENDPOINT,
    forcePathStyle: true,
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  });
  const res = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: `${employeeId}.json` }));
  const bytes = await res.Body.transformToByteArray();
  return decryptS3Payload(Buffer.from(bytes));
}

async function fetchKafkaMessage(topic, employeeId, { kafkaConfig, timeoutMs = 10000, correlationId } = {}) {
  const { Kafka } = require('kafkajs');
  const kafka = new Kafka(kafkaConfig || { brokers: [KAFKA_BOOTSTRAP] });
  const consumer = kafka.consumer({ groupId: `sync-validator-${employeeId}-${Date.now()}` });
  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: true });
  let found = null;
  await consumer.run({
    eachMessage: async ({ message }) => {
      if (found || !message.value) return;
      const payload = JSON.parse(message.value.toString('utf8'));
      const idMatch = payload.employeeId === employeeId;
      const corrMatch = !correlationId || payload.correlationId === correlationId;
      if (idMatch && corrMatch) found = payload;
    },
  });
  const start = Date.now();
  while (!found && Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, 200));
  }
  await consumer.disconnect();
  return found;
}

function validateApiVsKafkaVsS3(apiResponse, kafkaPayload, s3DecryptedPayload) {
  // Kafka event shape: { action, employeeId, correlationId, timestamp, employee: {...} }
  const kafkaEmployee = kafkaPayload && kafkaPayload.employee ? kafkaPayload.employee : kafkaPayload;
  const fields = ['employeeId', 'firstName', 'lastName', 'email', 'designation', 'department', 'status'];
  const mismatches = [];
  for (const f of fields) {
    if (apiResponse[f] !== kafkaEmployee[f]) {
      mismatches.push({ field: f, api: apiResponse[f], kafka: kafkaEmployee[f] });
    }
    if (apiResponse[f] !== s3DecryptedPayload[f]) {
      mismatches.push({ field: f, api: apiResponse[f], s3: s3DecryptedPayload[f] });
    }
  }
  return {
    inSync: mismatches.length === 0,
    mismatches,
    api: apiResponse,
    kafka: kafkaEmployee,
    s3: s3DecryptedPayload,
  };
}

module.exports = { decryptS3Payload, downloadAndDecryptS3Object, fetchKafkaMessage, validateApiVsKafkaVsS3 };
