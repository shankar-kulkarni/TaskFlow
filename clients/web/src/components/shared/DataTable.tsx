import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useIntl } from 'react-intl';
import { Tooltip } from './Tooltip';
import type {
  DataTableProps,
  Column,
  SortState,
  DataTableHeaderProps,
  DataTableRowProps,
} from './DataTableTypes';

/**
 * DataTableHeader Component
 * Renders the header row with sortable columns and visibility toggles
 */
const DataTableHeader = React.memo(
  function DataTableHeader<T>(props: DataTableHeaderProps<T>) {
    const {
      columns,
      visibleColumns,
      columnTemplate,
      getColumnWidth: _getColumnWidth,
      sort,
      onSort,
      onResizeStart,
      onColumnToggle: _onColumnToggle,
      selectable,
      allSelected,
      someSelected,
      onSelectAll,
      headerControls,
    } = props;
    const intl = useIntl();
    const getSortIndicator = (columnId: string) => {
      if (sort.column !== columnId || sort.direction === 'none') return '\u2195';
      return sort.direction === 'asc' ? '\u2191' : '\u2193';
    };

    const getAriaSort = (columnId: string): React.AriaAttributes['aria-sort'] => {
      if (sort.column !== columnId || sort.direction === 'none') return 'none';
      return sort.direction === 'asc' ? 'ascending' : 'descending';
    };

    return (
      <div className="list-head" style={{ gridTemplateColumns: columnTemplate, display: 'grid', gap: '10px', padding: '6px 14px', minWidth: '100%', width: 'max-content' }}>
        {selectable && (
          <div className="flex items-center">
            <Tooltip content={intl.formatMessage({ id: 'tooltip.dataTable.selectAll' })}>
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => onSelectAll(e.target.checked)}
                ref={(el) => {
                  if (el) {
                    el.indeterminate = someSelected && !allSelected;
                  }
                }}
                className={`cb ${allSelected || someSelected ? 'ck' : ''} cursor-pointer`}
              />
            </Tooltip>
          </div>
        )}
        {columns
          .filter((column) => visibleColumns[column.id])
          .map((column) => {
          const showRightResizeHandle = true;

          if (column.headerContent !== undefined) {
            return (
              <div
                key={column.id}
                data-column-id={column.id}
                className="data-table-cell-head flex items-center px-2 py-1 uppercase text-xs tracking-wider text-[var(--tx-md)] font-medium"
              >
                {column.headerContent}
                {showRightResizeHandle && (
                  <div
                    className="data-table-resize-handle"
                    onMouseDown={(event) => onResizeStart(column.id, event)}
                  />
                )}
              </div>
            );
          }
          
          const headerContent = (
            <div
              key={column.id}
              data-column-id={column.id}
              className={`data-table-cell-head flex items-center px-2 py-1 uppercase text-xs tracking-wider text-[var(--tx-md)] font-medium ${
                column.sortable ? 'cursor-pointer hover:text-[var(--tx-hi)]' : ''
              }`}
              role={column.sortable ? 'button' : undefined}
              tabIndex={column.sortable ? 0 : -1}
              aria-sort={column.sortable ? getAriaSort(column.id) : undefined}
              aria-label={column.sortable ? `${column.label} sort` : undefined}
              onClick={() => column.sortable && onSort(column.id)}
              onKeyDown={(event) => {
                if (!column.sortable) return;
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSort(column.id);
                }
              }}
            >
              <span className="truncate">{column.label}</span>
              {column.sortable && (
                <span className="ml-1 text-xs data-table-sort-indicator" aria-hidden="true">{getSortIndicator(column.id)}</span>
              )}
              {showRightResizeHandle && (
                <div
                  className="data-table-resize-handle"
                  onMouseDown={(event) => onResizeStart(column.id, event)}
                />
              )}
            </div>
          );

          return column.sortable ? (
            <Tooltip key={column.id} content={intl.formatMessage({ id: 'tooltip.dataTable.sort' })} className="tooltip-block">
              {headerContent}
            </Tooltip>
          ) : headerContent;
        })}
        {/* Action column header */}
        <div className="flex items-center justify-end gap-2 px-2 text-[var(--tx-md)] data-table-actions-head">
          <Tooltip content={intl.formatMessage({ id: 'tooltip.dataTable.actions' })}>
            <span className="whitespace-nowrap">{intl.formatMessage({ id: 'dataTable.actions' })}</span>
          </Tooltip>
          {headerControls}
        </div>
      </div>
    );
  }
);

/**
 * DataTableRow Component
 * Renders a single data row with optional selection and inline actions
 */
const DataTableRow = React.memo(
  function DataTableRow<T>(props: DataTableRowProps<T>) {
    const {
      row,
      rowIndex,
      columns,
      visibleColumns,
      columnTemplate,
      rowActions,
      onRowClick,
      rowClassName,
      selectable,
      isSelected,
      onSelectionChange,
    } = props;
    const intl = useIntl();

    const getRowClass = useCallback(() => {
      let cls = 'task-row group border-b border-[var(--border)] transition-colors';
      cls += rowIndex % 2 === 0 ? ' row-even' : ' row-odd';
      if (typeof rowClassName === 'function') {
        cls += ' ' + rowClassName(row);
      } else if (rowClassName) {
        cls += ' ' + rowClassName;
      }
      if (isSelected) {
        cls += ' task-row-selected';
      }
      return cls;
    }, [row, rowClassName, isSelected, rowIndex]);

    const getCellValue = (column: Column<T>) => {
      if (column.accessor) return column.accessor(row);
      return (row as any)[column.id];
    };

    return (
      <div className={`${getRowClass()} grid gap-2.5 px-0 py-2 cursor-pointer`} style={{ gridTemplateColumns: columnTemplate, minWidth: '100%', width: 'max-content' }} onClick={() => onRowClick?.(row, rowIndex)}>
        {selectable && (
          <div className="flex items-center px-2">
            <Tooltip content={intl.formatMessage({ id: 'tooltip.dataTable.selectRow' })}>
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => {
                  e.stopPropagation();
                  onSelectionChange(e.target.checked);
                }}
                onClick={(e) => e.stopPropagation()}
                className={`cb ${isSelected ? 'ck' : ''} cursor-pointer`}
              />
            </Tooltip>
          </div>
        )}
        {columns.map((column) => {
          if (!visibleColumns[column.id]) return null;

          const cellValue = getCellValue(column);
          const rendered = column.render ? column.render(cellValue, row, rowIndex) : cellValue;

          return (
            <div
              key={`${rowIndex}-${column.id}`}
              className="data-table-cell flex items-center px-2 text-sm text-[var(--tx-hi)] truncate"
            >
              {rendered}
            </div>
          );
        })}
        {/* Inline actions */}
        <div className="flex items-center justify-end gap-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {rowActions && rowActions.length > 0 && (
            rowActions.map((action) => {
              const isDisabled = action.disabled?.(row);
              const buttonClass = `row-menu text-xs font-medium transition-colors ${
                isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              } ${
                action.variant === 'danger'
                  ? 'hover:bg-rose-900/20 hover:text-white text-rose-400'
                  : action.variant === 'secondary'
                  ? 'hover:bg-[var(--s3)] text-[var(--tx-md)]'
                  : 'hover:bg-[var(--lime)] hover:text-black text-[var(--lime)]'
              }`;

              return (
                <Tooltip key={action.id} content={action.label}>
                  <button
                    className={buttonClass}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isDisabled) {
                        action.onClick(row, rowIndex);
                      }
                    }}
                    disabled={isDisabled}
                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: 'var(--r)' }}
                  >
                    {action.icon || action.label}
                  </button>
                </Tooltip>
              );
            })
          )}
        </div>
      </div>
    );
  }
);

/**
 * DataTable Component
 * Main reusable data table with sorting, searching, filtering, and pagination
 */
function DataTableInner<T>(props: DataTableProps<T>) {
    const {
      data,
      columns,
      tableId = 'default-table',
      sort: externalSort,
      currentPage: externalPage,
      itemsPerPage: externalItemsPerPage = 10,
      visibleColumns: externalVisibleColumns,
      searchTerm: externalSearchTerm = '',
      onConfigChange,
      onRowClick,
      rowActions,
      isLoading = false,
      emptyMessage,
      rowClassName,
      selectable = false,
      selectedRowIds: externalSelectedRowIds,
      onSelectionChange,
      headerControls,
    } = props;
    const intl = useIntl();

    // Initialize localStorage key
    const storageKey = `taskflow.dataTable.${tableId}`;

    // Normalize data: convert Record to array
    const normalizedData = useMemo(() => {
      if (Array.isArray(data)) return data;
      return Object.values(data);
    }, [data]);

    // Initialize visible columns from props or localStorage
    const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
      if (externalVisibleColumns) return externalVisibleColumns;
      
      try {
        const stored = localStorage.getItem(`${storageKey}.columns`);
        if (stored) return JSON.parse(stored);
      } catch {
        // Silently ignore
      }

      // Default: all columns visible
      return columns.reduce((acc, col) => {
        acc[col.id] = col.visible !== false;
        return acc;
      }, {} as Record<string, boolean>);
    });

    useEffect(() => {
      if (externalVisibleColumns) {
        setVisibleColumns(externalVisibleColumns);
      }
    }, [externalVisibleColumns]);

    // Initialize sort state
    const [sort, setSort] = useState<SortState>(() => {
      if (externalSort) return externalSort;

      try {
        const stored = localStorage.getItem(`${storageKey}.sort`);
        if (stored) return JSON.parse(stored);
      } catch {
        // Silently ignore
      }

      return { column: null, direction: 'none' };
    });

    // Initialize pagination
    const [currentPage, setCurrentPage] = useState(externalPage ?? 0);
    const [itemsPerPage, setItemsPerPage] = useState(externalItemsPerPage);
    const [searchTerm, setSearchTerm] = useState(externalSearchTerm);
    const [columnWidths, setColumnWidths] = useState<Record<string, string>>(() => {
      try {
        const stored = localStorage.getItem(`${storageKey}.widths`);
        if (stored) return JSON.parse(stored);
      } catch {
        // Silently ignore
      }
      return {};
    });
    const [resizing, setResizing] = useState<{ columnId: string; startX: number; startWidth: number } | null>(null);

    // Initialize selection
    const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(
      externalSelectedRowIds ?? new Set()
    );

    useEffect(() => {
      if (externalSelectedRowIds) {
        setSelectedRowIds(externalSelectedRowIds);
      }
    }, [externalSelectedRowIds]);

    // Persist visible columns to localStorage
    useEffect(() => {
      try {
        localStorage.setItem(`${storageKey}.columns`, JSON.stringify(visibleColumns));
      } catch {
        // Silently ignore
      }
    }, [visibleColumns, storageKey]);

    // Persist sort state to localStorage
    useEffect(() => {
      try {
        localStorage.setItem(`${storageKey}.sort`, JSON.stringify(sort));
      } catch {
        // Silently ignore
      }
    }, [sort, storageKey]);
    useEffect(() => {
      try {
        localStorage.setItem(`${storageKey}.widths`, JSON.stringify(columnWidths));
      } catch {
        // Silently ignore
      }
    }, [columnWidths, storageKey]);

    // Notify parent of config changes
    useEffect(() => {
      onConfigChange?.({
        sort,
        currentPage,
        itemsPerPage,
        visibleColumns,
      });
    }, [sort, currentPage, itemsPerPage, visibleColumns, onConfigChange]);

    // Filter data by search term
    const filteredData = useMemo(() => {
      if (!searchTerm) return normalizedData;

      const searchLower = searchTerm.toLowerCase();
      const searchableColumns = columns.filter((col) => col.searchable);

      return normalizedData.filter((row) => {
        return searchableColumns.some((col) => {
          const value = col.accessor ? col.accessor(row) : (row as any)[col.id];
          const stringValue = String(value || '').toLowerCase();
          return stringValue.includes(searchLower);
        });
      });
    }, [normalizedData, searchTerm, columns]);

    // Sort data
    const sortedData = useMemo(() => {
      if (!sort.column || sort.column === null) return filteredData;

      const column = columns.find((col) => col.id === sort.column);
      if (!column) return filteredData;

      return [...filteredData].sort((a, b) => {
        const aValue = column.accessor ? column.accessor(a) : (a as any)[sort.column!];
        const bValue = column.accessor ? column.accessor(b) : (b as any)[sort.column!];

        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return 1;
        if (bValue == null) return -1;

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sort.direction === 'asc'
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sort.direction === 'asc' ? aValue - bValue : bValue - aValue;
        }

        if (aValue instanceof Date && bValue instanceof Date) {
          return sort.direction === 'asc'
            ? aValue.getTime() - bValue.getTime()
            : bValue.getTime() - aValue.getTime();
        }

        const aStr = String(aValue);
        const bStr = String(bValue);
        return sort.direction === 'asc'
          ? aStr.localeCompare(bStr)
          : bStr.localeCompare(aStr);
      });
    }, [filteredData, sort, columns]);

    // Paginate data
    const paginatedData = useMemo(() => {
      const start = currentPage * itemsPerPage;
      const end = start + itemsPerPage;
      return sortedData.slice(start, end);
    }, [sortedData, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(sortedData.length / itemsPerPage);

    // Handle column toggle
    const handleColumnToggle = useCallback((columnId: string) => {
      setVisibleColumns((prev) => ({
        ...prev,
        [columnId]: !prev[columnId],
      }));
    }, []);
    const [showColumnPicker, setShowColumnPicker] = useState(false);
    const pickerRef = useRef<HTMLDivElement | null>(null);
    const toggleableColumns = useMemo(
      () => columns.filter((column) => column.headerContent === undefined),
      [columns]
    );
    useEffect(() => {
      if (!showColumnPicker) return;
      const handlePointerDown = (event: MouseEvent) => {
        if (!pickerRef.current) return;
        if (!pickerRef.current.contains(event.target as Node)) {
          setShowColumnPicker(false);
        }
      };
      document.addEventListener('mousedown', handlePointerDown);
      return () => document.removeEventListener('mousedown', handlePointerDown);
    }, [showColumnPicker]);

    // Handle sort
    const handleSort = useCallback((columnId: string) => {
      setSort((prev) => {
        if (prev.column === columnId) {
          if (prev.direction === 'none') {
            return { column: columnId, direction: 'asc' };
          }
          if (prev.direction === 'asc') {
            return { column: columnId, direction: 'desc' };
          }
          return {
            column: null,
            direction: 'none',
          };
        }
        return { column: columnId, direction: 'asc' };
      });
      setCurrentPage(0);
    }, []);
    const getColumnWidth = useCallback(
      (columnId: string) => columnWidths[columnId] || columns.find((column) => column.id === columnId)?.width || '1fr',
      [columnWidths, columns]
    );
    const columnTemplate = useMemo(
      () =>
        `${columns
          .filter((column) => visibleColumns[column.id])
          .map((column) => getColumnWidth(column.id))
          .join(' ')} minmax(96px, max-content)`,
      [columns, getColumnWidth, visibleColumns]
    );
    const handleResizeStart = useCallback((columnId: string, event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const cell = event.currentTarget.parentElement as HTMLDivElement | null;
      const startWidth = cell?.getBoundingClientRect().width ?? 140;
      const headerRow = cell?.parentElement as HTMLElement | null;
      if (headerRow) {
        const frozenWidths: Record<string, string> = {};
        headerRow.querySelectorAll<HTMLElement>('[data-column-id]').forEach((el) => {
          const id = el.dataset.columnId;
          if (!id) return;
          frozenWidths[id] = `${Math.round(el.getBoundingClientRect().width)}px`;
        });
        if (Object.keys(frozenWidths).length > 0) {
          setColumnWidths((prev) => ({ ...prev, ...frozenWidths }));
        }
      }
      setResizing({ columnId, startX: event.clientX, startWidth });
    }, []);
    useEffect(() => {
      if (!resizing) return;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      const onMouseMove = (event: MouseEvent) => {
        const delta = event.clientX - resizing.startX;
        const nextWidth = Math.max(90, Math.round(resizing.startWidth + delta));
        setColumnWidths((prev) => ({ ...prev, [resizing.columnId]: `${nextWidth}px` }));
      };
      const onMouseUp = () => setResizing(null);
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      return () => {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };
    }, [resizing]);

    // Handle page change
    const handlePageChange = useCallback((page: number) => {
      if (page >= 0 && page < totalPages) {
        setCurrentPage(page);
      }
    }, [totalPages]);

    // Handle items per page change
    const handleItemsPerPageChange = useCallback((count: number) => {
      setItemsPerPage(count);
      setCurrentPage(0);
    }, []);

    // Handle row selection
    const handleRowSelect = useCallback((rowId: string, selected: boolean) => {
      setSelectedRowIds((prev) => {
        const newSet = new Set(prev);
        if (selected) {
          newSet.add(rowId);
        } else {
          newSet.delete(rowId);
        }
        onSelectionChange?.(newSet);
        return newSet;
      });
    }, [onSelectionChange]);

    // Handle select all
    const handleSelectAll = useCallback((selected: boolean) => {
      if (selected) {
        const newSet = new Set(selectedRowIds);
        paginatedData.forEach((row) => {
          const rowId = (row as any).id || String(paginatedData.indexOf(row));
          newSet.add(rowId);
        });
        setSelectedRowIds(newSet);
        onSelectionChange?.(newSet);
      } else {
        setSelectedRowIds(new Set());
        onSelectionChange?.(new Set());
      }
    }, [paginatedData, selectedRowIds, onSelectionChange]);

    // Check if all rows on current page are selected
    const allSelected = useMemo(() => {
      if (paginatedData.length === 0) return false;
      return paginatedData.every((row) => {
        const rowId = (row as any).id || String(paginatedData.indexOf(row));
        return selectedRowIds.has(rowId);
      });
    }, [paginatedData, selectedRowIds]);

    // Check if some rows on current page are selected
    const someSelected = useMemo(() => {
      return (
        !allSelected &&
        paginatedData.some((row) => {
          const rowId = (row as any).id || String(paginatedData.indexOf(row));
          return selectedRowIds.has(rowId);
        })
      );
    }, [allSelected, paginatedData, selectedRowIds]);

    return (
      <div className={`data-table-container ${resizing ? 'is-resizing' : ''}`}>
        <div className="data-table-search">
          <div className="data-table-search-row">
            <Tooltip
              content={intl.formatMessage({ id: 'tooltip.dataTable.search' })}
              className="tooltip-block"
              placement="bottom"
            >
              <input
                type="text"
                placeholder={intl.formatMessage({ id: 'dataTable.searchPlaceholder' })}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(0);
                }}
              />
            </Tooltip>
            <div className="data-table-actions-head" ref={pickerRef}>
              <button
                type="button"
                className="data-table-gear-btn"
                aria-label={intl.formatMessage({ id: 'dataTable.columns', defaultMessage: 'Columns' })}
                title={intl.formatMessage({ id: 'dataTable.columns', defaultMessage: 'Columns' })}
                onClick={() => setShowColumnPicker((prev) => !prev)}
              >
                {'\u2699'}
              </button>
              {showColumnPicker && (
                <div className="data-column-picker" tabIndex={-1} role="dialog" aria-label="Column picker">
                  <div className="data-column-picker-head">
                    <span className="data-column-picker-title">Visible columns</span>
                    <button
                      type="button"
                      className="data-column-picker-close"
                      onClick={() => setShowColumnPicker(false)}
                      aria-label="Close columns panel"
                    >
                      ×
                    </button>
                  </div>
                  <div className="data-column-picker-list">
                    {toggleableColumns.map((column) => (
                      <label key={column.id} className="data-column-picker-item">
                        <input
                          className="data-column-picker-checkbox"
                          type="checkbox"
                          checked={Boolean(visibleColumns[column.id])}
                          onChange={() => handleColumnToggle(column.id)}
                        />
                        <span className="data-column-picker-label">{column.label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="data-column-picker-actions">
                    <button
                      type="button"
                      className="data-column-picker-btn"
                      onClick={() =>
                        setVisibleColumns((prev) =>
                          toggleableColumns.reduce((acc, column) => ({ ...acc, [column.id]: true }), { ...prev })
                        )
                      }
                    >
                      Show all
                    </button>
                    <button
                      type="button"
                      className="data-column-picker-btn"
                      onClick={() =>
                        setVisibleColumns((prev) =>
                          toggleableColumns.reduce((acc, column) => ({ ...acc, [column.id]: false }), { ...prev })
                        )
                      }
                    >
                      Hide all
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="data-table-body">
          <div className="list w-full data-table-list">
            {isLoading ? (
              <div className="flex items-center justify-center h-64 text-[var(--tx-md)]">
                {intl.formatMessage({ id: 'dataTable.loading' })}
              </div>
            ) : paginatedData.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-[var(--tx-md)]">
                {emptyMessage || intl.formatMessage({ id: 'dataTable.empty' })}
              </div>
            ) : (
              <>
                <DataTableHeader
                  columns={columns as any}
                  visibleColumns={visibleColumns}
                  columnTemplate={columnTemplate}
                  getColumnWidth={getColumnWidth}
                  sort={sort}
                  onSort={handleSort}
                  onResizeStart={handleResizeStart}
                  onColumnToggle={handleColumnToggle}
                  selectable={selectable}
                  allSelected={allSelected}
                  someSelected={someSelected}
                  onSelectAll={handleSelectAll}
                  headerControls={headerControls}
                />
                {paginatedData.map((row, index) => {
                  const rowId = (row as any).id || String(currentPage * itemsPerPage + index);
                  return (
                    <DataTableRow
                      key={rowId}
                      row={row}
                      rowIndex={currentPage * itemsPerPage + index}
                      columns={columns as any}
                      visibleColumns={visibleColumns}
                      columnTemplate={columnTemplate}
                      rowActions={rowActions as any}
                      onRowClick={onRowClick as any}
                      rowClassName={rowClassName as any}
                      selectable={selectable}
                      isSelected={selectedRowIds.has(rowId)}
                      onSelectionChange={(selected) => handleRowSelect(rowId, selected)}
                    />
                  );
                })}
              </>
            )}
          </div>
        </div>

        {paginatedData.length > 0 && (
          <div className="data-table-footer">
            <div className="flex items-center gap-2">
              <label className="text-[var(--tx-md)]">{intl.formatMessage({ id: 'dataTable.itemsPerPage' })}</label>
              <Tooltip content={intl.formatMessage({ id: 'tooltip.dataTable.itemsPerPage' })} placement="top">
                <select value={itemsPerPage} onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}>
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </Tooltip>
            </div>

            <div className="text-[var(--tx-md)]">
              {intl.formatMessage(
                { id: 'dataTable.pageSummary' },
                { page: currentPage + 1, totalPages, totalItems: sortedData.length }
              )}
            </div>

            <div className="data-table-pagination">
              <Tooltip content={intl.formatMessage({ id: 'tooltip.dataTable.previous' })}>
                <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 0}>
                  {intl.formatMessage({ id: 'dataTable.previous' })}
                </button>
              </Tooltip>
              <Tooltip content={intl.formatMessage({ id: 'tooltip.dataTable.next' })}>
                <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages - 1}>
                  {intl.formatMessage({ id: 'dataTable.next' })}
                </button>
              </Tooltip>
            </div>
          </div>
        )}
      </div>
    );
  }

const DataTable = React.memo(DataTableInner) as <T>(props: DataTableProps<T>) => React.ReactElement;

(DataTable as { displayName?: string }).displayName = 'DataTable';

export { DataTable };



