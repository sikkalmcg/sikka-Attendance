"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, User as UserIcon, Lock, AlertCircle } from "lucide-react";
import { SUPER_ADMIN_USER } from "@/lib/constants";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// In a real app, this would be a server-side check. 
// For this prototype, we simulate a check for deactivated accounts.
const DEACTIVATED_MOCK_USER = "123456789012"; // Example: Deactivated Aadhaar

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
        
        // CHECK STATUS SIMULATION
        if (username === DEACTIVATED_MOCK_USER) {
          setError("Your account has been deactivated by HR. Please contact administration.");
          setLoading(false);
          return;
        }

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
        toast({
          variant: "destructive",
          title: "Login Failed",
          description: "Invalid credentials. Aadhaar (12 digits) / Mobile (10 digits) or Admin credentials required."
        });
      }
      setLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-primary/20">
            <ShieldCheck className="text-primary-foreground w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">SikkaTrack HR</h1>
          <p className="text-muted-foreground mt-2">Sikka Industries & Logistics</p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Access Denied</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card className="border-none shadow-xl shadow-slate-200/50">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">Login</CardTitle>
            <CardDescription>Enter your credentials to access your dashboard</CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username / Aadhaar</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="username" 
                    placeholder="12-digit Aadhaar" 
                    className="pl-10"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password / Mobile</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder="10-digit Mobile" 
                    className="pl-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required 
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full font-semibold" size="lg" disabled={loading}>
                {loading ? "Authenticating..." : "Login to System"}
              </Button>
            </CardFooter>
          </form>
        </Card>
        
        <p className="text-center mt-8 text-sm text-muted-foreground">
          &copy; 2024 Sikka Industries & Logistics – Version 1.0
        </p>
      </div>
    </div>
  );
}
