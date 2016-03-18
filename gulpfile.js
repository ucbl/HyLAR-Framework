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

var appPath = path.resolve('app');
var libPath = path.resolve(appPath + '/lib');
var ontologyDirectoryPath = path.resolve(appPath + '/../ontologies/') + '/';
var devNodeServerPort = 3002;

var regtofix = /context = context \? _\.defaults\(root\.Object\(\), context, _\.pick\(root, contextProps\)\) : root;/g;
var lodashfix = 'context = context ? _.defaults(root.Object(), ' +
                'context, _.pick(root, contextProps)) : root; \n' +
                ' if (typeof context.Object !== "function") context = this;';

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

// Client-side code migration
gulp.task('build-migrate', function() {
    return gulp.src('node_modules/hylar/hylar/hylar.js')
        .pipe(debug())
        .pipe(browserify({
            insertGlobals : true,
            debug : false,
            standalone: 'lodash'
        }))
        .pipe(concat('hylar.js'))
        .pipe(replace(regtofix, lodashfix)) // Fixing lodash issues
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
    var target = gulp.src('./app/index.html');
    var sources = gulp.src([
            appPath + '/lib/angular.js',
            appPath + '/lib/jquery.js',
            appPath + '/lib/*.js',
            appPath + '/scripts/**/*.js',
            appPath + '/**/*.css'
    ]);
    return target
        .pipe(inject(sources, {
            'ignorePath': appPath,
            'addRootSlash': false
        }))
        .pipe(gulp.dest(appPath));
});

// Starts the webserver
gulp.task('webserver', function() {
    browserSync.init({
        server: {
            baseDir: appPath
        },
        notify: false,
        port: 8000
    });
});

// Starts the node.js server
gulp.task('nodeserver', function(cb) {
    exec('node_modules/hylar/hylar/server/server.js -p ' + devNodeServerPort + ' -od ' + ontologyDirectoryPath,
        function (err, stdout, stderr) {
            console.log(stdout);
            console.log(stderr);
            cb(err);
        });
    console.log('Deploying hylar server, port 3002.');
    console.log('HyLAR ontology directory set at ' + ontologyDirectoryPath);
});

// DEV environment
gulp.task('build-dev', function() {
    return runSequence('clean', 'build-bower', 'build-migrate', 'config-dev', 'build-index');
});

gulp.task('build-run-dev', function() {
    return runSequence('clean', 'build-bower', 'build-migrate', 'config-dev', 'build-index', 'webserver', 'nodeserver');
});

// PROD environment
gulp.task('build-prod', function() {
    return runSequence('clean', 'build-bower', 'build-migrate', 'config-prod', 'build-index');
});

gulp.task('build-run-prod', function() {
    return runSequence('clean', 'build-bower', 'build-migrate', 'config-prod', 'build-index', 'webserver', 'nodeserver');
});

// Both
gulp.task('serve', function() {
    return runSequence('webserver', 'nodeserver');
});