import { t } from '@lingui/core/macro';
import { Alert, Stack } from '@mantine/core';
import dayjs from 'dayjs';
import { useCallback, useMemo, useState } from 'react';

import { ProgressBar } from '@lib/components/ProgressBar';
import { StylishText } from '@lib/components/StylishText';
import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { ModelType } from '@lib/enums/ModelType';
import { UserRoles } from '@lib/enums/Roles';
import { apiUrl } from '@lib/functions/Api';
import { formatDecimal } from '@lib/functions/Formatting';
import useTable from '@lib/hooks/UseTable';
import type { TableFilter } from '@lib/types/Filters';
import type { TableColumn } from '@lib/types/Tables';
import PermissionDenied from '../../components/errors/PermissionDenied';
import { PageDetail } from '../../components/nav/PageDetail';
import {
  CompanyColumn,
  DescriptionColumn,
  LineItemsProgressColumn,
  PartColumn,
  ReferenceColumn,
  StatusColumn,
  TargetDateColumn
} from '../../components/tables/ColumnRenderers';
import { SupplierFilter } from '../../components/tables/Filter';
import { InvenTreeTable } from '../../components/tables/InvenTreeTable';
import { useUserState } from '../../states/UserState';

/*
 * Table of sales orders which are scheduled to ship on the provided date
 */
function ShippingSalesOrderTable({
  date,
  selectedOrder,
  onSelectOrder
}: Readonly<{
  date: string;
  selectedOrder?: any;
  onSelectOrder: (order: any) => void;
}>) {
  const table = useTable('inbound-status-sales-orders');

  const tableColumns: TableColumn[] = useMemo(() => {
    return [
      ReferenceColumn({}),
      {
        accessor: 'customer__name',
        title: t`Customer`,
        sortable: true,
        render: (record: any) => (
          <CompanyColumn company={record.customer_detail} />
        )
      },
      DescriptionColumn({}),
      LineItemsProgressColumn({}),
      StatusColumn({ model: ModelType.salesorder }),
      TargetDateColumn({})
    ];
  }, []);

  const onRowClick = useCallback(
    (record: any) => {
      onSelectOrder(record.pk == selectedOrder?.pk ? null : record);
    },
    [onSelectOrder, selectedOrder]
  );

  return (
    <InvenTreeTable
      url={apiUrl(ApiEndpoints.sales_order_list)}
      tableState={table}
      columns={tableColumns}
      props={{
        params: {
          target_date: date,
          customer_detail: true
        },
        onRowClick: onRowClick,
        enableDownload: true,
        enableSearch: true,
        rowStyle: (record: any) =>
          record.pk == selectedOrder?.pk ? { fontWeight: 'bold' } : undefined,
        noRecordsText: t`No sales orders scheduled for this date`
      }}
    />
  );
}

/*
 * Table of purchase order line items which supply the parts
 * required by the sales orders shipping on the provided date
 */
function InboundLineItemTable({
  date,
  salesOrder
}: Readonly<{
  date: string;
  salesOrder?: any;
}>) {
  const table = useTable('inbound-status-line-items');

  const tableColumns: TableColumn[] = useMemo(() => {
    return [
      {
        accessor: 'order_detail.reference',
        title: t`Purchase Order`,
        sortable: true,
        ordering: 'order'
      },
      {
        accessor: 'order_detail.supplier_name',
        title: t`Supplier`,
        sortable: true,
        ordering: 'supplier'
      },
      PartColumn({
        part: 'part_detail',
        ordering: 'part_name'
      }),
      {
        accessor: 'quantity',
        title: t`Quantity`,
        sortable: true,
        render: (record: any) => formatDecimal(record.quantity)
      },
      {
        accessor: 'received',
        title: t`Received`,
        sortable: true,
        render: (record: any) => (
          <ProgressBar
            progressLabel={true}
            value={record.received}
            maximum={record.quantity}
          />
        )
      },
      StatusColumn({
        model: ModelType.purchaseorder,
        accessor: 'order_detail.status_custom_key',
        title: t`Order Status`,
        sortable: false
      }),
      TargetDateColumn({})
    ];
  }, []);

  const tableFilters: TableFilter[] = useMemo(() => {
    return [
      SupplierFilter(),
      {
        name: 'received',
        label: t`Received`,
        description: t`Show line items which have been received`
      },
      {
        name: 'pending',
        label: t`Pending`,
        description: t`Show line items for pending orders`
      }
    ];
  }, []);

  const tableParams = useMemo(() => {
    return {
      part_detail: true,
      order_detail: true,
      ...(salesOrder
        ? { sales_order: salesOrder.pk }
        : { sales_order_target_date: date })
    };
  }, [date, salesOrder]);

  return (
    <InvenTreeTable
      url={apiUrl(ApiEndpoints.purchase_order_line_list)}
      tableState={table}
      columns={tableColumns}
      props={{
        params: tableParams,
        tableFilters: tableFilters,
        enableDownload: true,
        defaultSortColumn: 'supplier',
        modelType: ModelType.purchaseorder,
        modelField: 'order',
        noRecordsText: t`No inbound items found`
      }}
    />
  );
}

/*
 * Display the status of incoming supplier deliveries,
 * for the parts required by the sales orders shipping today
 */
export function InboundStatusContent() {
  const today: string = useMemo(() => dayjs().format('YYYY-MM-DD'), []);

  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  return (
    <Stack gap='xs'>
      <StylishText size='lg'>{t`Sales Orders Shipping Today`}</StylishText>
      <ShippingSalesOrderTable
        date={today}
        selectedOrder={selectedOrder}
        onSelectOrder={setSelectedOrder}
      />
      <StylishText size='lg'>{t`Inbound Status`}</StylishText>
      <Alert color='blue' title={t`Supplier Deliveries`}>
        {selectedOrder
          ? t`Showing incoming items for the parts required by sales order ${selectedOrder.reference}`
          : t`Showing incoming items for the parts required by all sales orders shipping today. Select a sales order above to filter the results.`}
      </Alert>
      <InboundLineItemTable date={today} salesOrder={selectedOrder} />
    </Stack>
  );
}

export default function InboundStatus() {
  const user = useUserState();

  if (!user.isLoggedIn() || !user.hasViewVisible(UserRoles.purchase_order)) {
    return <PermissionDenied />;
  }

  return (
    <Stack gap='xs'>
      <PageDetail
        title={t`Inbound Status`}
        breadcrumbs={[{ name: t`Purchasing`, url: '/purchasing/' }]}
      />
      <InboundStatusContent />
    </Stack>
  );
}
