"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Library } from "lucide-react";

export const CosmicMenu = () => {
  const pathname = usePathname();
  const navItems = [
    {
      icon: <LayoutDashboard />,
      label: "Dashboard",
      active: true,
      href: "/my/dashboard",
    },
    { icon: <Library />, label: "Library", href: "/my/library" },
  ];

  return (
    <div className="flex ml-8 gap-2">
      {navItems.map((item) => (
        <Link
          href={item.href}
          key={item.label}
          className={`flex gap-2 items-center px-2 py-2 text-sm rounded-lg ${
            pathname === item.href
              ? "bg-blue-50 text-blue-600"
              : "text-gray-600 hover:bg-gray-50"
          }`}
          title={item.label}
        >
          <span>{item.icon}</span>
          <span
            className={`transition-all duration-300 ease-in-out overflow-hidden w-auto opacity-100`}
          >
            {item.label}
          </span>
        </Link>
      ))}
    </div>
  );
};
