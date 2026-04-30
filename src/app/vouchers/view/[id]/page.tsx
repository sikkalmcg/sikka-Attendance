
"use client";

import { useParams, useRouter } from "next/navigation";
import { DataProvider, useData } from "@/context/data-context";
import { VoucherDocumentContent } from "@/app/dashboard/vouchers/page";
import { Button } from "@/components/ui/button";
import { Printer, X, Info } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useEffect, useState } from "react";

/**
 * standalone content component that consumes DataContext
 */
function VoucherDetailContent() {
  const params = useParams();
  const { vouchers, employees, firms, plants } = useData();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const voucher = vouchers.find((v) => v.id === params.id);

  if (!isMounted) return null;

  if (!voucher) {
    return (
      <div className="h-screen flex flex-col items-center justify-center space-y-4 bg-slate-50">
        <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center shadow-sm">
          <Info className="w-8 h-8 text-rose-500" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-black text-slate-900">Voucher Not Found</h2>
          <p className="text-sm text-muted-foreground font-medium">The requested document could not be located in the repository.</p>
        </div>
        <Button onClick={() => window.close()} variant="outline" className="font-bold rounded-xl">Close Window</Button>
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Top Action Bar - Hidden in Print */}
      <div className="h-16 border-b bg-white/80 backdrop-blur-md sticky top-0 z-50 flex items-center justify-between px-6 sm:px-12 print:hidden shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
            <span className="text-white font-black text-sm">V</span>
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-900 uppercase tracking-widest">{voucher.voucherNo}</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase leading-none mt-1">Payment Voucher Slip</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden lg:flex items-center gap-2 px-4 py-1.5 bg-slate-50 rounded-full border border-slate-200">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Info className="w-3.5 h-3.5" /> A4 Layout Preview
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => window.close()} className="font-bold text-xs h-9 px-4 rounded-xl">
            <X className="w-4 h-4 mr-2" /> Close
          </Button>
          <Button onClick={handlePrint} size="sm" className="bg-primary hover:bg-primary/90 font-black text-xs h-9 px-6 rounded-xl shadow-lg shadow-primary/20 gap-2">
            <Printer className="w-4 h-4" /> Print / Save PDF
          </Button>
        </div>
      </div>

      {/* Main Document Content */}
      <ScrollArea className="flex-1 w-full" tabIndex={0} role="region" aria-label="Voucher Content">
        <div className="py-12 px-4 sm:px-8 flex justify-center">
          <div className="print-only">
             <VoucherDocumentContent 
               voucher={voucher} 
               employees={employees} 
               firms={firms} 
               plants={plants}
               isPrintMode={false} 
             />
          </div>
        </div>
        <ScrollBar orientation="vertical" className="w-3 opacity-100 block" />
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}

/**
 * Main Page Component with standalone providers to bypass dashboard layout auth redirects
 */
export default function VoucherDetailPage() {
  return (
    <DataProvider>
      <VoucherDetailContent />
    </DataProvider>
  );
}

