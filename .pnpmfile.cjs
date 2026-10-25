const { preResolution } = require('./infra/cursor-automations/ensure-cursor-sdk.cjs');

module.exports = {
  hooks: {
    preResolution
  }
};
