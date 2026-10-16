// app/layout.tsx
import type { Metadata } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/context/themecontext"
import { AuthProvider } from "@/context/authcontext"
import AuthProtected from "@/components/auth-protected"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
})

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "My Dashboard App",
  description: "Dashboard and client management app",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const theme = localStorage.getItem('theme') || 'dark';
                const root = document.documentElement;
                if (theme === 'light' || theme === 'dark') {
                  root.classList.add(theme);
                } else {
                  root.classList.add('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider>
          <AuthProvider>
            <AuthProtected>
              {children}
            </AuthProtected>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
