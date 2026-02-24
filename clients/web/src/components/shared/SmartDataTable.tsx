import React from 'react';
import { DataTable } from './DataTable';
import type { DataTableProps } from './DataTableTypes';

export interface SmartDataTableProps<T = any> extends DataTableProps<T> {
  alternateRows?: boolean;
}

function SmartDataTableInner<T>(props: SmartDataTableProps<T>) {
  const { alternateRows: _alternateRows = true, ...tableProps } = props;
  void _alternateRows;
  return <DataTable<T> {...tableProps} />;
}

const SmartDataTable = React.memo(SmartDataTableInner) as <T>(props: SmartDataTableProps<T>) => React.ReactElement;

(SmartDataTable as { displayName?: string }).displayName = 'SmartDataTable';

export { SmartDataTable };
