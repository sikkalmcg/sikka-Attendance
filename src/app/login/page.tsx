"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { SUPER_ADMIN_USER } from "@/lib/constants";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Loader2, Eye, EyeOff } from "lucide-react";
import Image from "next/image";
import { getFirestore, collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import Cookies from 'js-cookie';
import { getDeviceId } from "@/lib/utils";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();
  const db = getFirestore();

  useEffect(() => {
    // Check if user is already logged in via cookies on mount
    const session = Cookies.get('sikka_session');
    if (session) {
      router.push('/dashboard');
    }
  }, [router]);

  const persistSession = (userData: any) => {
    const sessionData = JSON.stringify(userData);
    // Persistent for 365 days as per requirement
    Cookies.set('sikka_session', sessionData, { expires: 365, path: '/' });
    localStorage.setItem("user", sessionData);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Check Super Admin Hardcoded Fallback
      if (username === SUPER_ADMIN_USER.username && password === SUPER_ADMIN_USER.password) {
        const userData = { ...SUPER_ADMIN_USER, id: "super-1" };
        persistSession(userData);
        router.push("/dashboard");
        toast({ title: "Welcome back, Admin", description: "Login successful." });
        setLoading(false);
        return;
      }

      // 2. Check Firestore Users Collection (Created Users)
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where("username", "==", username.toLowerCase()), where("password", "==", password));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        const userData = { id: userDoc.id, ...userDoc.data() };
        
        persistSession(userData);
        
        // Redirect based on permissions/role
        if (userData.role === 'EMPLOYEE') {
          router.push("/dashboard/attendance");
        } else {
          router.push("/dashboard");
        }
        
        toast({ title: "Login Successful", description: `Welcome, ${userData.fullName}` });
        setLoading(false);
        return;
      }

      // 3. Employee Directory Lookup (Aadhaar/Mobile)
      if ((username.length === 12 || username.length === 10) && password.length >= 8) {
        const employeesRef = collection(db, 'employees');
        const cleanUsername = username.replace(/\s/g, '');
        
        const empSnapshot = await getDocs(employeesRef);
        const registeredEmpDoc = empSnapshot.docs.find(doc => {
          const d = doc.data();
          return d.aadhaar?.replace(/\s/g, '') === cleanUsername || d.mobile?.replace(/\s/g, '') === cleanUsername;
        });

        if (registeredEmpDoc) {
          const empData = registeredEmpDoc.data();
          
          // --- DEVICE BINDING LOGIC ---
          const currentDeviceId = getDeviceId();
          
          // Check if this device is already registered with another employee (Aadhaar-based check)
          const deviceTakenByOther = empSnapshot.docs.find(d => {
            const data = d.data();
            // If device ID matches but it's not THIS employee's Aadhaar
            return data.deviceId === currentDeviceId && 
                   data.aadhaar?.replace(/\s/g, '') !== (empData.aadhaar?.replace(/\s/g, '') || cleanUsername);
          });

          if (deviceTakenByOther) {
            setError("Device Security Violation: This device is already registered with another employee. One device per employee is allowed for attendance marking.");
            setLoading(false);
            return;
          }

          // Automatically bind/update current device ID for this employee
          const empDocRef = doc(db, 'employees', registeredEmpDoc.id);
          await updateDoc(empDocRef, { deviceId: currentDeviceId });
          // --- END DEVICE BINDING LOGIC ---

          const userData = {
            id: registeredEmpDoc.id,
            username: cleanUsername,
            fullName: empData.name, 
            role: "EMPLOYEE",
            permissions: ["Attendance"]
          };
          persistSession(userData);
          router.push("/dashboard/attendance");
          toast({ title: "Welcome", description: `Logon successful as ${empData.name}` });
          setLoading(false);
          return;
        }
      }

      setError("Invalid credentials. Please check your username and password.");
    } catch (err) {
      console.error("Login error:", err);
      setError("An error occurred during login. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const logoUrl = "https://sikkaenterprises.com/assets/images/Capture13.51191245_std.JPG";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#E9EDF0] p-4 font-sans">
      <div className="w-full max-w-[800px] aspect-[4/3] bg-[#E9EDF0] border-[12px] border-[#C59D2E] rounded-xl shadow-2xl relative flex flex-col p-12">
        
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 relative rounded-xl overflow-hidden shadow-lg border-2 border-white bg-white">
              <Image 
                src={logoUrl}
                alt="Sikka Logo"
                fill
                className="object-cover"
                priority
              />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-[#C59D2E] tracking-tight">
            Sikka Industries & Logistics
          </h1>
          <p className="text-[10px] font-black text-primary mt-2 uppercase tracking-[0.3em]">
            Enterprise Portal
          </p>
        </div>

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
              <div className="flex-1 relative">
                <input 
                  type={showPassword ? "text" : "password"}
                  className="w-full h-8 bg-white border border-slate-300 px-2 pr-8 text-sm focus:outline-none focus:ring-1 focus:ring-[#C59D2E]"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button 
                  type="button"
                  className="absolute right-2 top-1.5 text-slate-400 hover:text-[#C59D2E] transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
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

        <div className="mt-auto flex justify-between items-end border-t border-slate-300 pt-4">
          <p className="text-[11px] text-slate-500 font-medium lowercase">
            copyright@ Sikka Industries & Logistics All rights Reserved
          </p>
          
          <div className="w-16 h-16 bg-[#1A1A3A] flex items-center justify-center rounded-sm overflow-hidden">
            <div className="w-full h-full relative">
              <Image 
                src={logoUrl}
                alt="Logo Small"
                fill
                className="object-cover"
              />
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 w-40 h-4 bg-[#C59D2E] rounded-tr-full opacity-80" />
      </div>
    </div>
  );
}
