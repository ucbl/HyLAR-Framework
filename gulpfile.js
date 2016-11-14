/**
 * Created by Spadon on 28/07/2015.
 */

var gulp = require('gulp');
var browserSync = require('browser-sync').create();
var mainBowerFiles = require('main-bower-files');
var clean = require('gulp-clean');
var inject = require('gulp-inject');
var runSequence = require('run-sequence');
var browserify = require('gulp-browserify');
var concat = require('gulp-concat');
var replace = require('gulp-replace');
var debug = require('gulp-debug');
var exec = require('child_process').exec;
var path = require('path');

var appPath = 'app';
var libPath = './lib';
var ontologyDirectoryPath = path.resolve(appPath + '/../ontologies/') + '/';
var devNodeServerPort = 3002;
var webServerPort = 8000;

var regAll = /(.|\n|\r)*/;
var configDev = "angular.module('config', []).constant('ENV', {name:'development',serverRootPath:'http://localhost:" + devNodeServerPort.toString() + "'});";
var configProd = "angular.module('config', []).constant('ENV', {name:'production',serverRootPath:'http://dataconf.liris.cnrs.fr/owlReasonerServer'});";

// Cleans lib folder
gulp.task('clean', function () {
    return gulp.src(libPath, {read: false})
        .pipe(clean());
});

// Puts bower dependencies into app/lib
gulp.task('build-bower', function() {
    return gulp.src(mainBowerFiles())
        .pipe(gulp.dest(libPath));
});

// Configuring the server URL for the development environment
gulp.task('config-dev', function() {
    return gulp.src('./app/scripts/config.js')
        .pipe(replace(regAll, configDev))
        .pipe(gulp.dest(appPath + '/scripts/'));
});

// Configuring the server URL for the production environment
gulp.task('config-prod', function() {
    return gulp.src('./app/scripts/config.js')
        .pipe(replace(regAll, configProd))
        .pipe(gulp.dest(appPath + '/scripts/'));
});

// Add js and css dependencies into index.html. Some files and directories are voluntary ordered.
gulp.task('build-index', function() {
    var target = gulp.src('./index.html');
    var sources = gulp.src([
            libPath + '/*.js',
            libPath + '/*.css'
    ]).pipe(debug(libPath));
    return target
        .pipe(inject(sources, {
            'ignorePath': libPath,
            'addRootSlash': false
        }))                
        .pipe(gulp.dest('./'));
});

// Starts the webserver
gulp.task('webserver', function() {
    exec('npm start', function (err, stdout, stderr) {
        console.log(stdout);
        console.log(stderr);
        cb(err);
    });
});

// Starts the node.js server
gulp.task('nodeserver', function(cb) {
    exec('hylar -p ' + devNodeServerPort + ' -od ' + ontologyDirectoryPath,
        function (err, stdout, stderr) {
            console.log(stdout);
            console.log(stderr);
            cb(err);
        });
});

// DEV environment
gulp.task('build-dev', function() {
    return runSequence('clean', 'build-bower', 'config-dev', 'build-index');
});

gulp.task('build-run-dev', function() {
    return runSequence('clean', 'build-bower', 'config-dev', 'build-index', 'webserver', 'nodeserver');
});

// PROD environment
gulp.task('build-prod', function() {
    return runSequence('clean', 'build-bower', 'config-prod', 'build-index');
});

gulp.task('build-run-prod', function() {
    return runSequence('clean', 'build-bower', 'config-prod', 'build-index', 'webserver', 'nodeserver');
});

// Both
gulp.task('run', function() {
    return runSequence('webserver', 'nodeserver');
});