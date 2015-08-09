var del    = require('del');
var gulp   = require('gulp');
var babel  = require('gulp-babel');
var eslint = require('gulp-eslint');
var merge  = require('merge-stream');

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
        username:  'amtestcafehammerhead',
        accessKey: '694a3135-48f9-4fc1-a033-9560c55bced7',
        build:     'build',
        tags:      'master',
        browsers:  browsers,
        name:      'QUnit tests'
    };

    var server = require('./test/index');

    function testsDone (err) {
        server.close();
        done(err);
    }

    server
        .saucelabs(sauceLabsSettings)
        .run()
        .then(testsDone)
        .catch(testsDone);
});
