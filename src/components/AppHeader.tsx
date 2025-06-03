
"use client";

import Link from 'next/link';
import { BookOpenText, UserCog, Menu, X, Files, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetClose, SheetTitle } from '@/components/ui/sheet';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';

const ADMIN_AUTH_KEY_HEADER = 'isAdminAuthenticated_WPH'; // Must match AdminAuth.tsx

export function AppHeader() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const checkAuth = () => {
      try {
        const storedAuth = sessionStorage.getItem(ADMIN_AUTH_KEY_HEADER);
        setIsAdmin(storedAuth === 'true');
      } catch (e) {
        console.warn("Could not access sessionStorage for header admin links:", e);
        setIsAdmin(false); // Default to not admin if sessionStorage is inaccessible
      }
    };

    checkAuth(); // Initial check
    
    const handleStorageChange = (event: StorageEvent) => {
        if (event.key === ADMIN_AUTH_KEY_HEADER || event.key === null) { 
            checkAuth();
        }
    };
    window.addEventListener('storage', handleStorageChange);

    // Refresh auth state when path changes, e.g. after login/logout navigation
    return () => window.removeEventListener('storage', handleStorageChange);

  }, [pathname]); // Re-check on pathname change as well

  const baseNavLinks = [
    { href: '/', label: 'Projects', icon: BookOpenText },
  ];

  let dynamicLinks = [];
  if (isAdmin) {
    dynamicLinks.push(
      { href: '/admin', label: 'Upload PDFs', icon: UserCog },
      { href: '/admin/manage-pdfs', label: 'Manage PDFs', icon: Files }
    );
  } else {
    // Removed Admin Login link per user request (access via search)
  }
  
  const navLinks = [...baseNavLinks, ...dynamicLinks];


  return (
    <header className="bg-primary text-primary-foreground shadow-md sticky top-0 z-50">
      <div className="container mx-auto flex items-center justify-between p-4">
        <Link href="/" className="flex items-center gap-2 text-xl font-headline font-bold hover:opacity-80 transition-opacity">
          <BookOpenText size={28} />
          Weekly Projects Hub
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-1">
          {navLinks.map((link) => (
            <Button
              key={link.href}
              variant={pathname === link.href ? "secondary" : "ghost"}
              className={cn(
                "text-primary-foreground hover:bg-primary/80",
                pathname === link.href && "bg-primary-foreground/20 text-primary-foreground"
              )}
              asChild
            >
              <Link href={link.href}>
                <link.icon className="mr-2 h-5 w-5" />
                {link.label}
              </Link>
            </Button>
          ))}
          <ThemeToggle />
        </nav>

        {/* Mobile Navigation Trigger */}
        <div className="md:hidden flex items-center gap-1">
          <ThemeToggle />
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary/80">
                <Menu size={24} />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] bg-primary text-primary-foreground p-0 flex flex-col">
                <SheetTitle>
                    <span className="sr-only">Navigation Menu</span>
                </SheetTitle>
              <div className="flex items-center justify-between p-4 border-b border-primary-foreground/20">
                 <Link href="/" className="flex items-center gap-2 text-lg font-headline font-bold" onClick={() => setIsMobileMenuOpen(false)}>
                   <BookOpenText size={24} />
                   Weekly Projects Hub
                 </Link>
                {/* The SheetContent component itself provides a close button, so the explicit one here was redundant */}
              </div>
              <nav className="flex flex-col p-4 space-y-2 flex-grow">
                {navLinks.map((link) => (
                  <SheetClose key={link.href} asChild>
                    <Button
                      variant={pathname === link.href ? "secondary" : "ghost"}
                      className={cn(
                        "justify-start text-primary-foreground hover:bg-primary/80 w-full text-base py-3",
                        pathname === link.href && "bg-primary-foreground/20 text-primary-foreground"
                      )}
                      asChild
                    >
                      <Link href={link.href} onClick={() => setIsMobileMenuOpen(false)}>
                        <link.icon className="mr-3 h-5 w-5" />
                        {link.label}
                      </Link>
                    </Button>
                  </SheetClose>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
