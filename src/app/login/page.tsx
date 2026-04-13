"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { SUPER_ADMIN_USER } from "@/lib/constants";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Simulated Authentication Logic
    setTimeout(() => {
      if (username === SUPER_ADMIN_USER.username && password === SUPER_ADMIN_USER.password) {
        localStorage.setItem("user", JSON.stringify({ ...SUPER_ADMIN_USER, id: "super-1" }));
        router.push("/dashboard");
        toast({ title: "Welcome back, Admin", description: "Login successful." });
      } else if (username.length === 12 && password.length === 10) {
        // Simple mock for employees (Aadhaar/Mobile)
        localStorage.setItem("user", JSON.stringify({
          id: "emp-mock",
          username,
          fullName: "Employee Name",
          role: "EMPLOYEE"
        }));
        router.push("/dashboard/attendance");
        toast({ title: "Welcome", description: "Successfully logged in." });
      } else {
        setError("Invalid credentials. Please check your username and password.");
      }
      setLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#E9EDF0] p-4 font-sans">
      {/* Main Container with Golden Border */}
      <div className="w-full max-w-[800px] aspect-[4/3] bg-[#E9EDF0] border-[12px] border-[#C59D2E] rounded-xl shadow-2xl relative flex flex-col p-12">
        
        {/* Header Title */}
        <div className="text-center mb-20">
          <h1 className="text-4xl font-bold text-[#C59D2E] tracking-tight">
            Sikka Industries & Logistics
          </h1>
        </div>

        {/* Login Form */}
        <div className="flex-1 flex flex-col items-center">
          <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4">
            {error && (
              <Alert variant="destructive" className="mb-4 py-2 border-rose-200 bg-rose-50 text-rose-900">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex items-center gap-4">
              <label className="w-24 text-right text-sm font-semibold text-slate-600">
                User <span className="text-red-500">*</span>
              </label>
              <input 
                type="text"
                className="flex-1 h-8 bg-white border border-slate-300 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#C59D2E]"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="flex items-center gap-4">
              <label className="w-24 text-right text-sm font-semibold text-slate-600">
                Password <span className="text-red-500">*</span>
              </label>
              <input 
                type="password"
                className="flex-1 h-8 bg-white border border-slate-300 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#C59D2E]"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="flex justify-center pt-8">
              <button 
                type="submit"
                disabled={loading}
                className="px-10 py-1 bg-[#D1D9E0] border border-black text-sm font-medium hover:bg-[#C1C9D0] active:bg-[#B1B9C0] transition-colors flex items-center gap-2"
              >
                {loading && <Loader2 className="w-3 h-3 animate-spin" />}
                Log On
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-auto flex justify-between items-end border-t border-slate-300 pt-4">
          <p className="text-[11px] text-slate-500 font-medium lowercase">
            copyright@ Sikka Industries & Logistics All rights Reserved
          </p>
          
          {/* Logo Placeholder */}
          <div className="w-16 h-16 bg-[#1A1A3A] flex items-center justify-center rounded-sm">
            <svg viewBox="0 0 100 100" className="w-10 h-10 text-white fill-current">
              <path d="M20,80 Q50,20 80,80" fill="none" stroke="currentColor" strokeWidth="12" strokeLinecap="round" />
              <path d="M30,70 Q50,30 70,70" fill="none" stroke="white" strokeWidth="4" />
            </svg>
          </div>
        </div>

        {/* Bottom Left Accent Detail */}
        <div className="absolute bottom-0 left-0 w-40 h-4 bg-[#C59D2E] rounded-tr-full opacity-80" />
      </div>
    </div>
  );
}
