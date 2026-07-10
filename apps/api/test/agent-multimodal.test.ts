import { describe, expect, it } from "vitest";
import {
  isTripOwnedMediaUrl,
  storageNamespaceOf,
  storagePathFromPublicUrl,
  detectTripMediaMimeType,
} from "../src/application/storage";
import { sanitizeAgentFileParts } from "../src/application/agent/file-parts";

describe("trip media multimodal helpers", () => {
  const tripId = "trip-demo";
  const ns = storageNamespaceOf(tripId);
  const file = `aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.png`;
  const path = `trips/${ns}/${file}`;

  it("parses public upload URLs into storage paths", () => {
    expect(
      storagePathFromPublicUrl(`https://api.example/api/uploads/${path}`),
    ).toBe(path);
    expect(storagePathFromPublicUrl(`/api/uploads/${path}`)).toBe(path);
  });

  it("accepts only this trip's managed media URLs", () => {
    const url = `https://api.example/api/uploads/trips/${ns}/${file}`;
    expect(isTripOwnedMediaUrl(url, tripId)).toBe(true);
    expect(isTripOwnedMediaUrl(url, "other-trip")).toBe(false);
    expect(isTripOwnedMediaUrl("https://evil.example/x.png", tripId)).toBe(false);
    expect(isTripOwnedMediaUrl(`data:image/png;base64,aaa`, tripId)).toBe(false);
  });

  it("sanitizes agent file parts", () => {
    const url = `https://api.example/api/uploads/trips/${ns}/${file}`;
    const parts = sanitizeAgentFileParts(
      [
        { type: "file", mediaType: "image/png", url, filename: "shot.png" },
        { type: "file", mediaType: "image/png", url: "data:image/png;base64,x" },
        { type: "file", mediaType: "image/gif", url },
        { type: "text", text: "hi" },
      ],
      tripId,
    );
    expect(parts).toEqual([
      { type: "file", mediaType: "image/png", url, filename: "shot.png" },
    ]);
  });

  it("detects pdf and text mime types", () => {
    const pdf = new TextEncoder().encode("%PDF-1.4\n%âãÏÓ\n");
    expect(detectTripMediaMimeType(pdf, "application/pdf")).toBe("application/pdf");

    const text = new TextEncoder().encode("# hello\n");
    expect(detectTripMediaMimeType(text, "", "note.md")).toBe("text/markdown");
  });
});
