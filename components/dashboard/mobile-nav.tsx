"use client";

import { Menu } from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DashboardNav, StoreMark } from "./nav";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="grid size-11 place-items-center rounded-md hover:bg-accent lg:hidden" aria-label="Open navigation">
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-72 bg-sidebar p-4">
        <SheetTitle className="px-3 pt-2 text-lg">RelayCare</SheetTitle>
        <div className="px-3 pb-4">
          <StoreMark />
        </div>
        <DashboardNav onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
