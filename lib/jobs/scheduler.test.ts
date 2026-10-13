import { describe, expect, it } from 'vitest';
import { jobLockName } from './config';
import { planSchedulePass, tabLockName } from './scheduler';
import type { Job, JobKind, JobStatus } from './types';

/**
 * Cross-tab scheduling (AM3).
 *
 * `heldLockNames` stands in for `navigator.locks.query()`, which reports every
 * lock held anywhere in the origin. Simulating two tabs is therefore just a
 * matter of listing the locks each one holds.
 */

let seq = 0;
const job = (
  over: Partial<Job> & { kind: JobKind; status: JobStatus; projectId: string },
): Job => ({
  id: over.id ?? `job-${(seq += 1)}`,
  createdAt: over.createdAt ?? seq,
  phase: 'queued',
  events: [],
  warnings: [],
  progress: { categoriesDone: [], categoriesFailed: [] },
  seen: false,
  payload:
    over.kind === 'upload'
      ? { kind: 'upload', fileRefs: [] }
      : over.kind === 'extraction'
        ? { kind: 'extraction', mode: 'BLIND', previousSpecs: null }
        : { kind: 'correction', parameterKey: 'U_MIN', previousMetrics: [], userHint: null },
  ...over,
});

const TAB_A = 'tab-a';
const TAB_B = 'tab-b';
/** Both tabs alive, holding their own tab locks. */
const bothTabsAlive = [tabLockName(TAB_A), tabLockName(TAB_B)];

describe('liveness comes from locks, not timers (AM2)', () => {
  it('leaves a running job alone while its per-job lock is held', () => {
    const running = job({ kind: 'extraction', status: 'running', projectId: 'p1', ownerTabId: TAB_B });
    const plan = planSchedulePass({
      jobs: [running],
      tabId: TAB_A,
      heldLockNames: [...bothTabsAlive, jobLockName(running.id)],
    });
    expect(plan.interrupted).toEqual([]);
  });

  it('does not interrupt a long run just because time passed', () => {
    // The whole point of AM2: a job started hours ago in a throttled
    // background tab is still alive if its lock is held. No timestamp is
    // consulted anywhere in the decision.
    const running = job({
      kind: 'extraction', status: 'running', projectId: 'p1',
      ownerTabId: TAB_B, startedAt: 0, createdAt: 0,
    });
    const plan = planSchedulePass({
      jobs: [running],
      tabId: TAB_A,
      heldLockNames: [...bothTabsAlive, jobLockName(running.id)],
    });
    expect(plan.interrupted).toEqual([]);
  });

  it('interrupts a running job whose lock is gone', () => {
    const orphan = job({ kind: 'extraction', status: 'running', projectId: 'p1', ownerTabId: TAB_B });
    const plan = planSchedulePass({
      jobs: [orphan],
      tabId: TAB_A,
      heldLockNames: [tabLockName(TAB_A)], // tab B died, taking its locks
    });
    expect(plan.interrupted.map((j) => j.id)).toEqual([orphan.id]);
  });

  it('frees the dead job\'s slot in the same pass', () => {
    const dead = job({ kind: 'extraction', status: 'running', projectId: 'p1', ownerTabId: TAB_B });
    const alive = [
      job({ kind: 'extraction', status: 'running', projectId: 'p2', ownerTabId: TAB_A }),
      job({ kind: 'extraction', status: 'running', projectId: 'p3', ownerTabId: TAB_A }),
    ];
    const waiting = job({ kind: 'extraction', status: 'queued', projectId: 'p4', enqueuedByTabId: TAB_A });

    const plan = planSchedulePass({
      jobs: [dead, ...alive, waiting],
      tabId: TAB_A,
      heldLockNames: [
        tabLockName(TAB_A),
        jobLockName(alive[0].id),
        jobLockName(alive[1].id),
      ],
    });

    expect(plan.interrupted.map((j) => j.id)).toEqual([dead.id]);
    // Without reclaiming the slot the cap would still read as full.
    expect(plan.toStart.map((j) => j.id)).toEqual([waiting.id]);
  });
});

describe('the cap is per browser, not per tab', () => {
  it('starts nothing when three jobs are already running in another tab', () => {
    const running = ['p1', 'p2', 'p3'].map((p) =>
      job({ kind: 'extraction', status: 'running', projectId: p, ownerTabId: TAB_B }),
    );
    const mine = job({ kind: 'extraction', status: 'queued', projectId: 'p4', enqueuedByTabId: TAB_A });

    const plan = planSchedulePass({
      jobs: [...running, mine],
      tabId: TAB_A,
      heldLockNames: [...bothTabsAlive, ...running.map((j) => jobLockName(j.id))],
    });

    expect(plan.toStart).toEqual([]);
  });

  it('four jobs across two tabs: exactly three run, the fourth waits', () => {
    const jobs = [
      job({ kind: 'extraction', status: 'queued', projectId: 'p1', enqueuedByTabId: TAB_A, createdAt: 1 }),
      job({ kind: 'extraction', status: 'queued', projectId: 'p2', enqueuedByTabId: TAB_A, createdAt: 2 }),
      job({ kind: 'extraction', status: 'queued', projectId: 'p3', enqueuedByTabId: TAB_B, createdAt: 3 }),
      job({ kind: 'extraction', status: 'queued', projectId: 'p4', enqueuedByTabId: TAB_B, createdAt: 4 }),
    ];

    // Each tab plans against the same shared record.
    const planA = planSchedulePass({ jobs, tabId: TAB_A, heldLockNames: bothTabsAlive });
    const planB = planSchedulePass({ jobs, tabId: TAB_B, heldLockNames: bothTabsAlive });

    // A tab only starts what it queued, and only within the shared cap of 3.
    expect(planA.toStart.map((j) => j.projectId)).toEqual(['p1', 'p2']);
    expect(planB.toStart.map((j) => j.projectId)).toEqual(['p3']);

    const total = planA.toStart.length + planB.toStart.length;
    expect(total).toBe(3);
    // p4 is the one left over, and it belongs to tab B.
    const started = new Set([...planA.toStart, ...planB.toStart].map((j) => j.projectId));
    expect(started.has('p4')).toBe(false);
  });

  it('the fourth job starts in the tab that queued it once a slot frees', () => {
    const finishedInA = job({ kind: 'extraction', status: 'completed', projectId: 'p1', ownerTabId: TAB_A });
    const stillRunning = [
      job({ kind: 'extraction', status: 'running', projectId: 'p2', ownerTabId: TAB_A }),
      job({ kind: 'extraction', status: 'running', projectId: 'p3', ownerTabId: TAB_B }),
    ];
    const fourth = job({ kind: 'extraction', status: 'queued', projectId: 'p4', enqueuedByTabId: TAB_B, createdAt: 4 });
    const jobs = [finishedInA, ...stillRunning, fourth];
    const heldLockNames = [...bothTabsAlive, ...stillRunning.map((j) => jobLockName(j.id))];

    // Tab A must not adopt it: tab B queued it and is alive.
    expect(planSchedulePass({ jobs, tabId: TAB_A, heldLockNames }).toStart).toEqual([]);
    // Tab B starts it.
    expect(
      planSchedulePass({ jobs, tabId: TAB_B, heldLockNames }).toStart.map((j) => j.projectId),
    ).toEqual(['p4']);
  });
});

describe('ownership of queued work', () => {
  it('does not start a job queued by another live tab', () => {
    const theirs = job({ kind: 'extraction', status: 'queued', projectId: 'p1', enqueuedByTabId: TAB_B });
    const plan = planSchedulePass({ jobs: [theirs], tabId: TAB_A, heldLockNames: bothTabsAlive });
    expect(plan.toStart).toEqual([]);
  });

  it('adopts a job whose queuing tab has gone, so the queue is never stranded', () => {
    const orphanQueued = job({ kind: 'extraction', status: 'queued', projectId: 'p1', enqueuedByTabId: TAB_B });
    const plan = planSchedulePass({
      jobs: [orphanQueued],
      tabId: TAB_A,
      heldLockNames: [tabLockName(TAB_A)], // tab B is gone
    });
    expect(plan.toStart.map((j) => j.id)).toEqual([orphanQueued.id]);
  });

  it('adopts a job with no recorded owner', () => {
    const legacy = job({ kind: 'extraction', status: 'queued', projectId: 'p1' });
    const plan = planSchedulePass({ jobs: [legacy], tabId: TAB_A, heldLockNames: bothTabsAlive });
    expect(plan.toStart.map((j) => j.id)).toEqual([legacy.id]);
  });

  it('still honours correction priority across tabs', () => {
    const jobs = [
      job({ kind: 'upload', status: 'queued', projectId: 'p1', enqueuedByTabId: TAB_A, createdAt: 1 }),
      job({ kind: 'correction', status: 'queued', projectId: 'p2', enqueuedByTabId: TAB_A, createdAt: 99 }),
    ];
    const plan = planSchedulePass({ jobs, tabId: TAB_A, heldLockNames: bothTabsAlive, cap: 1 });
    expect(plan.toStart.map((j) => j.kind)).toEqual(['correction']);
  });
});
