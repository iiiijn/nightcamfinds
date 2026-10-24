const chaturbate = require('./chaturbate');
const bongacams = require('./bongacams');

const providers = { chaturbate, bongacams };

function getProvider(name) {
  const provider = providers[String(name || '').toLowerCase()];
  if (!provider) throw new Error(`Unknown provider: ${name}`);
  return provider;
}

async function fetchAll({ config = {}, fetchImpl = fetch } = {}) {
  const results = {};
  for (const [name, provider] of Object.entries(providers)) {
    try {
      results[name] = {
        ok: true,
        rooms: await provider.fetchRooms({ ...config[name], fetchImpl })
      };
    } catch (error) {
      results[name] = { ok: false, rooms: [], error: error.message };
    }
  }
  return results;
}

module.exports = { providers, getProvider, fetchAll };
