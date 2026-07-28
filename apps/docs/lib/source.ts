import { developerDocs, userDocs } from "collections/server";
import { loader } from "fumadocs-core/source";

export const userSource = loader({
  baseUrl: "/user",
  source: userDocs.toFumadocsSource(),
});

export const developerSource = loader({
  baseUrl: "/developer",
  source: developerDocs.toFumadocsSource(),
});

export const searchSource = loader(
  {
    user: userDocs.toFumadocsSource(),
    developer: developerDocs.toFumadocsSource(),
  },
  {
    baseUrl: "",
  },
);

export type DocumentationView = "user" | "developer";

export function getSource(view: DocumentationView) {
  return view === "user" ? userSource : developerSource;
}
