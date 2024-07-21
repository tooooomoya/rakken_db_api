const path = require('path');

module.exports = {
  outputDir: path.resolve(__dirname, 'docs'), // 出力ディレクトリを 'docs' に設定
  publicPath: './', // 公開パスを相対パスに設定
  configureWebpack: {
    output: {
      filename: 'js/[name].[contenthash:8].js',
      chunkFilename: 'js/[name].[contenthash:8].js'
    }
  },
  chainWebpack: config => {
    config.plugin('html').tap(args => {
      args[0].filename = path.resolve(__dirname, 'docs/index.html'); // index.html の出力パスを設定
      return args;
    });
  }
};
