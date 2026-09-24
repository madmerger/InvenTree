import { expect } from '@playwright/test';
import { createApi } from '../api.ts';
import { test } from '../baseFixtures.ts';
import { navigate } from '../helpers.ts';
import { doCachedLogin } from '../login.ts';

// Record video for this spec, to demonstrate the new "Inbound Status" screen
test.use({ video: 'on' });

/*
 * Ensure that at least one sales order is scheduled to ship today,
 * and that it requires parts which are on order from a supplier.
 */
async function createInboundFixture() {
  const api = await createApi({});

  const orders = await api
    .get('order/so/', { params: { limit: 20, outstanding: true } })
    .then((response) => response.json())
    .then((data) => data.results);

  // Find a sales order which requires parts on order from a supplier
  let order: any = null;
  let line: any = null;

  for (const candidate of orders) {
    const lines = await api
      .get('order/po-line/', {
        params: {
          limit: 1,
          sales_order: candidate.pk,
          order_detail: true,
          part_detail: true
        }
      })
      .then((response) => response.json());

    if (lines.count > 0) {
      order = candidate;
      line = lines.results[0];
      break;
    }
  }

  expect(order).not.toBeNull();

  // The sales order is scheduled to ship today
  const shipment = await api
    .post('order/so/shipment/', {
      data: {
        order: order.pk,
        reference: `PW-INBOUND-${Date.now()}`,
        shipment_date: new Date().toISOString().split('T')[0]
      }
    })
    .then((response) => response.json());

  return {
    reference: order.reference,
    supplier: line.order_detail.supplier_name,
    purchaseOrder: line.order_detail.reference,
    cleanup: async () => {
      await api.delete(`order/so/shipment/${shipment.pk}/`);
    }
  };
}

test('Purchasing - Inbound Status', async ({ browser }) => {
  const fixture = await createInboundFixture();

  const page = await doCachedLogin(browser, {
    url: 'purchasing/inbound-status/',
    contextOptions: {
      recordVideo: { dir: test.info().outputPath('video') }
    }
  });

  try {
    await page.getByText('Sales orders shipping today').waitFor();

    // The sales order shipping today is displayed
    await page.getByText(fixture.reference).first().waitFor();
    await page.getByText('Shipping Today').first().waitFor();

    // The inbound status table displays the associated purchase order line items
    await page
      .getByRole('cell', { name: fixture.purchaseOrder })
      .first()
      .waitFor();
    await page.getByRole('cell', { name: fixture.supplier }).first().waitFor();

    // Progress bars display the received / ordered quantities
    await expect(page.locator('.mantine-Progress-root').first()).toBeVisible();

    // Filter by the supplier associated with the purchase order
    const supplierFilter = page.getByRole('combobox', {
      name: 'inbound-supplier-filter'
    });
    await supplierFilter.click();
    await supplierFilter.fill(fixture.supplier);
    await page.getByRole('option', { name: fixture.supplier }).first().click();
    await page.getByRole('cell', { name: fixture.supplier }).first().waitFor();

    // The page is also reachable from the purchasing index
    await navigate(page, 'purchasing/index/');
    await page.getByRole('tab', { name: 'Inbound Status' }).click();
    await page.getByText('Sales orders shipping today').waitFor();
  } finally {
    await fixture.cleanup();

    // Close the context, so that the recorded video is saved to disk
    await page.context().close();
  }
});
