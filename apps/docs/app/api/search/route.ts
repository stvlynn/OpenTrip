import { createFromSource } from "fumadocs-core/search/server";
import { searchSource } from "@/lib/source";

export const revalidate = false;

export const { staticGET: GET } = createFromSource(searchSource, {
  language: "english",
});
