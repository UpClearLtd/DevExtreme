import { createScreenshotsComparer } from 'devextreme-screenshot-comparer';
import { Selector as $ } from 'testcafe';
import { runManualTest } from '../../../utils/visual-tests/matrix-test-helper';
import { testScreenshot } from '../../../utils/visual-tests/helpers/theme-utils';

fixture('Charts.Crosshair')
  .page('http://localhost:8080/')
  .before(async (ctx) => {
    ctx.initialWindowSize = [900, 600];
  });

runManualTest('Charts', 'Crosshair', ['jQuery', 'React', 'Vue', 'Angular'], (test) => {
  test('Chart.Crosshair', async (t) => {
    const { takeScreenshot, compareResults } = createScreenshotsComparer(t);

    await t.hover($('.dxc-series').nth(1).find('circle').nth(1));
    await testScreenshot(t, takeScreenshot, 'charts_crosshair.png');

    await t
      .expect(compareResults.isValid())
      .ok(compareResults.errorMessages());
  });
});
