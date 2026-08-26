'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export default function AppNavbar() {
  const pathname = usePathname()

  const links = [
    { href: '/outfits', label: 'Outfits' },
    { href: '/wardrobe', label: 'Closet' },
    { href: '/wishlist', label: 'Wishlist' },
  ]

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#e4dbd0] bg-[#f7f4ef]/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center px-4 sm:px-6">
        <Link href="/outfits" className="text-lg font-bold tracking-tight text-[#1d1b18]">
          StyleGraph
        </Link>
        <nav className="ml-8 flex items-center gap-6">
          {links.map((link) => {
            const isActive = pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'text-sm font-medium transition-colors',
                  isActive
                    ? 'text-[#1d1b18]'
                    : 'text-[#7a6f62] hover:text-[#1d1b18]'
                )}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
