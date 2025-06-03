
"use client";

import { useState, type ReactNode, useEffect } from 'react';
import { ADMIN_PASSWORD } from '@/lib/config';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ShieldCheck, LogIn, LogOut } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface AdminAuthProps {
  children: ReactNode;
}

const ADMIN_AUTH_KEY = 'isAdminAuthenticated_WPH'; // Unique key for this app

export function AdminAuth({ children }: AdminAuthProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true); // To prevent flash of login form
  const { toast } = useToast();

  useEffect(() => {
    try {
      const storedAuth = sessionStorage.getItem(ADMIN_AUTH_KEY);
      if (storedAuth === 'true') {
        setIsAuthenticated(true);
      }
    } catch (e) {
      console.warn("Could not access sessionStorage for admin auth:", e);
      // If sessionStorage is unavailable, auth will rely on component state per session
    }
    setIsLoading(false);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setError('');
      try {
        sessionStorage.setItem(ADMIN_AUTH_KEY, 'true');
      } catch (e) {
        console.warn("Could not set sessionStorage for admin auth:", e);
        toast({
            title: "Session Warning",
            description: "Could not save login state. You may need to log in again if you navigate away.",
            variant: "default" 
        });
      }
    } else {
      setError('Incorrect password. Please try again.');
      setIsAuthenticated(false);
      try {
        sessionStorage.removeItem(ADMIN_AUTH_KEY);
      } catch (e) {
         // fail silently
      }
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPassword(''); // Clear password field on logout
    setError('');
    try {
      sessionStorage.removeItem(ADMIN_AUTH_KEY);
    } catch (e) {
       // fail silently
    }
    toast({ title: "Logged Out", description: "You have been successfully logged out." });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <ShieldCheck className="mx-auto h-12 w-12 text-primary animate-pulse mb-2" />
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <>
        <div className="container mx-auto mb-4 flex justify-end">
            <Button onClick={handleLogout} variant="outline" size="sm">
                <LogOut className="mr-2 h-4 w-4" />
                Logout Admin
            </Button>
        </div>
        {children}
      </>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-primary mb-2" />
          <CardTitle className="text-2xl font-headline">Admin Access Required</CardTitle>
          <CardDescription>Please enter the password to access the admin panel.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                className="text-center"
                aria-label="Admin Password"
                suppressHydrationWarning={true}
              />
            </div>
            {error && <p className="text-sm text-destructive text-center">{error}</p>}
            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90"
              suppressHydrationWarning={true}
            >
              <LogIn className="mr-2 h-4 w-4" />
              Login
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
