import { RowDeleteAction, RowEditAction } from '@lib/components/RowActions';
import { StylishText } from '@lib/components/StylishText';
import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { UserRoles } from '@lib/enums/Roles';
import { apiUrl } from '@lib/functions/Api';
import useTable from '@lib/hooks/UseTable';
import { AddItemButton } from '@lib/index';
import type { TableColumn } from '@lib/types/Tables';
import { t } from '@lingui/core/macro';
import { type ChartTooltipProps, LineChart } from '@mantine/charts';
import {
  Accordion,
  Center,
  Divider,
  Loader,
  Paper,
  SimpleGrid,
  Text
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useCallback, useMemo, useState } from 'react';
import { api } from '../../App';
import {
  DateColumn,
  DecimalColumn
} from '../../components/tables/ColumnRenderers';
import { InvenTreeTable } from '../../components/tables/InvenTreeTable';
import { formatDate, formatPriceRange } from '../../defaults/formatters';
import { partStocktakeFields } from '../../forms/PartForms';
import {
  useCreateApiFormModal,
  useDeleteApiFormModal,
  useEditApiFormModal
} from '../../hooks/UseForm';
import { useUserState } from '../../states/UserState';
import { StockTrackingTable } from '../../tables/stock/StockTrackingTable';

/*
 * Render a tooltip for the chart, with correct date information
 */
function ChartTooltip({ label, payload }: Readonly<ChartTooltipProps>) {
  const formattedLabel: string = useMemo(() => {
    if (label && typeof label === 'number') {
      return formatDate(dayjs(label).format('YYYY-MM-DD')) ?? label;
    } else if (!!label) {
      return label.toString();
    } else {
      return '';
    }
  }, [label]);

  if (!payload) {
    return null;
  }

  const quantity = payload.find((item) => item.name == 'quantity');
  const value_min = payload.find((item) => item.name == 'value_min');
  const value_max = payload.find((item) => item.name == 'value_max');
  const forecast = payload.find((item) => item.name == 'forecast_quantity');
  const forecast_min = payload.find((item) => item.name == 'forecast_lower');
  const forecast_max = payload.find((item) => item.name == 'forecast_upper');

  return (
    <Paper px='md' py='sm' withBorder shadow='md' radius='md'>
      <Text key='title'>{formattedLabel}</Text>
      <Divider />
      {quantity?.value != undefined && (
        <Text key='quantity' fz='sm'>
          {t`Quantity`} : {quantity?.value}
        </Text>
      )}
      {(value_min?.value != undefined || value_max?.value != undefined) && (
        <Text key='values' fz='sm'>
          {t`Value`} : {formatPriceRange(value_min?.value, value_max?.value)}
        </Text>
      )}
      {forecast?.value != undefined && (
        <Text key='forecast' fz='sm'>
          {t`Forecast Quantity`} : {forecast?.value}
        </Text>
      )}
      {forecast_min?.value != undefined && (
        <Text key='forecast-range' fz='sm'>
          {t`Forecast Range`} : {forecast_min?.value} - {forecast_max?.value}
        </Text>
      )}
    </Paper>
  );
}

export function PartStocktakePanel({ partId }: Readonly<{ partId: number }>) {
  const user = useUserState();
  const table = useTable('part-stocktake');

  const stocktakeFields = useMemo(() => partStocktakeFields(), []);

  const [selectedStocktake, setSelectedStocktake] = useState<
    number | undefined
  >(undefined);

  const editStocktakeEntry = useEditApiFormModal({
    pk: selectedStocktake,
    url: ApiEndpoints.part_stocktake_list,
    title: t`Edit Stocktake Entry`,
    fields: stocktakeFields,
    table: table
  });

  const deleteStocktakeEntry = useDeleteApiFormModal({
    pk: selectedStocktake,
    url: ApiEndpoints.part_stocktake_list,
    title: t`Delete Stocktake Entry`,
    table: table
  });

  const newStocktakeEntry = useCreateApiFormModal({
    title: t`Generate Stocktake Report`,
    url: apiUrl(ApiEndpoints.part_stocktake_generate),
    fields: {
      part: {
        value: partId,
        disabled: true
      },
      generate_entry: {
        value: true,
        hidden: true
      }
    },
    submitText: t`Generate`,
    successMessage: t`Stocktake report scheduled for generation`
  });

  const tableColumns: TableColumn[] = useMemo(() => {
    return [
      DateColumn({}),
      DecimalColumn({
        accessor: 'item_count',
        title: t`Stock Items`,
        switchable: true,
        sortable: false
      }),
      DecimalColumn({
        accessor: 'quantity',
        title: t`Stock Quantity`,
        sortable: false,
        switchable: false
      }),
      {
        accessor: 'cost',
        title: t`Stock Value`,
        sortable: false,
        render: (record: any) => {
          return formatPriceRange(record.cost_min, record.cost_max, {
            currency: record.cost_min_currency
          });
        }
      }
    ];
  }, []);

  const rowActions = useCallback(
    (record: any) => {
      return [
        RowEditAction({
          hidden: !user.hasChangeRole(UserRoles.part) || !user.isSuperuser(),
          onClick: () => {
            setSelectedStocktake(record.pk);
            editStocktakeEntry.open();
          }
        }),
        RowDeleteAction({
          hidden: !user.hasDeleteRole(UserRoles.part),
          onClick: () => {
            setSelectedStocktake(record.pk);
            deleteStocktakeEntry.open();
          }
        })
      ];
    },
    [user]
  );

  // Fetch the stock quantity forecast for this part
  const forecastQuery = useQuery({
    enabled: !!partId,
    queryKey: ['part-stock-forecast', partId, table.records?.length],
    queryFn: async () =>
      api
        .get(apiUrl(ApiEndpoints.part_stock_forecast, partId))
        .then((response) => response.data?.forecast ?? [])
        .catch(() => [])
  });

  const chartData = useMemo(() => {
    const records: any[] =
      table.records?.map((record: any) => {
        return {
          date: new Date(record.date).valueOf(),
          quantity: record.quantity,
          value_min: Number.parseFloat(record.cost_min),
          value_max: Number.parseFloat(record.cost_max)
        };
      }) ?? [];

    // Sort records to ensure correct date order
    records.sort((a, b) => a.date - b.date);

    const forecast: any[] =
      forecastQuery.data?.map((point: any) => {
        return {
          date: new Date(point.date).valueOf(),
          forecast_quantity: point.quantity,
          forecast_lower: point.lower,
          forecast_upper: point.upper
        };
      }) ?? [];

    // Anchor the forecast series to the most recent historical data point
    if (records.length > 0 && forecast.length > 0) {
      const last = records[records.length - 1];
      last.forecast_quantity = last.quantity;
      last.forecast_lower = last.quantity;
      last.forecast_upper = last.quantity;
    }

    return [...records, ...forecast];
  }, [table.records, forecastQuery.data]);

  // Calculate the date limits of the chart
  const chartLimits: number[] = useMemo(() => {
    let min_date = new Date();
    let max_date = new Date();

    if (chartData.length > 0) {
      min_date = new Date(chartData[0].date);
      max_date = new Date(chartData[chartData.length - 1].date);
    }

    // Expand limits by one day on either side
    min_date.setDate(min_date.getDate() - 1);
    max_date.setDate(max_date.getDate() + 1);

    return [min_date.valueOf(), max_date.valueOf()];
  }, [chartData]);

  const tableActions = useMemo(() => {
    return [
      <AddItemButton
        hidden={!user.hasAddRole(UserRoles.part)}
        key='add-stocktake'
        tooltip={t`Generate Stocktake Entry`}
        onClick={() => newStocktakeEntry.open()}
      />
    ];
  }, [user]);

  return (
    <>
      {newStocktakeEntry.modal}
      {editStocktakeEntry.modal}
      {deleteStocktakeEntry.modal}
      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <InvenTreeTable
          url={apiUrl(ApiEndpoints.part_stocktake_list)}
          tableState={table}
          columns={tableColumns}
          props={{
            enableSelection: true,
            enableBulkDelete: true,
            enableDownload: true,
            params: {
              part: partId,
              ordering: '-date'
            },
            rowActions: rowActions,
            tableActions: tableActions
          }}
        />
        {table.isLoading ? (
          <Center>
            <Loader />
          </Center>
        ) : (
          <LineChart
            data={chartData}
            mah={'500px'}
            dataKey='date'
            withLegend
            withYAxis
            withRightYAxis
            yAxisLabel={t`Quantity`}
            rightYAxisLabel={t`Stock Value`}
            tooltipProps={{
              content: ({ label, payload }) => (
                <ChartTooltip label={label} payload={payload as any} />
              )
            }}
            yAxisProps={{
              allowDataOverflow: false
            }}
            rightYAxisProps={{
              allowDataOverflow: false
            }}
            xAxisProps={{
              scale: 'time',
              type: 'number',
              domain: chartLimits,
              tickFormatter: (value: number) => {
                return formatDate(dayjs(value).format('YYYY-MM-DD'));
              }
            }}
            series={[
              {
                name: 'quantity',
                label: t`Quantity`,
                color: 'blue.6',
                yAxisId: 'left'
              },
              {
                name: 'value_min',
                label: t`Minimum Value`,
                color: 'yellow.6',
                yAxisId: 'right'
              },
              {
                name: 'value_max',
                label: t`Maximum Value`,
                color: 'teal.6',
                yAxisId: 'right'
              },
              {
                name: 'forecast_quantity',
                label: t`Forecast Quantity`,
                color: 'red.6',
                strokeDasharray: '5 5',
                yAxisId: 'left'
              },
              {
                name: 'forecast_lower',
                label: t`Forecast Lower`,
                color: 'gray.5',
                strokeDasharray: '2 4',
                yAxisId: 'left'
              },
              {
                name: 'forecast_upper',
                label: t`Forecast Upper`,
                color: 'gray.5',
                strokeDasharray: '2 4',
                yAxisId: 'left'
              }
            ]}
          />
        )}
      </SimpleGrid>
    </>
  );
}

export default function PartStockHistoryDetail({
  partId
}: Readonly<{ partId: number }>) {
  return (
    <Accordion multiple defaultValue={['stocktake']}>
      <Accordion.Item value='tracking'>
        <Accordion.Control>
          <StylishText size='lg'>{t`Stock Tracking`}</StylishText>
        </Accordion.Control>
        <Accordion.Panel>
          <StockTrackingTable partId={partId} />
        </Accordion.Panel>
      </Accordion.Item>
      <Accordion.Item value='stocktake'>
        <Accordion.Control>
          <StylishText size='lg'>{t`Stocktake Entries`}</StylishText>
        </Accordion.Control>
        <Accordion.Panel>
          <PartStocktakePanel partId={partId} />
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}
