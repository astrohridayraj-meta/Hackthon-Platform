import type { RoundConfig } from '../src/types/index.ts';

export const ADMIN_EMAILS: string[] = (
  process.env.ADMIN_EMAILS || 'astrohridayraj@gmail.com,admin@hackarena.io'
).split(',').map(e => e.trim().toLowerCase());

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

const now = Date.now();
const oneHourAgo = new Date(now - 1000 * 60 * 30).toISOString();
const threeHoursAhead = new Date(now + 1000 * 60 * 60 * 3.5).toISOString();

export const DEFAULT_ROUND_CONFIG: RoundConfig = {
  roundStart: oneHourAgo,
  roundEnd: threeHoursAhead,
  isPaused: false,
  penalties: {
    freeModeEntry: 50,
    swapSeq: 10,
    swapFree: 15,
    hop: 20,
    tabStrikePenalty: 10,
    tabStrikeFreeCount: 2,
    tabStrikeFlagAt: 6,
    maxSwapsPerTask: 1,
    maxMembersPerTeam: 4,
  },
  tasks: [
    {
      id: 'task_1',
      title: 'Task 1: System Ingestion Pipeline',
      description: 'Design and specify a resilient high-throughput data ingestion subsystem with backpressure buffering and idempotent processing.',
      basePoints: 100,
      variantPool: [
        {
          variantId: 'v1_a',
          prompt: 'Variant A: Stream telemetry packets at 50k events/sec using sliding partition buffers. Outline your partition strategy and dead-letter queue schema.',
          hints: ['Consider consumer-group lag tracking', 'Use Bloom filters for duplicate detection']
        },
        {
          variantId: 'v1_b',
          prompt: 'Variant B: Process batched financial ledger mutations with strict causal sequencing across distributed consumer workers.',
          hints: ['Vector clocks or monotonic partition keys', 'Replay logs for failover resilience']
        }
      ]
    },
    {
      id: 'task_2',
      title: 'Task 2: Distributed Consensus & State Arbiter',
      description: 'Architect a deterministic state reconciliation protocol between edge nodes with intermittent split-brain partitions.',
      basePoints: 120,
      variantPool: [
        {
          variantId: 'v2_a',
          prompt: 'Variant A: Implement a quorum-based heartbeat arbiter that avoids cascading re-elections during WAN jitter spikes.',
          hints: ['Randomized lease renewal jitter', 'Witness node quorum calculations']
        },
        {
          variantId: 'v2_b',
          prompt: 'Variant B: Construct a Conflict-free Replicated Data Type (CRDT) for multi-author document updates with offline sync.',
          hints: ['State-based vs Operation-based CRDT tradeoffs', 'Tombstone compaction strategies']
        }
      ]
    },
    {
      id: 'task_3',
      title: 'Task 3: Real-Time Cache Invalidation Barrier',
      description: 'Implement a zero-stale cache invalidation broadcast mesh across multi-region edge caches.',
      basePoints: 130,
      variantPool: [
        {
          variantId: 'v3_a',
          prompt: 'Variant A: Design a gossip-based cache purger with sub-50ms regional replication guarantees and network storm dampening.',
          hints: ['Hierarchical ring topology', 'Probabilistic anti-entropy cycles']
        },
        {
          variantId: 'v3_b',
          prompt: 'Variant B: Design a write-through dual-key cache coherency barrier with version tag hashes.',
          hints: ['Two-phase commit vs asynchronous event stream', 'Dogpile effect prevention with mutex stamps']
        }
      ]
    },
    {
      id: 'task_4',
      title: 'Task 4: Zero-Knowledge Authorization Token Verifier',
      description: 'Formulate an authentication and entitlement authorization gate that validates claims without leaking user identifiers.',
      basePoints: 140,
      variantPool: [
        {
          variantId: 'v4_a',
          prompt: 'Variant A: Verify anonymous capability tokens with blind signature verification and dynamic rate limiting.',
          hints: ['RSA Blind signatures vs discrete log proofs', 'Token revocation lists using compact bitvectors']
        },
        {
          variantId: 'v4_b',
          prompt: 'Variant B: Build a ring-signature verification gate allowing any valid team member to sign actions anonymously on behalf of the group.',
          hints: ['Key images to prevent double spending', 'Constant-time verification loops']
        }
      ]
    },
    {
      id: 'task_5',
      title: 'Task 5: Adaptive Rate Limiter & Token Reservoir',
      description: 'Architect an adaptive token bucket system that throttles bursty API traffic dynamically based on upstream downstream backpressure.',
      basePoints: 150,
      variantPool: [
        {
          variantId: 'v5_a',
          prompt: 'Variant A: Token bucket with PID controller feedback loop modulating refill rates according to downstream p99 latency spikes.',
          hints: ['Proportional-Integral-Derivative tuning formulas', 'Circuit-breaker trip boundaries']
        },
        {
          variantId: 'v5_b',
          prompt: 'Variant B: Sliding-window log limiter with Redis-like distributed atomic evaluation and per-tier fairness quotas.',
          hints: ['Sorted set memory optimization', 'Approximate counting using HyperLogLog / Count-Min sketch']
        }
      ]
    },
    {
      id: 'task_6',
      title: 'Task 6: High-Frequency Order Book Matcher',
      description: 'Develop an in-memory lock-free priority matching engine for limit orders with price-time precedence.',
      basePoints: 160,
      variantPool: [
        {
          variantId: 'v6_a',
          prompt: 'Variant A: Dual B-tree order book structure supporting cancel-replace semantics under 10 microseconds.',
          hints: ['Pointer chasing vs contiguous flat memory arrays', 'Atomic compare-and-swap operations']
        },
        {
          variantId: 'v6_b',
          prompt: 'Variant B: Ring-buffer sequence queue matcher with deterministic tick replay and zero garbage collection pauses.',
          hints: ['LMAX Disruptor patterns', 'Cache-line padding to avoid false sharing']
        }
      ]
    },
    {
      id: 'task_7',
      title: 'Task 7: Graph Partitioning for Geo-Distributed Shards',
      description: 'Partition a dense dynamic social communication graph across 16 global database shards minimizing cross-shard cross-chatter.',
      basePoints: 180,
      variantPool: [
        {
          variantId: 'v6_a',
          prompt: 'Variant A: Streaming graph partitioning algorithm with vertex migration constraints and storage balancing.',
          hints: ['Balanced p-way graph partitioning heuristics', 'Linear Deterministic Greedy (LDG)']
        },
        {
          variantId: 'v7_b',
          prompt: 'Variant B: Community detection via Louvain method adapted for incremental online membership drift.',
          hints: ['Modularity optimization metrics', 'Hierarchical aggregation levels']
        }
      ]
    },
    {
      id: 'task_8',
      title: 'Task 8: Adversarial Fault Injector & Chaos Orchestrator',
      description: 'Construct a systemic resilience verifier that injects simulated network drops, thread deadlocks, and clock skew to validate auto-recovery.',
      basePoints: 200,
      variantPool: [
        {
          variantId: 'v8_a',
          prompt: 'Variant A: Orchestrate deterministic clock drift injection across Raft nodes to test leader election lease timeouts.',
          hints: ['System call interception vs virtualized NTP', 'Split-brain containment validation']
        },
        {
          variantId: 'v8_b',
          prompt: 'Variant B: Generate pathological adversarial input streams designed to trigger hash-table collision degradation (Algorithmic Complexity Attacks).',
          hints: ['SipHash vs MurmurHash vulnerabilities', 'Defensive bounded collision trees']
        }
      ]
    }
  ],
  updatedAt: new Date().toISOString(),
  updatedBy: 'system'
};
