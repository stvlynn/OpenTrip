# Platform-neutral street-view implementation plan

1. Add the domain port, normalized image/preview contracts, application service,
   and a Mapillary Graph API adapter selected by runtime configuration.
2. Add authenticated trip-scoped search, detail, preview, and viewer-config HTTP
   endpoints without exposing provider data through agent-facing contracts.
3. Register `streetViewSearch` and capability-gated `streetViewInspect` AI SDK
   tools. Keep execute results as JSON and use async `toModelOutput` for one
   bounded trusted preview image.
4. Add the approval-gated `appendStopNote` trip operation and aggregate method,
   preserving the complete existing note.
5. Extend the json-render catalog, sanitizer, and renderer with a trusted
   `StreetViewCard` and `openStreetView` action.
6. Add a page-scoped shared street-view dialog and isolated MapillaryJS viewer,
   then connect both generated replies and the map context menu.
7. Update configuration examples and architecture/user-facing documentation;
   add focused unit, HTTP, and UI tests; run type checks and relevant test suites.

