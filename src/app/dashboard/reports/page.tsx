"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Send, FileBarChart2, FileText, Download } from "lucide-react";
import { naturalLanguageDataSummary } from "@/ai/flows/natural-language-data-summary-flow";
import { useToast } from "@/hooks/use-toast";

export default function ReportsPage() {
  const [query, setQuery] = useState("");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleAiSummary = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      // Mock data strings as if fetched from DB
      const attendanceData = "Employee S001 marked IN at 9 AM, OUT at 5 PM on 2024-07-20. Employee S002 was absent on 2024-07-20.";
      const payrollData = "Employee S001 net salary for July was 50000 INR, PF contribution 6000 INR.";
      
      const res = await naturalLanguageDataSummary({ query, attendanceData, payrollData });
      setSummary(res.summary);
    } catch (err) {
      toast({ variant: "destructive", title: "AI Error", description: "Failed to generate data summary." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Analytics & Reports</h1>
          <p className="text-muted-foreground">Strategic insights into workforce productivity and costs.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-lg border-none bg-gradient-to-br from-slate-900 to-slate-800 text-white">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="text-cyan-400 w-5 h-5" />
                <CardTitle className="text-lg">AI Business Intelligence</CardTitle>
              </div>
              <CardDescription className="text-slate-400">Ask any question about your payroll or attendance data.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Textarea 
                  placeholder="e.g., 'Summary of attendance for last week' or 'Compare payroll costs between plants'" 
                  className="bg-slate-800/50 border-slate-700 text-white min-h-[100px] pr-12 focus-visible:ring-cyan-500"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <Button 
                  size="icon" 
                  className="absolute bottom-3 right-3 bg-cyan-500 hover:bg-cyan-600"
                  onClick={handleAiSummary}
                  disabled={loading}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              
              {summary && (
                <div className="mt-4 p-4 rounded-xl bg-slate-800 border border-slate-700">
                  <p className="text-sm leading-relaxed text-slate-200">{summary}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ReportCard 
              title="Attendance Export" 
              description="Daily logs, status, and hours by plant." 
              icon={FileBarChart2}
            />
            <ReportCard 
              title="Payroll Summary" 
              description="Cost breakdown, PF/ESIC liabilities." 
              icon={FileText}
            />
          </div>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Recent Exports</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              <div className="divide-y divide-slate-100">
                <HistoryItem name="July_Payroll_Final.xlsx" date="2 hours ago" />
                <HistoryItem name="Plant_A_Attendance_WK2.pdf" date="Yesterday" />
                <HistoryItem name="Statutory_PF_Returns.csv" date="3 days ago" />
                <HistoryItem name="Q2_Cost_Analysis.pdf" date="1 week ago" />
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ReportCard({ title, description, icon: Icon }: any) {
  return (
    <Card className="hover:border-primary transition-all cursor-pointer group border-slate-200">
      <CardContent className="p-6">
        <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors">
          <Icon className="text-slate-400 group-hover:text-primary transition-colors" />
        </div>
        <h3 className="font-bold mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
        <Button variant="outline" className="w-full">
          <Download className="w-4 h-4 mr-2" />
          Generate Report
        </Button>
      </CardContent>
    </Card>
  );
}

function HistoryItem({ name, date }: { name: string, date: string }) {
  return (
    <div className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-slate-100 rounded">
          <FileText className="w-4 h-4 text-slate-500" />
        </div>
        <div>
          <p className="text-sm font-semibold">{name}</p>
          <p className="text-xs text-muted-foreground">{date}</p>
        </div>
      </div>
      <Button variant="ghost" size="icon">
        <Download className="w-4 h-4 text-slate-400" />
      </Button>
    </div>
  );
}