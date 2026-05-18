const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Block Metro from watching tmp directories created by some packages
config.resolver = {
  ...config.resolver,
  blockList: [/.*_tmp_.*/],
};

module.exports = config;
