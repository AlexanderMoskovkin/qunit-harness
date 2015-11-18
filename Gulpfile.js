var path    = require('path');
var del     = require('del');
var gulp    = require('gulp');
var babel   = require('gulp-babel');
var eslint  = require('gulp-eslint');
var webmake = require('gulp-webmake');
var merge   = require('merge-stream');

gulp.task('clean', function (cb) {
    del('lib', cb);
});

gulp.task('copy-vendor', ['clean'], function () {
    gulp
        .src('vendor/**/*.*')
        .pipe(gulp.dest('lib/vendor'));
});

gulp.task('build', ['lint', 'copy-vendor'], function () {
    var js = gulp
        .src(['src/**/*.js', '!src/**/*.mustache.js'])
        .pipe(babel());

    var templates = gulp
        .src('src/**/*.mustache');

    var jsTemplates = gulp
        .src('src/**/*.mustache.js')
        .pipe(webmake());

    return merge(js, templates, jsTemplates)
        .pipe(gulp.dest('lib'));
});

gulp.task('lint', function () {
    return gulp
        .src([
            'src/**/*.js',
            'test/**/*.js',
            'Gulpfile.js'
        ])
        .pipe(eslint())
        .pipe(eslint.format())
        .pipe(eslint.failAfterError());
});

gulp.task('test', ['build'], function () {
    require('./test/index');
});

gulp.task('saucelabs', ['lint', 'build'], function (done) {
    var BROWSERS = [
        {
            platform:    'Windows 10',
            browserName: 'chrome'
        },
        {
            platform:    'Windows 10',
            browserName: 'firefox'
        },
        {
            platform:    'Windows 10',
            browserName: 'internet explorer',
            version:     '11.0'
        },
        {
            platform:    'Windows 8',
            browserName: 'internet explorer',
            version:     '10.0'
        },
        {
            platform:    'Windows 10',
            browserName: 'microsoftedge',
            version:     '20.10240'
        },
        /*{
            platform:    'Windows 7',
            browserName: 'internet explorer',
            version:     '9.0'
        },
        */{
            browserName: 'iphone',
            platform:    'OS X 10.10',
            version:     '7.1',
            deviceName:  'iPhone Simulator'
        },
        {
            browserName: 'safari',
            platform:    'OS X 10.10',
            version:     '8.0'
        },
        {
            browserName: 'iphone',
            platform:    'OS X 10.10',
            version:     '8.1',
            deviceName:  'iPad Simulator'
        },
        {
            browserName: 'android',
            platform:    'Linux',
            version:     '5.1',
            deviceName:  'Android Emulator'
        }
    ];

    var sauceLabsSettings = {
        username:  process.env.SAUCELABS_USERNAME,
        accessKey: process.env.SAUCELABS_ACCESS_KEY,
        build:     process.env.TRAVIS_JOB_ID || 'build',
        tags:      [process.env.TRAVIS_BRANCH || 'master'],
        browsers:  BROWSERS,
        name:      'qunit-harness qunit tests',
        timeout:   60
    };

    var tests = ['/test1-test.js', '/test2-test/index-test.js', '/dir1/test3-test.js']
        .map(function (item) {
            return path.join(__dirname, '/test/tests/fixtures', item)
        });

    var server = require('./test/index');

    function testsDone (err) {
        server.close();
        done(err);
    }

    server
        .saucelabs(sauceLabsSettings)
        .tests(tests)
        .run()
        .then(testsDone)
        .catch(testsDone);
});
