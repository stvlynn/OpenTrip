import type { Context } from "hono";
import { ZodError } from "zod";
import { WeatherError } from "../../application/weather/weather-error";
import { FxError } from "../../application/fx/fx-error";
import { GeoError } from "../../application/geo/geo-error";
import { DomainError, NotFoundError } from "../../domain/shared/errors";
import {
  ConflictError,
  ForbiddenError,
  ReservationConflictError,
} from "../../application";
import { AvatarError } from "../../application/avatar";
import { TripMediaError } from "../../application/media";
import { StreetViewError } from "../../application/street-view";
import { fail } from "./response";
import { captureException, logger } from "../../infrastructure/observability";
import type { RuntimeName } from "../../application/observability";

function reportServerError(
  err: Error,
  c: Context,
  runtime: RuntimeName,
  status: number,
): void {
  if (status < 500) return;
  const requestId = c.get("requestId") as string | undefined;
  logger.error("http.request_failed", {
    runtime,
    requestId,
    errorCode: "code" in err ? String(err.code) : undefined,
    errorType: err.name,
    status,
    error: err,
  });
  captureException(err, { runtime, requestId, errorType: err.name, status });
}

/** Translate thrown errors into the error envelope. Registered via app.onError. */
export function handleError(err: Error, c: Context, runtime: RuntimeName = "node") {
  if (err instanceof ZodError) {
    return fail(c, "validation_error", err.issues[0]?.message ?? "Invalid input", 400);
  }
  if (err instanceof ForbiddenError) {
    return fail(c, err.code, err.message, 403);
  }
  if (err instanceof ConflictError) {
    return fail(c, err.code, err.message, 409);
  }
  if (err instanceof ReservationConflictError) {
    return c.json(
      {
        error: {
          code: "reservation_conflict",
          message: err.message,
          current: err.current,
        },
      },
      409,
    );
  }
  if (err instanceof DomainError) {
    return fail(
      c,
      err.code,
      err.message,
      err.code === "reservation_conflict" ? 409 : 400,
    );
  }
  if (err instanceof AvatarError) {
    const status =
      err.code === "avatar_too_large"
        ? 413
        : err.code === "avatar_unsupported_mime"
          ? 400
          : 500;
    reportServerError(err, c, runtime, status);
    return fail(c, err.code, err.message, status);
  }
  if (err instanceof TripMediaError) {
    const status =
      err.code === "media_too_large"
        ? 413
        : err.code === "media_unsupported_mime"
          ? 400
          : 500;
    reportServerError(err, c, runtime, status);
    return fail(c, err.code, err.message, status);
  }
  if (err instanceof WeatherError) {
    const status = err.code === "weather_not_configured" ? 503 : 502;
    reportServerError(err, c, runtime, status);
    return fail(c, err.code, err.message, status);
  }
  if (err instanceof FxError) {
    reportServerError(err, c, runtime, 502);
    return fail(c, err.code, err.message, 502);
  }
  if (err instanceof GeoError) {
    const status =
      err.code === "geo_not_configured"
        ? 503
        : err.code === "geo_timeout"
          ? 504
          : 502;
    reportServerError(err, c, runtime, status);
    return fail(c, err.code, err.message, status);
  }
  if (err instanceof StreetViewError) {
    const status =
      err.code === "street_view_not_configured"
        ? 503
        : err.code === "street_view_image_not_found"
          ? 404
          : err.code === "street_view_timeout"
            ? 504
            : err.code === "street_view_preview_too_large"
              ? 413
              : err.code === "street_view_invalid_image" ||
                  err.code === "street_view_invalid_query" ||
                  err.code === "street_view_panorama_inspection_forbidden" ||
                  err.code === "street_view_unsupported_preview"
                ? 400
                : 502;
    reportServerError(err, c, runtime, status);
    return fail(c, err.code, err.message, status);
  }
  if (err instanceof NotFoundError) {
    return fail(c, err.code, err.message, 404);
  }
  const requestId = c.get("requestId") as string | undefined;
  logger.error("http.unhandled_error", {
    runtime,
    requestId,
    errorType: err.name,
    error: err,
  });
  captureException(err, { runtime, requestId, errorType: err.name });
  return fail(c, "internal_error", "Something went wrong", 500);
}
