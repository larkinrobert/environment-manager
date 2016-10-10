var webpack = require('webpack');  

module.exports = {  
  entry: './app/app.module.js',
  output: {
    path: '/',
    filename: 'bundle.js'
  },
  // Turn on sourcemaps
  devtool: 'source-map',
  resolve: {
    extensions: ['', '.webpack.js', '.web.js', '.ts', '.js']
  },
  // Add minification
  plugins: [
    // new webpack.optimize.UglifyJsPlugin()
  ],
  module: {
    loaders: [
      { test: /\.ts$/, loader: 'ts' }
    ]
  },
  devServer: {
    proxy: {'/api': {target: 'http://localhost:8080', changeOrigin: true}},
  }
}
