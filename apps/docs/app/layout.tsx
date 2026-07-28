import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import DefaultSearchDialog from "@/components/search";
import { site } from "@/lib/site";
import "./global.css";

export const metadata: Metadata = {
  title: {
    default: site.name,
    template: `%s · ${site.name}`,
  },
  description: site.description,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <RootProvider search={{ SearchDialog: DefaultSearchDialog }}>
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
