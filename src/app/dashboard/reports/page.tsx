"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { 
  FileBarChart2, 
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableRow, 
  TableHead, 
  TableCell 
} from "@/components/ui/table";
import { useRouter } from "next/navigation";

export default function ReportsPage() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  return (
    <div className="space-y-6 pb-20 px-4 max-w-7xl mx-auto">
      <div className="flex justify-between items-center border-b pb-5">
        <div>
          <h1 className="text-3xl font-black uppercase flex items-center gap-3">Analytics & Reports</h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">Compile Audited Shift Records and History Ledgers</p>
        </div>
      </div>

      <Card className="border-none shadow-xl rounded-2xl bg-white">
        <CardHeader>
          <CardTitle className="text-lg font-black uppercase text-slate-800">Available Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-black text-xs uppercase tracking-wider">Report Name</TableHead>
                <TableHead className="font-black text-xs uppercase tracking-wider">Description</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="hover:bg-slate-50/50">
                <TableCell className="font-bold flex items-center gap-3 py-4">
                  <FileBarChart2 className="w-5 h-5 text-primary" />
                  Attendance History Ledger
                </TableCell>
                <TableCell className="text-xs text-slate-500 font-medium">
                  A detailed, day-by-day log of employee attendance records, including status, hours, and approval details.
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    onClick={() => router.push("/dashboard/reports/attendance-history-ledger")}
                    variant="outline"
                    className="gap-2 font-black text-xs uppercase rounded-lg h-9"
                  >
                    Open Report <ChevronRight className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}