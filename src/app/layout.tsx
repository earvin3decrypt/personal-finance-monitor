import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { BlurAmountsToggle } from "@/components/blur-amounts-toggle";
import { Nav } from "@/components/nav";
import { PrivacyProvider } from "@/components/privacy-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { getBillAlertCount } from "@/lib/bills";
import { blurAmountsInitScript } from "@/lib/privacy";
import { getBlurAmounts, getThemePreference } from "@/lib/settings";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Personal Finance Monitor",
  description: "Track expenses, accounts, portfolio, and net worth",
};

/** Always read live SQLite data (never use empty build-time HTML). */
export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const billAlertCount = getBillAlertCount();
  const theme = getThemePreference();
  const blurAmounts = getBlurAmounts();

  return (
    <html
      lang="en"
      className={`h-full ${geist.variable}`}
      data-theme={theme}
      data-blur-amounts={blurAmounts ? "true" : "false"}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: themeInitScript(theme) + blurAmountsInitScript(blurAmounts),
          }}
        />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased md:h-screen md:overflow-hidden">
        <ThemeProvider theme={theme}>
          <PrivacyProvider blurAmounts={blurAmounts}>
            <div className="flex min-h-screen w-full md:h-full md:min-h-0">
              <aside className="hidden h-screen shrink-0 md:flex">
                <Nav billAlertCount={billAlertCount} variant="sidebar" />
              </aside>
              <div className="flex min-w-0 flex-1 flex-col md:min-h-0 md:overflow-y-auto">
                <header className="border-b border-border bg-card p-4 md:hidden [border-bottom-width:0.5px]">
                  <div className="flex items-start justify-between gap-3">
                    <Nav billAlertCount={billAlertCount} variant="mobile" />
                    <div className="flex shrink-0 items-center gap-1.5">
                      <ThemeToggle compact />
                      <BlurAmountsToggle compact />
                    </div>
                  </div>
                </header>
                <main className="flex-1 p-5 md:p-8">{children}</main>
              </div>
            </div>
          </PrivacyProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
