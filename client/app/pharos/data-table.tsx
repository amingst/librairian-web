'use client';

import {
	ColumnDef,
	flexRender,
	getCoreRowModel,
	useReactTable,
	getPaginationRowModel,
} from '@tanstack/react-table';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';

import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from '@/components/ui/pagination';

import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';

interface DataTableProps<TData, TValue> {
	columns: ColumnDef<TData, TValue>[];
	data: TData[];
}

export function DataTable<TData, TValue>({
	columns,
	data,
}: DataTableProps<TData, TValue>) {
	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		initialState: {
			pagination: {
				pageSize: 10,
			},
		},
	});

	return (
		<>
			{' '}
			<div className='overflow-x-auto rounded-md border'>
				<Table className='table-fixed w-full'>
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header) => {
									const size = header.column.columnDef.size;
									return (
										<TableHead
											key={header.id}
											style={{
												width: size
													? `${size}px`
													: 'auto',
											}}
											className='px-2'
										>
											{header.isPlaceholder
												? null
												: flexRender(
														header.column.columnDef
															.header,
														header.getContext()
												  )}
										</TableHead>
									);
								})}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{table.getRowModel().rows?.length ? (
							table.getRowModel().rows.map((row) => (
								<TableRow
									key={row.id}
									data-state={
										row.getIsSelected() && 'selected'
									}
								>
									{row.getVisibleCells().map((cell) => {
										const size = cell.column.columnDef.size;
										return (
											<TableCell
												key={cell.id}
												style={{
													width: size
														? `${size}px`
														: 'auto',
												}}
												className='px-2'
											>
												{flexRender(
													cell.column.columnDef.cell,
													cell.getContext()
												)}
											</TableCell>
										);
									})}
								</TableRow>
							))
						) : (
							<TableRow>
								<TableCell
									colSpan={columns.length}
									className='h-24 text-center'
								>
									No results.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>
			<div className='flex items-center justify-between space-x-2 py-4'>
				<div className='flex items-center space-x-4'>
					<Select
						value={table.getState().pagination.pageSize.toString()}
						onValueChange={(value) => {
							table.setPageSize(Number(value));
						}}
					>
						<SelectTrigger className='w-[180px]'>
							<SelectValue placeholder='Items Per Page' />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='10'>10 per page</SelectItem>
							<SelectItem value='20'>20 per page</SelectItem>
							<SelectItem value='30'>30 per page</SelectItem>
							<SelectItem value='50'>50 per page</SelectItem>
							<SelectItem value='100'>100 per page</SelectItem>
						</SelectContent>
					</Select>
					<div className='text-sm text-muted-foreground'>
						Showing {table.getRowModel().rows.length} of{' '}
						{data.length} row(s)
					</div>
				</div>
				<Pagination>
					<PaginationContent>
						<PaginationItem>
							<PaginationPrevious
								onClick={() => table.previousPage()}
								className={
									!table.getCanPreviousPage()
										? 'pointer-events-none opacity-50'
										: 'cursor-pointer'
								}
							/>
						</PaginationItem>

						{/* Show page numbers */}
						{Array.from(
							{ length: table.getPageCount() },
							(_, i) => i + 1
						)
							.filter((pageNum) => {
								const currentPage =
									table.getState().pagination.pageIndex + 1;
								// Show first page, last page, current page, and adjacent pages
								return (
									pageNum === 1 ||
									pageNum === table.getPageCount() ||
									Math.abs(pageNum - currentPage) <= 1
								);
							})
							.map((pageNum, index, visiblePages) => {
								const currentPage =
									table.getState().pagination.pageIndex + 1;
								const prevPageNum = visiblePages[index - 1];

								return (
									<div
										key={pageNum}
										className='flex items-center'
									>
										{/* Add ellipsis if there's a gap */}
										{prevPageNum &&
											pageNum - prevPageNum > 1 && (
												<PaginationItem>
													<PaginationEllipsis />
												</PaginationItem>
											)}
										<PaginationItem>
											<PaginationLink
												onClick={() =>
													table.setPageIndex(
														pageNum - 1
													)
												}
												isActive={
													pageNum === currentPage
												}
												className='cursor-pointer'
											>
												{pageNum}
											</PaginationLink>
										</PaginationItem>
									</div>
								);
							})}

						<PaginationItem>
							<PaginationNext
								onClick={() => table.nextPage()}
								className={
									!table.getCanNextPage()
										? 'pointer-events-none opacity-50'
										: 'cursor-pointer'
								}
							/>
						</PaginationItem>
					</PaginationContent>
				</Pagination>
			</div>
		</>
	);
}
