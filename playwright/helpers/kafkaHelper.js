const { Kafka } = require('kafkajs');

const { KAFKA_BOOTSTRAP } = require('./services');
const kafka = new Kafka({ clientId: 'pw-tests', brokers: [KAFKA_BOOTSTRAP] });

async function fetchKafkaEntry(topic, employeeId, { timeoutMs = 10_000, fromBeginning = true, correlationId } = {}) {
  const consumer = kafka.consumer({ groupId: `pw-validator-${employeeId}-${Date.now()}` });
  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning });
  let found = null;
  await consumer.run({
    eachMessage: async ({ message }) => {
      if (found || !message.value) return;
      try {
        const payload = JSON.parse(message.value.toString('utf8'));
        const idMatch = payload.employeeId === employeeId;
        const corrMatch = !correlationId || payload.correlationId === correlationId;
        if (idMatch && corrMatch) {
          found = { key: message.key ? message.key.toString('utf8') : null, payload };
        }
      } catch { /* skip bad json */ }
    },
  });
  const start = Date.now();
  while (!found && Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 200));
  }
  await consumer.disconnect();
  return found;
}

async function fetchKafkaMessage(topic, employeeId, opts = {}) {
  const entry = await fetchKafkaEntry(topic, employeeId, opts);
  return entry ? entry.payload : null;
}

async function listTopics() {
  const admin = kafka.admin();
  await admin.connect();
  const topics = await admin.listTopics();
  await admin.disconnect();
  return topics;
}

async function listConsumerGroups() {
  const admin = kafka.admin();
  await admin.connect();
  const { groups } = await admin.listGroups();
  await admin.disconnect();
  return groups.map((g) => g.groupId);
}

async function publishRaw(topic, key, value) {
  const producer = kafka.producer();
  await producer.connect();
  await producer.send({ topic, messages: [{ key, value }] });
  await producer.disconnect();
}

module.exports = { fetchKafkaEntry, fetchKafkaMessage, listTopics, listConsumerGroups, publishRaw };
