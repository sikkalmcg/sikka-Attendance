import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'xlsx';

    const headers = [
      'Employee ID',
      'Employee Full Name',
      'Designation',
      'Aadhaar Number',
      'Mobile Number',
      'Attendance Authorization',
      'Status',
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
    
    // Set column widths
    worksheet['!cols'] = [
      { wch: 15 },
      { wch: 22 },
      { wch: 20 },
      { wch: 18 },
      { wch: 16 },
      { wch: 25 },
      { wch: 12 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Employees');

    if (format === 'csv') {
      const csvData = XLSX.utils.sheet_to_csv(worksheet);
      return new NextResponse(csvData, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="employee_upload_template.csv"',
        },
      });
    }

    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="employee_upload_template.xlsx"',
      },
    });
  } catch (error) {
    console.error('Error generating employee template:', error);
    return NextResponse.json({ error: 'Failed to generate template' }, { status: 500 });
  }
}
