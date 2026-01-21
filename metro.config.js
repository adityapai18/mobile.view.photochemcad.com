const { getDefaultConfig } = require('@expo/metro-config');
const defaultConfig = getDefaultConfig(__dirname);

module.exports = {
  resolver: {
    assetExts: [...defaultConfig.resolver.assetExts, 'db', 'sqlite', 'json'],
  },
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: false,
      },
    }),
  },
};