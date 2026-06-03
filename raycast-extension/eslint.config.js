const raycastConfig = require("@raycast/eslint-config");

// The shared config contains a nested array entry; flatten one level so ESLint
// v9's flat-config loader accepts every element as a config object.
module.exports = raycastConfig.flat();
