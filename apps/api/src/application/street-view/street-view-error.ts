export type StreetViewErrorCode =
  | "street_view_not_configured"
  | "street_view_provider_auth_error"
  | "street_view_invalid_query"
  | "street_view_invalid_image"
  | "street_view_image_not_found"
  | "street_view_panorama_inspection_forbidden"
  | "street_view_timeout"
  | "street_view_rate_limited"
  | "street_view_upstream_error"
  | "street_view_preview_too_large"
  | "street_view_unsupported_preview";

export class StreetViewError extends Error {
  constructor(
    public readonly code: StreetViewErrorCode,
    message: string,
    options: {
      upstreamStatus?: number;
      retryable?: boolean;
      providerOperation?: string;
      attempt?: number;
      cause?: unknown;
    } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "StreetViewError";
    this.upstreamStatus = options.upstreamStatus;
    this.retryable = options.retryable ?? false;
    this.providerOperation = options.providerOperation;
    this.attempt = options.attempt;
  }

  readonly upstreamStatus?: number;
  readonly retryable: boolean;
  readonly providerOperation?: string;
  readonly attempt?: number;
}
