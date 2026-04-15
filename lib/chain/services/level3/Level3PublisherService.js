const stableSerialize = (value) => JSON.stringify(value);

const publishJson = (client, topic, payload) =>
  new Promise((resolve, reject) => {
    client.publish(topic, stableSerialize(payload), { qos: 1, retain: false }, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

export const createLevel3PublisherService = ({ topics, onLog } = {}) => {
  const lastPayloadByTopic = new Map();

  const log = (message) => {
    if (typeof onLog === 'function') onLog(message);
  };

  return {
    async publish(client, topic, payload) {
      if (!client || !topic || !payload) return false;

      const serialized = stableSerialize(payload);
      if (lastPayloadByTopic.get(topic) === serialized) return false;

      await publishJson(client, topic, payload);
      lastPayloadByTopic.set(topic, serialized);
      log(`[LEVEL3_PUBLISH] ${topic}`);
      return true;
    },

    async publishLocalContribution(client, payload) {
      return this.publish(client, topics.chainInput, payload);
    },
  };
};
