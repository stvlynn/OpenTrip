import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";
import { PerspectiveSwitcher } from "@/components/perspective-switcher";
import { userSource } from "@/lib/source";
import { site } from "@/lib/site";

export default function UserLayout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={userSource.pageTree}
      nav={{
        title: "OpenTrip Docs",
        url: "/",
        children: <PerspectiveSwitcher perspective="user" />,
      }}
      links={[
        {
          text: "Open OpenTrip",
          url: site.product,
          external: true,
        },
      ]}
    >
      {children}
    </DocsLayout>
  );
}
