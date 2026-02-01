const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

config.resolver.unstable_enableSymlinks = true;

config.resolver.extraNodeModules = {
  crypto: require.resolve('react-native-quick-crypto'),
  stream: require.resolve('stream-browserify'),
  buffer: require.resolve('@craftzdog/react-native-buffer'),
  zlib: require.resolve('browserify-zlib'),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'jose') {
    return {
      filePath: path.resolve(monorepoRoot, 'node_modules/.pnpm/jose@4.15.9/node_modules/jose/dist/browser/index.js'),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
