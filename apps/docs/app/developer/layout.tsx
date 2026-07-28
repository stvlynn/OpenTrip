import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";
import { PerspectiveSwitcher } from "@/components/perspective-switcher";
import { developerSource } from "@/lib/source";
import { site } from "@/lib/site";

export default function DeveloperLayout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={developerSource.pageTree}
      nav={{
        title: "OpenTrip Docs",
        url: "/",
        children: <PerspectiveSwitcher perspective="developer" />,
      }}
      links={[
        {
          text: "GitHub",
          url: site.repository,
          external: true,
        },
      ]}
    >
      {children}
    </DocsLayout>
  );
}
