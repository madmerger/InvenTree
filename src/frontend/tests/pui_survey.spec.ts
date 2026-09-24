import { test } from './baseFixtures.js';
import { adminuser } from './defaults.js';
import { doCachedLogin } from './login.js';

/**
 * Test the survey response page (rendering and submission)
 */
test('Survey - Response', async ({ browser }) => {
  const page = await doCachedLogin(browser, {
    user: adminuser,
    url: 'survey/1/'
  });

  await page
    .getByText('1. How satisfied are you with InvenTree overall?')
    .waitFor();
  await page.getByText('10. Any other comments or suggestions?').waitFor();

  // Answer the required questions
  await page
    .getByLabel('How satisfied are you with InvenTree overall?')
    .click();
  await page
    .getByLabel('Would you recommend InvenTree to a colleague?')
    .click();
  await page.getByRole('radio', { name: 'Weekly' }).click();
  await page.getByRole('radio', { name: 'Engineering' }).click();

  await page.getByRole('button', { name: 'Submit' }).click();

  await page.getByText('Your response has been recorded').waitFor();
});
