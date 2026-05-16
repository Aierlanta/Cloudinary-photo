export interface MetricsRecorder {
  addDbQueries(count?: number): void;
}

type CounterMap = Record<string, number>;
type MetaMap = Record<string, string | number | boolean | undefined>;

interface PerfStage {
  name: string;
  durationMs: number;
}

export interface PerfSnapshot {
  route: string;
  totalMs: number;
  counters: CounterMap;
  meta: MetaMap;
  stages: PerfStage[];
}

function sanitizeToken(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function formatDuration(durationMs: number): number {
  return Number(durationMs.toFixed(2));
}

export class RequestMetrics implements MetricsRecorder {
  private readonly startedAt = performance.now();
  private readonly counters: CounterMap = {};
  private readonly meta: MetaMap = {};
  private readonly stages: PerfStage[] = [];

  constructor(private readonly route: string) {}

  async time<T>(stageName: string, task: () => Promise<T>): Promise<T> {
    const startedAt = performance.now();
    try {
      return await task();
    } finally {
      this.record(stageName, performance.now() - startedAt);
    }
  }

  record(stageName: string, durationMs: number): void {
    this.stages.push({
      name: sanitizeToken(stageName),
      durationMs: formatDuration(durationMs),
    });
  }

  addCounter(name: string, count: number = 1): void {
    const key = sanitizeToken(name);
    this.counters[key] = (this.counters[key] || 0) + count;
  }

  addDbQueries(count: number = 1): void {
    this.addCounter("db_queries", count);
  }

  setMeta(name: string, value: string | number | boolean | undefined): void {
    if (typeof value === "undefined") {
      return;
    }
    this.meta[sanitizeToken(name)] = value;
  }

  finish(): PerfSnapshot {
    return {
      route: this.route,
      totalMs: formatDuration(performance.now() - this.startedAt),
      counters: { ...this.counters },
      meta: { ...this.meta },
      stages: [...this.stages],
    };
  }
}

export function createRequestMetrics(route: string): RequestMetrics {
  return new RequestMetrics(route);
}

export function buildServerTiming(snapshot: PerfSnapshot): string {
  const entries: string[] = [`app;dur=${snapshot.totalMs}`];
  for (const stage of snapshot.stages.slice(0, 8)) {
    entries.push(`${stage.name};dur=${stage.durationMs}`);
  }
  return entries.join(", ");
}

export function attachPerfHeaders(headers: Headers, snapshot: PerfSnapshot): void {
  headers.set("Server-Timing", buildServerTiming(snapshot));
  headers.set("X-Perf-Route", snapshot.route);
  headers.set("X-Perf-Duration", String(snapshot.totalMs));

  const dbQueries = snapshot.counters.db_queries;
  if (typeof dbQueries === "number") {
    headers.set("X-Perf-Db-Queries", String(dbQueries));
  }

  const mode = snapshot.meta.mode;
  if (typeof mode !== "undefined") {
    headers.set("X-Perf-Mode", String(mode));
  }

  const candidatePool = snapshot.meta.candidate_pool;
  if (typeof candidatePool !== "undefined") {
    headers.set("X-Perf-Candidate-Pool", String(candidatePool));
  }
}

export function attachPerfHeadersToResponse(response: Response, metrics: RequestMetrics): Response {
  attachPerfHeaders(response.headers, metrics.finish());
  return response;
}
