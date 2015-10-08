/**
 * Created by Spadon on 28/07/2015.
 */

var gulp = require('gulp');
var webserver = require('gulp-webserver');
var mainBowerFiles = require('main-bower-files');
var clean = require('gulp-clean');
var inject = require('gulp-inject');
var runSequence = require('run-sequence');
var browserify = require('gulp-browserify');
var concat = require('gulp-concat');
var replace = require('gulp-replace');

var appPath = ('app');
var libPath = appPath + '/lib';
var serverPath = ('server');

var regtofix = /context = context \? _\.defaults\(root\.Object\(\), context, _\.pick\(root, contextProps\)\) : root;/g;
var lodashfix = 'context = context ? _.defaults(root.Object(), ' +
                'context, _.pick(root, contextProps)) : root; \n' +
                ' if (typeof context.Object !== "function") context = this;';

// Cleans lib folder
gulp.task('clean', function () {
    return gulp.src([libPath, appPath + '/scripts/reasoning/jsw.js'], {read: false})
        .pipe(clean());
});

// Puts bower dependencies into app/lib
gulp.task('build-bower', function() {
    return gulp.src(mainBowerFiles())
        .pipe(gulp.dest(libPath));
});

// Client-side code migration
gulp.task('build-migrate', function() {
    return gulp.src(serverPath + '/ontology/jsw/*.js')
        .pipe(browserify({
            insertGlobals : true,
            debug : false,
            standalone: 'lodash'
        }))
        .pipe(concat('jsw.js'))
        .pipe(replace(regtofix, lodashfix)) // Fixing lodash issues
        .pipe(gulp.dest(appPath + '/scripts/reasoning'));
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
    return target.pipe(inject(sources, { 'ignorePath': appPath }))
        .pipe(gulp.dest(appPath));
});

// Starts the webserver
gulp.task('server', function() {
    gulp.src(appPath)
        .pipe(webserver({
            open: true
        }));
});

gulp.task('default', function() {
    return runSequence('clean', 'build-bower', 'build-migrate','build-index', 'server');
});