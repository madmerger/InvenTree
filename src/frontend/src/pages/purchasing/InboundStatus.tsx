import { ProgressBar } from '@lib/components/ProgressBar';
import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { ModelType } from '@lib/enums/ModelType';
import { UserRoles } from '@lib/enums/Roles';
import { apiUrl } from '@lib/functions/Api';
import { formatDecimal } from '@lib/functions/Formatting';
import useTable from '@lib/hooks/UseTable';
import type { TableColumn } from '@lib/types/Tables';
import { t } from '@lingui/core/macro';
import {
  Accordion,
  Alert,
  Badge,
  Group,
  Loader,
  Select,
  Stack,
  Text
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../App';
import PermissionDenied from '../../components/errors/PermissionDenied';
import { PageDetail } from '../../components/nav/PageDetail';
import {
  PartColumn,
  ReferenceColumn,
  StatusColumn,
  TargetDateColumn
} from '../../components/tables/ColumnRenderers';
import { InvenTreeTable } from '../../components/tables/InvenTreeTable';
import { useUserState } from '../../states/UserState';

/*
 * Table of purchase order line items which supply the parts
 * required by a given sales order.
 */
function InboundLineItemTable({
  salesOrderId,
  supplierId
}: Readonly<{
  salesOrderId: number;
  supplierId?: string | null;
}>) {
  const table = useTable(`inbound-status-${salesOrderId}`);

  const tableColumns: TableColumn[] = useMemo(() => {
    return [
      ReferenceColumn({
        accessor: 'order_detail.reference',
        title: t`Purchase Order`,
        sortable: true,
        ordering: 'order',
        switchable: false
      }),
      {
        accessor: 'order_detail.supplier_name',
        title: t`Supplier`,
        sortable: false,
        switchable: false
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
        switchable: false,
        render: (record: any) => (
          <ProgressBar
            progressLabel={true}
            value={record.received}
            maximum={record.quantity}
          />
        )
      },
      StatusColumn({
        accessor: 'order_detail.status',
        title: t`Order Status`,
        model: ModelType.purchaseorder,
        sortable: false
      }),
      TargetDateColumn({
        title: t`Expected Date`
      })
    ];
  }, []);

  return (
    <InvenTreeTable
      url={apiUrl(ApiEndpoints.purchase_order_line_list)}
      tableState={table}
      columns={tableColumns}
      props={{
        params: {
          sales_order: salesOrderId,
          supplier: supplierId || undefined,
          part_detail: true,
          order_detail: true
        },
        enableSelection: false,
        enableSearch: false,
        modelType: ModelType.purchaseorder,
        modelField: 'order'
      }}
    />
  );
}

/*
 * Panel content: inbound status for the sales orders shipping today
 */
export function InboundStatusPanel() {
  const [supplierId, setSupplierId] = useState<string | null>(null);

  const salesOrders = useQuery({
    queryKey: ['inbound-status-sales-orders'],
    queryFn: async () => {
      return api
        .get(apiUrl(ApiEndpoints.sales_order_list), {
          params: {
            shipped_today: true,
            customer_detail: true,
            limit: 100
          }
        })
        .then((response) => response.data?.results ?? response.data ?? []);
    }
  });

  const suppliers = useQuery({
    queryKey: ['inbound-status-suppliers'],
    queryFn: async () => {
      return api
        .get(apiUrl(ApiEndpoints.company_list), {
          params: { is_supplier: true, limit: 100 }
        })
        .then((response) => response.data?.results ?? response.data ?? []);
    }
  });

  const supplierOptions = useMemo(() => {
    return (suppliers.data ?? []).map((supplier: any) => ({
      value: String(supplier.pk),
      label: supplier.name
    }));
  }, [suppliers.data]);

  const orders: any[] = salesOrders.data ?? [];

  const [expanded, setExpanded] = useState<string[]>([]);

  useEffect(() => {
    setExpanded(orders.map((order: any) => String(order.pk)));
  }, [salesOrders.data]);

  return (
    <Stack gap='xs'>
      <Group justify='space-between'>
        <Text size='sm'>
          {t`Sales orders shipping today`}: {orders.length}
        </Text>
        <Select
          aria-label='inbound-supplier-filter'
          data={supplierOptions}
          value={supplierId}
          onChange={setSupplierId}
          placeholder={t`Filter by supplier`}
          clearable
          searchable
        />
      </Group>
      {salesOrders.isFetching && <Loader size='sm' />}
      {!salesOrders.isFetching && orders.length == 0 && (
        <Alert color='blue' title={t`No Results`}>
          <Text>{t`There are no sales orders shipping today`}</Text>
        </Alert>
      )}
      <Accordion multiple value={expanded} onChange={setExpanded}>
        {orders.map((order: any) => (
          <Accordion.Item key={order.pk} value={String(order.pk)}>
            <Accordion.Control>
              <Group gap='xs'>
                <Text fw={700}>{order.reference}</Text>
                <Text size='sm'>{order.customer_detail?.name}</Text>
                <Badge color='blue'>{t`Shipping Today`}</Badge>
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              <InboundLineItemTable
                salesOrderId={order.pk}
                supplierId={supplierId}
              />
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </Stack>
  );
}

/*
 * Standalone page: supplier inbound status for today's outgoing shipments
 */
export default function InboundStatus() {
  const user = useUserState();

  if (!user.isLoggedIn() || !user.hasViewVisible(UserRoles.purchase_order)) {
    return <PermissionDenied />;
  }

  return (
    <Stack>
      <PageDetail title={t`Inbound Status`} />
      <InboundStatusPanel />
    </Stack>
  );
}
