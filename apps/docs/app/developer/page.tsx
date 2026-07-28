import type { Metadata } from "next";
import DeveloperPage from "./[...slug]/page";

const params = Promise.resolve({ slug: ["README"] });

export default function DeveloperHomePage() {
  return <DeveloperPage params={params} />;
}

export const metadata: Metadata = {
  title: "OpenTrip developer docs",
  description:
    "Architecture, API contracts, frontend conventions, and operations.",
};
