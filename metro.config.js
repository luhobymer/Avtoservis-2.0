const { getDefaultConfig } = require('expo/metro-config');
const exclusionList = require('metro-config/src/defaults/exclusionList');
const defaultConfig = getDefaultConfig(__dirname);

defaultConfig.resolver.blockList = exclusionList([
  /server\/.*/,
  /mysql_export\/.*/,
  /logs\/.*/,
]);

module.exports = defaultConfig;
