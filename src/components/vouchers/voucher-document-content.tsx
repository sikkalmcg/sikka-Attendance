import React from 'react';
import { cn, formatDate, formatCurrency, numberToIndianWords } from '@/lib/utils';
import { Building2, Info } from 'lucide-react';

export function VoucherDocumentContent({ voucher, employees, firms, plants, isPrintMode = false }: any) {
  const employee = employees?.find((e: any) => e.id === voucher.employeeId);
  const firm = firms?.find((f: any) => f.id === (employee?.firmId || voucher.firmId));
  const amountInWords = numberToIndianWords(voucher.amount);

  return (
    <div className={cn(
      "w-[210mm] min-h-[297mm] bg-white p-[15mm] flex flex-col font-calibri text-slate-900",
      !isPrintMode && "shadow-2xl mx-auto border border-slate-200"
    )}>
      {/* Top Header */}
      <div className="flex justify-between items-start border-b-4 border-slate-900 pb-8 mb-10">
        <div className="flex-1 space-y-4">
          {firm?.logo ? (
            <div className="w-32 h-20 relative">
              <img src={firm.logo} alt="Firm Logo" className="object-contain w-full h-full object-left" />
            </div>
          ) : (
            <div className="w-32 h-20 bg-slate-100 flex items-center justify-center rounded-lg border-2 border-dashed border-slate-200">
               <Building2 className="w-8 h-8 text-slate-300" />
            </div>
          )}
          <div className="space-y-1">
            <h2 className="text-2xl font-black uppercase text-slate-900 leading-tight">{firm?.name}</h2>
            <p className="text-[11px] font-bold text-slate-600 uppercase max-w-[300px] leading-relaxed">{firm?.registeredAddress}</p>
            <div className="flex flex-col gap-0.5 text-[11px] font-black uppercase text-slate-500 mt-2">
               <span>GSTIN: {firm?.gstin}</span>
               <span>PAN: {firm?.pan}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 text-center flex flex-col items-center pt-10">
          <div className="border-2 border-slate-900 px-4 py-1.5 bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
            <h1 className="text-base font-black tracking-tighter uppercase">PAYMENT VOUCHER</h1>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-end space-y-4 text-right pt-2">
           <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Voucher Number</p>
              <p className="text-xl font-black font-mono text-blue-600">{voucher.voucherNo}</p>
           </div>
           <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Voucher Date</p>
              <p className="text-sm font-black">{formatDate(voucher.date)}</p>
           </div>
           <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Created By</p>
              <p className="text-[11px] font-bold uppercase">{voucher.createdByName || "SYSTEM"}</p>
           </div>
           {voucher.approvedByName && (
             <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Approved By</p>
                <p className="text-[11px] font-bold uppercase text-emerald-600">{voucher.approvedByName}</p>
             </div>
           )}
        </div>
      </div>

      {/* Employee Identity Section */}
      <div className="mb-12">
        <div className="flex items-center gap-3 mb-4">
           <div className="h-6 w-1.5 bg-slate-900 rounded-full" />
           <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Employee Identity</h3>
        </div>
        <table className="w-full border-collapse border-2 border-slate-900 text-left">
          <tbody>
            <tr>
              <th className="border-2 border-slate-900 p-4 w-1/4 bg-slate-50 text-[10px] font-black uppercase text-slate-500">Employee Name / ID</th>
              <td className="border-2 border-slate-900 p-4 w-1/4 font-black uppercase text-sm">{employee?.name} / {employee?.employeeId}</td>
              <th className="border-2 border-slate-900 p-4 w-1/4 bg-slate-50 text-[10px] font-black uppercase text-slate-500">Plant Location</th>
              <td className="border-2 border-slate-900 p-4 w-1/4 font-bold uppercase text-xs">
                {employee?.unitIds?.map((id:string) => plants?.find((p:any) => p.id === id)?.name).filter(Boolean).join(", ") || "UNASSIGNED"}
              </td>
            </tr>
            <tr>
              <th className="border-2 border-slate-900 p-4 bg-slate-50 text-[10px] font-black uppercase text-slate-500">Department / Designation</th>
              <td className="border-2 border-slate-900 p-4 font-bold uppercase text-xs leading-tight">
                {employee?.department} <br/> <span className="text-[10px] text-slate-400">{employee?.designation}</span>
              </td>
              <th className="border-2 border-slate-900 p-4 bg-slate-50 text-[10px] font-black uppercase text-slate-500">Aadhar Number</th>
              <td className="border-2 border-slate-900 p-4 font-mono font-bold text-sm tracking-widest">{employee?.aadhaar}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Voucher Details Section */}
      <div className="mb-14">
        <div className="flex items-center gap-3 mb-4">
           <div className="h-6 w-1.5 bg-slate-900 rounded-full" />
           <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Voucher Details</h3>
        </div>
        <table className="w-full border-collapse border-2 border-slate-900 text-left">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="border-2 border-slate-900 p-1 text-[10px] font-black uppercase tracking-widest w-2/3">Description / Purpose</th>
              <th className="border-2 border-slate-900 p-1 text-[10px] font-black uppercase tracking-widest text-right w-1/3">Amount (INR)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="h-10">
              <td className="border-2 border-slate-900 p-1.5 align-top">
                 <p className="font-black text-slate-800 text-lg uppercase leading-tight tracking-tight">{voucher.purpose}</p>
                 <p className="text-[10px] font-bold text-slate-400 mt-2 italic uppercase">Authorized Advance Payment</p>
              </td>
              <td className="border-2 border-slate-900 p-1.5 align-top text-right bg-slate-50/50">
                 <p className="text-4xl font-black text-slate-900 tracking-tighter">{formatCurrency(voucher.amount)}</p>
              </td>
            </tr>
            <tr className="bg-slate-100/50">
              <td colSpan={2} className="border-2 border-slate-900 p-1.5">
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Amount in Words</span>
                  <span className="text-lg font-black uppercase tracking-tight italic decoration-slate-300 underline underline-offset-8 leading-tight">
                    {amountInWords}
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Terms & Conditions Section */}
      <div className="mb-24 space-y-3 px-2">
        <div className="flex items-center gap-2">
           <Info className="w-3.5 h-3.5 text-slate-400" />
           <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Terms & Conditions</h4>
        </div>
        <p className="text-[10px] font-bold text-slate-500 italic leading-relaxed text-justify">
          Advance payment issued to employee shall be recovered in favor of the firm as per company policy, either through salary adjustment or direct reimbursement. 
          By accepting this payment, the employee agrees to the deduction of this amount from their future payroll cycles.
        </p>
      </div>

      {/* Signature Section */}
      <div className="mt-auto grid grid-cols-2 gap-24 pt-16 border-t border-slate-100">
        <div className="flex flex-col items-center gap-6">
          <div className="w-full h-[1px] bg-slate-200" />
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">Receiver Signature</p>
        </div>
        <div className="flex flex-col items-center gap-6">
          <div className="w-full h-[1px] bg-slate-200" />
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">Authorized Signature</p>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="mt-16 text-center border-t border-slate-50 pt-6">
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.4em] leading-none mb-2">
          Sikka HRMS
        </p>
        <p className="text-[8px] font-medium text-slate-300 uppercase tracking-widest">
          This voucher is generated digitally and it is valid as an original document.
        </p>
      </div>
    </div>
  );
}
