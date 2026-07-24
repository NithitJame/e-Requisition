import React from 'react';
import DataTable, { TableColumn } from 'react-data-table-component';

// กำหนด Props รับค่าแบบ Generic (ตัว T) เพื่อให้รองรับข้อมูลได้ทุกรูปแบบ
interface IMyDataTableProps<T> {
    columns: TableColumn<T>[];
    data: T[];
    isPagination: boolean;
}

// const customStyles = {
//     tableWrapper: {
//         style: {
//             overflow: 'visible',
//         },
//     },
//     responsiveWrapper: {
//         style: {
//             overflow: 'visible',
//         },
//     },
//     rows: {
//         style: {
//             overflow: 'visible', // อนุญาตให้ Dropdown ล้นแถวออกมาได้
//         },
//     },
//     cells: {
//         style: {
//             overflow: 'visible', // อนุญาตให้ Dropdown ล้นเซลล์ออกมาได้
//         },
//     },
// };

// ใช้ Generic <T> เพื่อให้ TypeScript รู้จักหน้าตาข้อมูล
function MyDataTable<T>({ columns, data, isPagination }: IMyDataTableProps<T>) {
    return (
        <div className="border rounded shadow-sm bg-white">
            <DataTable
                columns={columns}
                data={data}
                {...isPagination ? {
                    pagination: true,
                    paginationPerPage: 10,
                    paginationRowsPerPageOptions: [10, 20, 50, 100]
                } : {
                    pagination: false
                }}
                highlightOnHover // ไฮไลต์สีเวลาเอาเมาส์ชี้แถว
                responsive={true}
            // customStyles={customStyles}
            />
        </div>
    );
}

export default MyDataTable;