const transformer = require(require.resolve('@expo/metro-config/babel-transformer', { paths: [require.resolve('expo/package.json')] }));
module.exports.transform = (options) => transformer.transform(options.filename.endsWith('.geojson')
  ? { ...options, src: `module.exports = JSON.parse(${JSON.stringify(JSON.stringify(JSON.parse(options.src)))});` }
  : options);
