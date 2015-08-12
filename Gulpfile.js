var path     = require('path');
var del      = require('del');
var gulp     = require('gulp');
var babel    = require('gulp-babel');
var eslint   = require('gulp-eslint');
var merge    = require('merge-stream');
var getTests = require('./lib/utils/get-tests');

gulp.task('clean', function (cb) {
    del('lib', cb);
});

gulp.task('copy-vendor', ['clean'], function () {
    gulp
        .src('vendor/**/*.*')
        .pipe(gulp.dest('lib/vendor'));
});

gulp.task('build', ['clean'], function () {
    var js = gulp
        .src('src/**/*.js')
        .pipe(babel());

    var templates = gulp
        .src('src/**/*.mustache');

    return merge(js, templates)
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

gulp.task('test', ['lint', 'build', 'copy-vendor'], function () {
    require('./test/index');
});

gulp.task('saucelabs', ['lint', 'build', 'copy-vendor'], function (done) {
    var browsers = [{
        platform:    'Windows 10',
        browserName: 'chrome'
    }];

    var sauceLabsSettings = {
        username:  '***',
        accessKey: '***',
        build:     'build',
        tags:      'master',
        browsers:  browsers,
        name:      'QUnit tests',
        timeout:   60
    };

    var server = require('./test/index');

    function testsDone (err) {
        server.close();
        done(err);
    }

    getTests(path.join(__dirname, '/test/tests/fixtures')).then(function (tests) {
        server
            .saucelabs(sauceLabsSettings)
            .tests(tests)
            .run()
            .then(testsDone)
            .catch(testsDone);
    });
});
