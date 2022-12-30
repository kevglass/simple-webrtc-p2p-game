const config = require('./version.json');
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin')
const TsConfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: './src/index.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: 'string-replace-loader',
            options: {
              search: '_VERSION_',
              replace: '' + config.version,
              flags: 'g'
            }
          },
          {
            loader: 'ts-loader',
            options: {
              appendTsSuffixTo: [/\.json$/]
            }
          },
        ],
        exclude: /node_modules/,
      },
      {
        test: /\.(ldtk)$/i,
        loader: "file-loader",
        options: {
          name: '[path][name].[ext]',
        },
      },
      {
        test: /\.(mp3)$/i,
        loader: "file-loader",
        options: {
          name: '[path][name].[ext]',
        },
      },
      {
        test: /\.(png)$/i,
        loader: "file-loader",
        options: {
          name: '[path][name].[ext]',
        },
      },
      {
        test: /\.(map)$/i,
        loader: "file-loader",
        options: {
          name: '[path][name].[ext]',
        },
      },
    ],
  },
  resolve: {
    plugins: [new TsConfigPathsPlugin({})],
    extensions: ['.tsx', '.ts', '.js'],
    symlinks: true
  },
  devtool: 'eval-source-map',
  devServer: {
    headers: {
      'Cache-Control': 'no-store',
    },
    contentBase: 'dist',
    watchContentBase: true,
    disableHostCheck: true,
    writeToDisk: true
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist')
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: 'src/index.html',
      inject: false,
      templateParameters: {
        version: config.version
      }
    }),
  ]
};
