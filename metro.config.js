const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
config.resolver.extraNodeModules = {
  stream: require.resolve('./shims/net.js'),
  zlib: require.resolve('./shims/net.js'),
  net: require.resolve('./shims/net.js'),
  tls: require.resolve('./shims/net.js'),
  fs: require.resolve('./shims/net.js'),
};
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.includes('@opentelemetry')) {
    return { type: 'empty' };
  }
  return context.resolveRequest(context, moduleName, platform);
};
module.exports = config;
