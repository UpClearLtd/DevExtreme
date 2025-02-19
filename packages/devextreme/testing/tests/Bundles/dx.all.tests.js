const $ = require('jquery');

require('bundles/dx.all.js');

QUnit.test('DevExpress namespaces', function(assert) {
    const namespaces = [
        'Color', // from core

        'data',
        'ui',
        'viz',
        'events'
    ];

    $.each(namespaces, function(index, namespace) {
        assert.ok(DevExpress[namespace], namespace + ' namespace');
    });

    assert.ok(DevExpress.utils.readyCallbacks, 'readyCallbacks namespace');
});

require('./bundlesParts/core.tests.js');
require('./bundlesParts/events.tests.js');
require('./bundlesParts/data.tests.js');
require('./bundlesParts/data.odata.tests.js');
require('./bundlesParts/animation.tests.js');
require('./bundlesParts/widgets-base.tests.js');
require('./bundlesParts/widgets-web.tests.js');
