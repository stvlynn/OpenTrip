import type { Metadata } from "next";
import UserPage from "./[...slug]/page";

const params = Promise.resolve({ slug: [] });

export default function UserHomePage() {
  return <UserPage params={params} />;
}

export const metadata: Metadata = {
  title: "OpenTrip user guide",
  description:
    "Everything you need to turn a group conversation into a shared trip.",
};
