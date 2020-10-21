const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'index.js'
  },

  module: {
    rules: [
      {
        test: /\.gr$/,
        use: [
          {
            loader: path.resolve('../dist/index.js'),
            options: {
              grainHome: path.join(__dirname, '../../grain')
            }
          }
        ]
      }
    ]
  },

  plugins: [
    new HtmlWebpackPlugin({
      template: './index.html'
    })
  ],

  devServer: {
    publicPath: '/dist',
    contentBase: path.join(__dirname, 'dist'),
    writeToDisk: true,
    port: 8080
  }
};
