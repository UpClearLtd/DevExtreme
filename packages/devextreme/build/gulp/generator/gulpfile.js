'use strict';

const gulp = require('gulp');
const file = require('gulp-file');
const del = require('del');
const path = require('path');
const fs = require('fs');
const { generateComponents } = require('@devextreme-generator/build-helpers');
const { InfernoGenerator } = require('@devextreme-generator/inferno');
const ts = require('gulp-typescript');
const plumber = require('gulp-plumber');
const gulpIf = require('gulp-if');
const babel = require('gulp-babel');
const watch = require('gulp-watch');
const transpileConfig = require('../transpile-config');
const env = require('../env-variables');
const cached = require('gulp-cached');

const {
    BASE_GENERATOR_OPTIONS_WITH_JQUERY
} = require('./generator-options');

const generator = new InfernoGenerator();

const jQueryComponentsGlob = 'js/renovation/**/*.j.tsx';

const esmPackage = env.BUILD_ESM_PACKAGE;

const SRC = [
    'js/renovation/**/*.{tsx,ts}',
    `!${jQueryComponentsGlob}`,
    '!js/renovation/**/*.d.ts',
    '!js/renovation/**/__tests__/**/*',
    '!js/renovation/test_utils/**/*'
];

const COMPAT_TESTS_PARTS = 'testing/tests/Renovation/';

const knownErrors = [
    'js/renovation/component_wrapper/',
    'js\\renovation\\component_wrapper\\',
    'Cannot find module \'../../inferno/src\'',
    // #region TODO remove it after fix https://trello.com/c/2LOaxO9F/2704-renovation-some-types-is-missing-on-new-type-defining
    'Cannot find name \'GridBaseView\'',
    'Property \'views\' of exported interface has or is using private name \'GridBaseView\'',
    'Public property \'views\' of exported class has or is using private name \'GridBaseView\''
    // #endregion
];

const GENERATE_COMPONENTS_OPTIONS = {
    excludePathPatterns: ['__internal'],
};

function deleteJQueryComponents(cb) {
    del.sync(jQueryComponentsGlob);
    cb();
}

function generateJQueryComponents(isWatch) {
    const generator = new InfernoGenerator();
    generator.options = {
        ...BASE_GENERATOR_OPTIONS_WITH_JQUERY,
        generateJQueryOnly: true
    };


    const pipe = isWatch ?
        watch(SRC).on('ready', () => console.log(
            'generate-jquery-components task is watching for changes...'
        )) : gulp.src(SRC);

    return pipe
        .pipe(generateComponents(generator, GENERATE_COMPONENTS_OPTIONS))
        .pipe(plumber(()=>null))
        .pipe(gulp.dest('js/renovation/'));
}

const context = require('../context.js');
const { ifEsmPackage } = require('../utils');

const processErrors = (knownErrors, errors = []) => (e) => {
    if(!knownErrors.some(i => e.message.includes(i))) {
        errors.push(e);
        console.log(e.message);
    }
};

function generateInfernoComponents(distPath, babelConfig, dev) {
    return function generateInfernoComponents(done) {
        const tsProject = ts.createProject('build/gulp/generator/ts-configs/inferno.tsconfig.json');

        generator.options = BASE_GENERATOR_OPTIONS_WITH_JQUERY;

        const errors = [];
        const isNotDTS = (file) => !file.path.endsWith('.d.ts');
        const isDefault = distPath === './';

        return gulp.src(SRC, { base: 'js' })
            .pipe(gulpIf(dev, cached('generate-inferno-component')))
            .pipe(generateComponents(generator, GENERATE_COMPONENTS_OPTIONS))
            .pipe(plumber(() => null))
            .pipe(tsProject({
                error: processErrors(knownErrors, errors),
                finish() {}
            }))
            .pipe(gulpIf(isNotDTS, babel(babelConfig)))
            .on('error', function(e) {
                console.log('babel error occured:')
                console.log(e)
                done(1);
            })
            .pipe(gulpIf(isDefault, gulp.dest(context.TRANSPILED_PATH)))
            .pipe(gulpIf(isDefault, gulp.dest(context.TRANSPILED_RENOVATION_PATH)))
            .pipe(gulpIf(isDefault, gulp.dest(context.TRANSPILED_PROD_RENOVATION_PATH)))
            .pipe(gulpIf(esmPackage, gulp.dest(path.join(context.TRANSPILED_PROD_ESM_PATH, distPath))))
            .on('end', function() {
                done(/* !dev && errors.length || undefined*/);
            });
    };
}

function processRenovationMeta() {
    const widgetsMeta = generator
        .getComponentsMeta()
        .filter(meta =>
            meta.decorator &&
            meta.decorator.jQuery &&
            meta.decorator.jQuery.register === 'true' &&
            fs.existsSync(meta.path));

    const metaJson = JSON.stringify(widgetsMeta.map(meta => ({
        widgetName: `dx${meta.name}`,
        ...meta,
        path: path.relative(COMPAT_TESTS_PARTS, meta.path).replace(/\\/g, '/')
    })), null, 2);

    return file('widgets.json', metaJson, { src: true })
        .pipe(gulp.dest(COMPAT_TESTS_PARTS));
}

gulp.task('generate-jquery-components-clean', deleteJQueryComponents);

gulp.task('generate-jquery-components-run', function generateJQuery() {
    return generateJQueryComponents(false);
});

gulp.task('generate-jquery-components', gulp.series('generate-jquery-components-clean', 'generate-jquery-components-run'));

gulp.task('generate-jquery-components-watch', function watchJQueryComponents() {
    return generateJQueryComponents(true);
});

gulp.task('generate-components', gulp.series(
    'generate-jquery-components',
    generateInfernoComponents('./', transpileConfig.cjs),
    ifEsmPackage(generateInfernoComponents('./esm', transpileConfig.esm)),
    ifEsmPackage(generateInfernoComponents('./cjs', transpileConfig.cjs)),
    processRenovationMeta
));

gulp.task('generate-components-dev', gulp.series(
    'generate-jquery-components',
    generateInfernoComponents('./', transpileConfig.cjs, true),
    processRenovationMeta
));

gulp.task('generate-inferno-components-watch', function() {
    gulp
        .watch(SRC, gulp.series(
            generateInfernoComponents('./', transpileConfig.cjs, true)
        ))
        .on('ready', () => console.log(
            'generate-inferno-components task is watching for changes...'
        ));
});

gulp.task('generate-components-watch', gulp.series('generate-components', function() {
    gulp
        .watch(SRC, gulp.series('generate-components-dev'))
        .on('ready', () => console.log(
            'generate-components task is watching for changes...'
        ));
}));
