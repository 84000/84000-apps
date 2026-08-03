'use client';

/**
 * DEV-708 torture harness UI.
 *
 * A control panel, not a product surface. Every scenario is also callable from
 * `window.__storageHarness`, and the two paths must stay equivalent: Chromium
 * is driven by Playwright through the global, while Firefox and Safari are
 * driven by hand through these buttons. If a scenario were reachable only one
 * way, the browsers that matter most for OPFS would go untested.
 */

import {
  installHarness,
  type BenchmarkResult,
  type CorruptionResult,
  type KillVerdict,
  type QuotaResult,
  type StorageHarness,
} from '@eightyfourthousand/lib-persistence/harness';
import type { ClientStatus } from '@eightyfourthousand/lib-persistence';
import { useCallback, useEffect, useState } from 'react';

type Busy = string | null;

const bytes = (value: number): string => {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const ms = (value: number): string =>
  value < 10 ? `${value.toFixed(2)} ms` : `${value.toFixed(0)} ms`;

const Panel = ({
  title,
  children,
  note,
}: {
  title: string;
  children: React.ReactNode;
  note?: string;
}) => (
  <section
    style={{
      border: '1px solid #d4d4d4',
      borderRadius: 6,
      padding: '12px 14px',
      marginBottom: 14,
    }}
  >
    <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 4px' }}>
      {title}
    </h2>
    {note ? (
      <p style={{ fontSize: 12, color: '#666', margin: '0 0 10px' }}>{note}</p>
    ) : null}
    {children}
  </section>
);

const Button = ({
  onClick,
  disabled,
  children,
  testId,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  testId: string;
}) => (
  <button
    type="button"
    data-testid={testId}
    onClick={onClick}
    disabled={disabled}
    style={{
      border: '1px solid #999',
      borderRadius: 4,
      padding: '5px 10px',
      marginRight: 8,
      marginBottom: 6,
      background: disabled ? '#eee' : '#fff',
      cursor: disabled ? 'default' : 'pointer',
      fontSize: 13,
    }}
  >
    {children}
  </button>
);

const Verdict = ({ passed, label }: { passed: boolean; label: string }) => (
  <span
    data-testid="verdict"
    data-passed={String(passed)}
    style={{
      fontWeight: 600,
      color: passed ? '#0a7d34' : '#b00020',
    }}
  >
    {passed ? 'PASS' : 'FAIL'} — {label}
  </span>
);

const Pre = ({ value }: { value: unknown }) => (
  <pre
    style={{
      fontSize: 11,
      background: '#f7f7f7',
      padding: 8,
      borderRadius: 4,
      overflowX: 'auto',
      margin: '8px 0 0',
    }}
  >
    {JSON.stringify(value, null, 2)}
  </pre>
);

export const StoragePage = () => {
  // The harness drives what is rendered — buttons, roles, live counters — so it
  // belongs in state, not a ref.
  const [harness, setHarness] = useState<StorageHarness | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [status, setStatus] = useState<ClientStatus | null>(null);
  const [tick, setTick] = useState(0);

  const [kill, setKill] = useState<KillVerdict | null>(null);
  const [quota, setQuota] = useState<QuotaResult | null>(null);
  const [corruption, setCorruption] = useState<CorruptionResult[]>([]);
  const [benchmark, setBenchmark] = useState<BenchmarkResult | null>(null);

  useEffect(() => {
    let unsubscribe = () => undefined as void;

    installHarness()
      .then((installed) => {
        setHarness(installed);
        setStatus(installed.status);
        unsubscribe = installed.subscribe(() => setStatus(installed.status));
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : String(cause));
      });

    return () => unsubscribe();
  }, []);

  // The write and query loads mutate plain objects rather than React state, so
  // that a crash mid-write cannot be attributed to render work. Poll to display.
  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 250);
    return () => clearInterval(timer);
  }, []);

  const run = useCallback(
    async (label: string, fn: (h: StorageHarness) => Promise<void>) => {
      if (!harness) return;
      setBusy(label);
      setError(null);
      try {
        await fn(harness);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        setBusy(null);
      }
    },
    [harness],
  );

  const ready = harness !== null;
  const writeLoad = harness?.writeLoad ?? null;
  const queryLoad = harness?.queryLoad ?? null;

  if (error && !ready) {
    return (
      <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ fontSize: 18 }}>Storage harness failed to start</h1>
        <p style={{ color: '#b00020', fontSize: 13 }}>{error}</p>
        <p style={{ fontSize: 13, color: '#666' }}>
          This is itself a result worth recording — note the browser and
          version.
        </p>
      </main>
    );
  }

  return (
    <main
      style={{
        padding: 24,
        fontFamily: 'system-ui, sans-serif',
        maxWidth: 900,
      }}
    >
      <h1 style={{ fontSize: 18, marginBottom: 2 }}>
        DEV-708 — storage durability harness
      </h1>
      <p style={{ fontSize: 12, color: '#666', marginTop: 0 }}>
        WASM SQLite on opfs-sahpool. Open this page in several tabs to exercise
        the coordinator. Also driveable from{' '}
        <code>window.__storageHarness</code>.
      </p>

      {error ? (
        <p
          data-testid="error"
          style={{ color: '#b00020', fontSize: 13, fontWeight: 500 }}
        >
          {error}
        </p>
      ) : null}

      <Panel title="This tab">
        <div data-testid="status" style={{ fontSize: 13 }}>
          {ready && status ? (
            <>
              <div>
                role: <strong data-testid="role">{status.role}</strong>
                {'  '}· generation {status.generation}
              </div>
              <div style={{ color: '#666' }}>
                client {status.clientId.slice(0, 8)} · owner{' '}
                {status.ownerId ? status.ownerId.slice(0, 8) : '(none yet)'}
              </div>
              {status.openReport ? (
                <div style={{ marginTop: 6 }}>
                  cold open {ms(status.openReport.coldOpenMs)} · vfs{' '}
                  {status.openReport.vfsName} · persisted{' '}
                  <strong>{String(status.openReport.persisted)}</strong> ·
                  integrity{' '}
                  <strong>
                    {status.openReport.integrity.databaseOk ? 'ok' : 'FAILED'}
                  </strong>
                </div>
              ) : (
                <div style={{ marginTop: 6, color: '#666' }}>
                  this tab proxies to the owner; it has no open report
                </div>
              )}
            </>
          ) : (
            'starting…'
          )}
        </div>
      </Panel>

      <Panel
        title="1 · Kill the active tab mid-write"
        note="Start the load, then kill this tab (crash it, or close it while writes are in flight). Reload and verify. Acknowledged writes must all be present, with no gaps."
      >
        <Button
          testId="start-write-load"
          onClick={() => harness?.startWriteLoad()}
          disabled={!ready || writeLoad?.running}
        >
          Start write load
        </Button>
        <Button
          testId="stop-write-load"
          onClick={() => harness?.stopWriteLoad()}
          disabled={!writeLoad?.running}
        >
          Stop
        </Button>
        <Button
          testId="verify-after-kill"
          onClick={() =>
            run('verify', async (h) => setKill(await h.verifyAfterKill()))
          }
          disabled={!ready || busy !== null}
        >
          Verify after kill
        </Button>

        <div data-testid="write-load" style={{ fontSize: 13, marginTop: 6 }}>
          {writeLoad
            ? `run ${writeLoad.runId} · issued ${writeLoad.issued} · acked ${writeLoad.acked}` +
              (writeLoad.running ? ' · running' : ' · stopped')
            : 'not started'}
          <span hidden>{tick}</span>
        </div>

        {kill ? (
          <div style={{ marginTop: 8 }}>
            <Verdict
              passed={kill.passed}
              label={`acked ${kill.highestAcked}, persisted ${kill.highestPersisted}, ${kill.holes.length} gaps`}
            />
            <Pre value={kill} />
          </div>
        ) : null}
      </Panel>

      <Panel
        title="2 · Ownership migration under load"
        note="Run this in a tab that is NOT the owner, then kill the owner tab. Queries should keep succeeding — failures and wrong answers are the interesting numbers."
      >
        <Button
          testId="start-query-load"
          onClick={() => harness?.startQueryLoad()}
          disabled={!ready || queryLoad?.running}
        >
          Start query load
        </Button>
        <Button
          testId="stop-query-load"
          onClick={() =>
            run('stop-query', async (h) => void (await h.stopQueryLoad()))
          }
          disabled={!queryLoad?.running}
        >
          Stop
        </Button>

        <div data-testid="query-load" style={{ fontSize: 13, marginTop: 6 }}>
          {queryLoad ? (
            <>
              issued {queryLoad.issued} · ok{' '}
              <strong data-testid="query-ok">{queryLoad.succeeded}</strong> ·
              failed{' '}
              <strong
                data-testid="query-failed"
                style={{ color: queryLoad.failed ? '#b00020' : undefined }}
              >
                {queryLoad.failed}
              </strong>{' '}
              · wrong answers{' '}
              <strong
                data-testid="query-wrong"
                style={{
                  color: queryLoad.wrongAnswers ? '#b00020' : undefined,
                }}
              >
                {queryLoad.wrongAnswers}
              </strong>{' '}
              · max latency {ms(queryLoad.maxLatencyMs)}
              {queryLoad.errors.length ? (
                <Pre value={queryLoad.errors} />
              ) : null}
            </>
          ) : (
            'not started'
          )}
        </div>
      </Panel>

      <Panel
        title="3 · Quota pressure"
        note="Fills the cache table toward the origin quota. The journal must not lose entries, and persist() should protect the database."
      >
        <Button
          testId="run-quota"
          onClick={() =>
            run('quota', async (h) => setQuota(await h.runQuotaPressure()))
          }
          disabled={!ready || busy !== null}
        >
          Fill toward quota
        </Button>
        <Button
          testId="clear-quota"
          onClick={() =>
            run('clear-quota', async (h) => void (await h.clearQuotaFill()))
          }
          disabled={!ready || busy !== null}
        >
          Clear fill
        </Button>

        {quota ? (
          <div style={{ marginTop: 8 }}>
            <Verdict
              passed={quota.journalIntact}
              label={`journal ${quota.journalBefore} → ${quota.journalAfter}, peak usage ${bytes(quota.usagePeakBytes)} of ${bytes(quota.quotaBytes)}`}
            />
            <Pre value={quota} />
          </div>
        ) : null}
      </Panel>

      <Panel
        title="4 · Corruption injection"
        note="Damage must be detected, not survived. Serving plausible garbage is the worst outcome, because it syncs to the server."
      >
        <Button
          testId="corrupt-journal"
          onClick={() =>
            run('corrupt-journal', async (h) => {
              await h.injectJournalCorruption();
              setCorruption([...h.report.corruption]);
            })
          }
          disabled={!ready || busy !== null}
        >
          Corrupt a journal payload
        </Button>
        <Button
          testId="corrupt-database"
          onClick={() =>
            run('corrupt-db', async (h) => {
              await h.injectDatabaseCorruption();
              setCorruption([...h.report.corruption]);
            })
          }
          disabled={!ready || busy !== null}
        >
          Flip bytes in the database file
        </Button>

        {corruption.map((result, index) => (
          <div key={`${result.target}-${index}`} style={{ marginTop: 8 }}>
            <Verdict
              passed={result.detected && !result.silentlyServed}
              label={`${result.target}: ${result.details}`}
            />
          </div>
        ))}
      </Panel>

      <Panel
        title="5 · Throughput vs IndexedDB"
        note="Editor access patterns, not microbenchmarks: bulk load of a work, a 40-passage scroll window, and single journal appends."
      >
        <Button
          testId="run-benchmark"
          onClick={() =>
            run('benchmark', async (h) => setBenchmark(await h.runBenchmark()))
          }
          disabled={!ready || busy !== null}
        >
          Run benchmark
        </Button>
        <Button
          testId="reset"
          onClick={() =>
            run('reset', async (h) => {
              await h.reset();
              setKill(null);
              setQuota(null);
              setCorruption([]);
              setBenchmark(null);
            })
          }
          disabled={!ready || busy !== null}
        >
          Reset all stores
        </Button>

        {benchmark ? (
          <table
            data-testid="benchmark"
            style={{
              fontSize: 12,
              borderCollapse: 'collapse',
              marginTop: 10,
              width: '100%',
            }}
          >
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
                <th style={{ padding: '4px 6px' }}>access pattern</th>
                <th style={{ padding: '4px 6px' }}>SQLite</th>
                <th style={{ padding: '4px 6px' }}>IndexedDB</th>
                <th style={{ padding: '4px 6px' }}>ratio</th>
              </tr>
            </thead>
            <tbody>
              {benchmark.sqlite.map((row, index) => {
                const other = benchmark.indexedDb[index];
                const ratio = other ? row.meanMs / other.meanMs : 0;
                return (
                  <tr
                    key={row.label}
                    style={{ borderBottom: '1px solid #eee' }}
                  >
                    <td style={{ padding: '4px 6px' }}>{row.label}</td>
                    <td style={{ padding: '4px 6px' }}>
                      {ms(row.meanMs)} ({Math.round(row.opsPerSecond)}/s)
                    </td>
                    <td style={{ padding: '4px 6px' }}>
                      {other
                        ? `${ms(other.meanMs)} (${Math.round(other.opsPerSecond)}/s)`
                        : '—'}
                    </td>
                    <td
                      style={{
                        padding: '4px 6px',
                        color: ratio > 1 ? '#b00020' : '#0a7d34',
                      }}
                    >
                      {ratio ? `${ratio.toFixed(2)}×` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : null}

        {benchmark ? <Pre value={benchmark.bundleBytes} /> : null}
      </Panel>

      {busy ? (
        <p data-testid="busy" style={{ fontSize: 13, color: '#666' }}>
          running {busy}…
        </p>
      ) : null}
    </main>
  );
};
