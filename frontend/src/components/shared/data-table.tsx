"use client"

import * as React from "react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export interface DataTableColumn<TData> {
  /**
   * Unique key for the column. Use accessor key or any stable identifier.
   */
  key: React.Key
  /**
   * Header label/content.
   */
  header: React.ReactNode
  /**
   * Cell renderer. Receives the row item and index.
   */
  cell: (row: TData, index: number) => React.ReactNode
  /**
   * Optional class name for table header and cells in this column.
   */
  className?: string
  headerClassName?: string
}

export interface DataTableProps<TData> {
  columns: DataTableColumn<TData>[]
  data: TData[]
  /**
   * Display skeleton rows when true.
   */
  loading?: boolean
  /**
   * Message shown when data array is empty (and not loading).
   */
  emptyMessage?: React.ReactNode
  /**
   * Number of skeleton rows to show in loading state.
   */
  skeletonRowCount?: number
  /**
   * Function to generate stable row keys.
   */
  rowKey?: (row: TData, index: number) => React.Key
  /**
   * Provide extra className for each row.
   */
  rowClassName?: (row: TData, index: number) => string | undefined
  /**
   * Optional caption below the table.
   */
  caption?: React.ReactNode
  className?: string
}

export function DataTable<TData>({
  columns,
  data,
  loading = false,
  emptyMessage = "No results found.",
  skeletonRowCount = 5,
  rowKey,
  rowClassName,
  caption,
  className,
}: DataTableProps<TData>) {
  const renderSkeletonRows = React.useCallback(() => {
    return Array.from({ length: skeletonRowCount }).map((_, index) => (
      <TableRow key={`skeleton-${index}`} className="animate-pulse">
        {columns.map((column) => (
          <TableCell key={column.key} className={column.className}>
            <Skeleton className="h-4 w-full" />
          </TableCell>
        ))}
      </TableRow>
    ))
  }, [columns, skeletonRowCount])

  const renderEmptyState = React.useCallback(() => {
    return (
      <TableRow>
        <TableCell colSpan={columns.length} className="py-10 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </TableCell>
      </TableRow>
    )
  }, [columns.length, emptyMessage])

  return (
    <div className={cn("rounded-xl border border-border bg-card", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.key} className={cn("whitespace-nowrap", column.headerClassName ?? column.className)}>
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading
            ? renderSkeletonRows()
            : data.length === 0
              ? renderEmptyState()
              : data.map((row, index) => (
                  <TableRow
                    key={(rowKey?.(row, index) ?? index) as React.Key}
                    className={rowClassName?.(row, index)}
                  >
                    {columns.map((column) => (
                      <TableCell key={column.key} className={column.className}>
                        {column.cell(row, index)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
        </TableBody>
      </Table>
      {caption ? (
        <div className="border-t border-border/80 bg-muted/10 px-4 py-2 text-sm text-muted-foreground">{caption}</div>
      ) : null}
    </div>
  )
}

