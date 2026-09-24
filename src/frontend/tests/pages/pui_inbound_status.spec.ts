import { expect } from '@playwright/test';
import { createApi } from '../api.ts';
import { test } from '../baseFixtures.ts';
import { navigate } from '../helpers.ts';
import { doCachedLogin } from '../login.ts';

test('Purchasing - Inbound Status', async ({ browser }, testInfo) => {
  const api = await createApi({});

  const today = new Date().toISOString().split('T')[0];

  // Select a salable assembly, so that the sales order created below
  // requires parts which are on order from a supplier
  const parts = await api
    .get('part/', { params: { salable: true, assembly: true, limit: 1 } })
    .then((res) => res.json());

  const part = parts.results[0];
  expect(part).toBeTruthy();

  const customers = await api
    .get('company/', { params: { is_customer: true, limit: 1 } })
    .then((res) => res.json());

  const customer = customers.results[0];
  expect(customer).toBeTruthy();

  // Create a sales order which is scheduled to ship today
  const order = await api
    .post('order/so/', {
      data: {
        customer: customer.pk,
        description: 'Inbound status test order',
        target_date: today
      }
    })
    .then((res) => res.json());

  expect(order.pk).toBeTruthy();

  await api.post('order/so-line/', {
    data: { order: order.pk, part: part.pk, quantity: 5 }
  });

  // Determine the purchase order line items which are expected to be displayed
  const lines = await api
    .get('order/po-line/', {
      params: {
        sales_order: order.pk,
        order_detail: true,
        ordering: 'supplier',
        limit: 1
      }
    })
    .then((res) => res.json());

  const line = lines.results[0];
  expect(line).toBeTruthy();

  const page = await doCachedLogin(browser, {
    url: 'purchasing/inbound-status/',
    contextOptions: { recordVideo: { dir: testInfo.outputDir } }
  });

  await page
    .getByText('Sales Orders Shipping Today', { exact: true })
    .waitFor();

  // The newly created sales order is displayed
  const orderRow = page.getByRole('row').filter({ hasText: order.reference });
  await orderRow.waitFor();

  // Select the sales order, to filter the inbound items
  await orderRow.click();
  await page
    .getByText(
      `Showing incoming items for the parts required by sales order ${order.reference}`
    )
    .waitFor();

  // Inbound line items (for the parts required by the order) are displayed,
  // including a progress bar for the received quantity
  await page
    .getByRole('cell', { name: line.order_detail.reference })
    .first()
    .waitFor();
  await expect(
    page.getByText(`${line.received} / ${line.quantity}`).first()
  ).toBeVisible();

  // The page is also reachable from the purchasing index
  await navigate(page, 'purchasing/index/');
  await page.getByRole('tab', { name: 'Inbound Status' }).click();
  await page
    .getByText('Sales Orders Shipping Today', { exact: true })
    .waitFor();

  // Clean up the test data
  await api.delete(`order/so/${order.pk}/`);

  // Close the context, so that the video recording is saved
  await page.close();
  await page.context().close();
});
