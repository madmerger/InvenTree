import { expect, test } from '../baseFixtures.js';
import { apiUrl } from '../defaults.js';
import { loadTab } from '../helpers.js';
import { doCachedLogin } from '../login.js';

// Record video for these tests - the context is created by doCachedLogin,
// so the recording options must be passed through explicitly
const recordVideo = () => ({
  recordVideo: { dir: test.info().outputDir }
});

test('Part - Stock Forecast', async ({ browser }) => {
  const page = await doCachedLogin(browser, {
    url: 'part/17/details',
    contextOptions: recordVideo()
  });

  const forecastResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/part/17/stock-forecast/') &&
      response.status() === 200
  );

  await loadTab(page, 'Stock History');

  const response = await forecastResponse;
  const data = await response.json();

  expect(data.part).toBe(17);
  expect(data.horizon_days).toBe(30);
  expect(data.forecast.length).toBe(30);

  // The forecast series is rendered in the chart legend
  await page.getByText('Forecast Quantity').first().waitFor();
  await page.getByText('Forecast Lower').first().waitFor();
  await page.getByText('Forecast Upper').first().waitFor();

  // Historical series are still displayed
  await page.getByText('Minimum Value').first().waitFor();

  // The chart itself is rendered
  await expect(page.locator('.mantine-LineChart-root')).toBeVisible();

  // Close the context so that the video file is written to disk
  await page.context().close();
});

test('Part - Stock Forecast - No History', async ({ browser }) => {
  // Part 911 has no stocktake history - an empty forecast is returned
  const page = await doCachedLogin(browser, {
    url: 'part/911/details',
    contextOptions: recordVideo()
  });

  await loadTab(page, 'Stock History');

  const response = await page.request.get(
    `${apiUrl}part/911/stock-forecast/?horizon_days=30`
  );

  expect(response.status()).toBe(200);
  expect((await response.json()).forecast).toHaveLength(0);

  await page.context().close();
});
