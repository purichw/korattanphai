const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');
const config = getDefaultConfig(__dirname);
const root = path.resolve(__dirname, '../..');
config.watchFolders = [root];
config.resolver.nodeModulesPaths = [path.join(__dirname, 'node_modules'), path.join(root, 'node_modules')];
config.resolver.assetExts.push('xlsx');
config.resolver.sourceExts.push('geojson');
config.transformer.babelTransformerPath = require.resolve('./geojson-transformer.cjs');
config.resolver.resolveRequest = (context, name, platform) => {
  if (context.originModulePath === path.join(root, 'src/data/supabaseForecastArchive.ts') && name === '../operationalTelemetry') {
    return { type: 'sourceFile', filePath: path.join(__dirname, 'src/platform/telemetry.ts') };
  }
  if (name.endsWith('forecast-export-template.xlsx?url')) {
    return { type: 'sourceFile', filePath: path.join(__dirname, 'src/platform/excelTemplate.ts') };
  }
  // Shared pure TS modules must still resolve the app's one native dependency tree.
  if (name === '@protobi/exceljs') return { type: 'sourceFile', filePath: require.resolve('@protobi/exceljs/dist/exceljs.bare.min.js') };
  return context.resolveRequest(context, name, platform);
};
module.exports = config;
