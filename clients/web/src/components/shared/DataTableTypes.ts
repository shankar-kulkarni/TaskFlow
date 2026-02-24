/**
 * DataTable Component Types
 * 
 * Defines the interface for a flexible, configurable data table with sorting,
 * searching, filtering, and pagination capabilities.
 */

/**
 * Defines a single column in the DataTable
 */
export interface Column<T = any> {
  /** Unique identifier for the column */
  id: string;
  
  /** Display label for the column header */
  label: string;
  
  /** Whether this column supports sorting */
  sortable?: boolean;
  
  /** Whether this column supports search/filtering */
  searchable?: boolean;
  
  /** Whether this column is visible by default */
  visible?: boolean;
  
  /** Custom width for the column (CSS value, e.g., "200px", "1fr") */
  width?: string;
  
  /** Custom render function for cell content */
  render?: (value: any, row: T, rowIndex: number) => React.ReactNode;
  
  /** Optional accessor function to get value from row object */
  accessor?: (row: T) => any;
  
  /** Whether column visibility is role-aware (admin sees all, others see subset) */
  roleRestricted?: boolean;

  /** Optional custom header content (replaces default label/sort UI when provided) */
  headerContent?: React.ReactNode;
}

/**
 * Represents the current sort state
 */
export interface SortState {
  column: string | null;
  direction: 'none' | 'asc' | 'desc';
}

/**
 * Configuration state for DataTable behavior
 */
export interface DataTableConfig {
  sort: SortState;
  currentPage: number;
  itemsPerPage: number;
  visibleColumns: Record<string, boolean>;
}

/**
 * Action that can be performed on a table row
 */
export interface RowAction<T = any> {
  /** Unique identifier for the action */
  id: string;
  
  /** Display label for the action button */
  label: string;
  
  /** Icon class or text (e.g., "edit", "trash") */
  icon?: string;
  
  /** Callback when action is clicked */
  onClick: (row: T, rowIndex: number) => void;
  
  /** Optional styling variant (e.g., "primary", "danger") */
  variant?: 'primary' | 'danger' | 'secondary';
  
  /** Whether action should be disabled for this row */
  disabled?: (row: T) => boolean;
}

/**
 * Props for the DataTable component
 */
export interface DataTableProps<T = any> {
  /** Table data - supports both array and Record<id, T> formats */
  data: T[] | Record<string, T>;
  
  /** Column definitions */
  columns: Column<T>[];
  
  /** Unique table identifier (used for localStorage keys) */
  tableId?: string;
  
  /** Current sort state */
  sort?: SortState;
  
  /** Current page (0-indexed) */
  currentPage?: number;
  
  /** Items to display per page */
  itemsPerPage?: number;
  
  /** Currently visible columns */
  visibleColumns?: Record<string, boolean>;
  
  /** Search/filter term */
  searchTerm?: string;
  
  /** Callback when configuration changes (sort, page, visible columns) */
  onConfigChange?: (config: DataTableConfig) => void;
  
  /** Callback when row is clicked */
  onRowClick?: (row: T, rowIndex: number) => void;
  
  /** Row action buttons */
  rowActions?: RowAction<T>[];
  
  /** Optional loading state */
  isLoading?: boolean;
  
  /** Custom message for empty state */
  emptyMessage?: string;
  
  /** CSS class for individual rows */
  rowClassName?: string | ((row: T) => string);
  
  /** Allow row selection with checkboxes */
  selectable?: boolean;
  
  /** Currently selected row IDs */
  selectedRowIds?: Set<string>;
  
  /** Callback when rows are selected/deselected */
  onSelectionChange?: (rowIds: Set<string>) => void;

  /** Optional controls rendered in the table header actions area */
  headerControls?: React.ReactNode;
}

/**
 * Props for DataTableHeader sub-component
 */
export interface DataTableHeaderProps<T = any> {
  columns: Column<T>[];
  visibleColumns: Record<string, boolean>;
  columnTemplate: string;
  getColumnWidth: (columnId: string) => string;
  sort: SortState;
  onSort: (columnId: string) => void;
  onResizeStart: (columnId: string, event: React.MouseEvent<HTMLDivElement>) => void;
  onColumnToggle: (columnId: string) => void;
  selectable: boolean;
  allSelected: boolean;
  someSelected: boolean;
  onSelectAll: (selected: boolean) => void;
  headerControls?: React.ReactNode;
}

/**
 * Props for DataTableRow sub-component
 */
export interface DataTableRowProps<T = any> {
  row: T;
  rowIndex: number;
  columns: Column<T>[];
  visibleColumns: Record<string, boolean>;
  columnTemplate: string;
  rowActions?: RowAction<T>[];
  onRowClick?: (row: T, rowIndex: number) => void;
  rowClassName?: string | ((row: T) => string);
  selectable: boolean;
  isSelected: boolean;
  onSelectionChange: (selected: boolean) => void;
}

/**
 * Internal state for DataTable component
 */
export interface DataTableState extends DataTableConfig {
  searchTerm: string;
}
