import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { config } from '../../config.js';

/**
 * Speaks to the surf model over a pipe.
 *
 * The model is a separate program rather than a library call, even though it
 * currently lives in this repository. That keeps it portable: moving swellkit
 * into its own private repository, or replacing the transport with HTTP, changes
 * this file and nothing else.
 *
 * Interpreter startup dominates the cost — about 50ms bare, and a few hundred
 * once numpy is imported. That is acceptable against an endpoint that already
 * queries Postgres and sometimes fetches NDBC live. If it stops being
 * acceptable, the fix is a long-running process, not a different boundary.
 */

const MODEL_TIMEOUT_MS = 10_000;

/** Mirrors contract.schema.json. Wire format, so field names are camelCase. */
export interface ModelObservation {
  stationId: string;
  lat: number;
  lon: number;
  observedAt: string;
  waveHeight: number | null;
  dominantPeriod: number | null;
  avgPeriod: number | null;
  waveDirection: number | null;
  windSpeed: number | null;
  windDirection: number | null;
  waterTemp: number | null;
}

export interface ModelRequest {
  target: { lat: number; lon: number };
  observations: ModelObservation[];
  facing?: number;
}

export interface ModelForecast {
  waveHeight: number | null;
  dominantPeriod: number | null;
  swellPower: number | null;
  windSpeed: number | null;
  windDirection: number | null;
  waterTemp: number | null;
  tone: string;
  weights: Array<{ stationId: string; distanceKm: number; weight: number }>;
  observedAt: string;
}

// Resolved from this file so dev and the built output agree; the container
// overrides it because swellkit sits beside dist rather than five levels up.
/**
 * The model is one executable: the console script `uv sync` installs into
 * swellkit's virtualenv.
 *
 * Running it rather than `python -m swellkit` means no interpreter to locate, no
 * PYTHONPATH, and no working-directory assumptions. It also has to be the venv's
 * script rather than anything on PATH, because swellkit's dependencies are
 * installed there — a system interpreter cannot import numpy once the spectral
 * work lands, whatever its version.
 */
const defaultSwellkitBin = fileURLToPath(
  new URL('../../../../../swellkit/.venv/bin/swellkit', import.meta.url),
);

export class ModelError extends Error {}

export async function forecast(request: ModelRequest): Promise<ModelForecast> {
  const bin = config.swellkitBin ?? defaultSwellkitBin;

  return new Promise((resolve, reject) => {
    const child = spawn(bin, [], { stdio: ['pipe', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      settled = true;
      child.kill('SIGKILL');
      reject(new ModelError(`model timed out after ${MODEL_TIMEOUT_MS}ms`));
    }, MODEL_TIMEOUT_MS);

    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new ModelError(message));
    };

    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));

    child.on('error', (err) =>
      fail(`could not start model (${bin}): ${err.message} — has uv sync been run?`),
    );

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      let parsed: unknown;
      try {
        parsed = JSON.parse(stdout);
      } catch {
        reject(
          new ModelError(
            `model returned unparseable output (exit ${code}): ${stderr.trim() || stdout.slice(0, 200)}`,
          ),
        );
        return;
      }

      if (code !== 0) {
        const error = (parsed as { error?: string }).error ?? `exit ${code}`;
        reject(new ModelError(`model rejected the request: ${error}`));
        return;
      }

      resolve(parsed as ModelForecast);
    });

    child.stdin.on('error', () => fail('model closed its input before the request was written'));
    child.stdin.end(JSON.stringify(request));
  });
}
