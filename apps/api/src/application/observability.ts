export type RuntimeName = "cloudflare" | "node";

export interface ObservabilityFields {
  [key: string]: unknown;
}

export interface ActiveTrace {
  run<T>(operation: () => T): T;
  setAttribute(name: string, value: string | number | boolean): void;
  recordError(error: unknown): void;
  end(): void;
}

export interface Observability {
  logger: {
    debug(event: string, fields?: ObservabilityFields): void;
    info(event: string, fields?: ObservabilityFields): void;
    warn(event: string, fields?: ObservabilityFields): void;
    error(event: string, fields?: ObservabilityFields): void;
  };
  captureException(error: unknown, fields?: ObservabilityFields): void;
  startTrace(name: string, fields?: ObservabilityFields): ActiveTrace;
  startSpan<T>(
    name: string,
    fields: ObservabilityFields,
    operation: (trace: ActiveTrace) => Promise<T>,
  ): Promise<T>;
}

const noopTrace: ActiveTrace = {
  run: (operation) => operation(),
  setAttribute: () => {},
  recordError: () => {},
  end: () => {},
};

export const noopObservability: Observability = {
  logger: {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  },
  captureException: () => {},
  startTrace: () => noopTrace,
  startSpan: async (_name, _fields, operation) => operation(noopTrace),
};
