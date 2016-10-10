/* Copyright (c) Trainline Limited, 2016. All rights reserved. See LICENSE.txt in the project root for license information. */
'use strict';

let fs = require('fs');
let gulp = require('gulp');
let zip = require('gulp-zip');

/**
 *  This will load all js files in the gulp directory
 *  in order to load all gulp tasks
 */
fs.readdirSync('./gulp').filter(function(file) {
  return (/\.js$/i).test(file);
}).map(function(file) {
  require('./gulp/' + file);
});


/**
 *  Default task clean temporaries directories and launch the
 *  main optimization build task
 */
gulp.task('default', ['clean'], function () {
  gulp.start('serve');
});

var webpack = require("webpack");
var WebpackDevServer = require("webpack-dev-server");

gulp.task("webpack-dev-server", function(callback) {
    // Start a webpack-dev-server
    var compiler = webpack(require('./webpack.config.js'));

    new WebpackDevServer(compiler, {
      proxy: {
        '/api': {target: 'http://localhost:8080', changeOrigin: true},
        '/user.js': {target: 'http://localhost:8080', changeOrigin: true},
        '/cronService.js': {target: 'http://localhost:8080', changeOrigin: true}
      } 
    }).listen(8081, "localhost", function(err) {
        if(err) throw new gutil.PluginError("webpack-dev-server", err);
        // Server listening
        console.log("[webpack-dev-server]", "http://localhost:8080/webpack-dev-server/index.html");

        // keep the server alive or continue?
        // callback();
    });
});