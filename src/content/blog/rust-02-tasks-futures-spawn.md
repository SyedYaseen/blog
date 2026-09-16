---
title: "One Waiter, Many Tables"
description: "Tasks vs futures, spawn vs join, and why spawn_blocking exists — pressure-testing my intuitions about tokio"
date: "2026-08-30"
tags: ["rust", "async", "tokio"]
---

> This is a learning experiment. I am writing a Redis-like memory store to learn Rust, kept
> tripping over async, and worked the confusion out with Claude. The questions below are the
> ones I actually asked, hedges and half-formed guesses included. The post was written up with
> its help.

I thought I understood `.await`. I knew about futures and polling. But I had a nagging
question I couldn't resolve on my own:

> If there is one line alone being awaited, and no other code needs to run, and we aren't in
> a `select!` or a join — the code doesn't move forward until that future resolves, right? So
> if nothing else is running concurrently, it *looks* like sync code?

That turned out to be right, but for a reason I had slightly wrong. Chasing it down took me
through four things I'd been quietly conflating: futures, tasks, `spawn`, and `spawn_blocking`.

## The restaurant

The analogy that fixed it for me.

A restaurant has one waiter (the thread) and several tables (the tasks).

You are table 3. You order and wait. From *your seat*, nothing happens until the food comes.
Strictly one thing after another. That is your task.

The waiter is not standing at your table doing nothing. He goes to table 5. If no other table
needs anything, he leans on the wall and rests. He is **idle, not stuck**.

So the rule:

> `.await` suspends the **task**, never the **thread**.

Inside one task, `await` is sequential. Line 2 does not start until line 1 resolves. It reads
like sync code and it *is* sync in ordering — that's the whole ergonomic point of async Rust.
Meanwhile the thread gets handed to another task, or parks in the OS if there are none. It
does not spin.

**Where my intuition was off.** I'd said it would be non-blocking "if some other program is
running something too." Async gives you nothing there — the OS already time-slices processes
for free. The benefit is *within your own program*: your other tasks, on your runtime's
threads. One task awaiting alone buys you nothing over a plain blocking call.

## Futures are not tasks

My next question, and the one that unlocked the rest.

A **future** is a value. A recipe for work that hasn't happened. It is lazy and does nothing
on its own.

A **task** is the runtime's unit of scheduling — a future that tokio has agreed to drive to
completion, plus the bookkeeping to do it.

So a task *is* one future, but that future is built from many smaller futures nested inside
it. Every `.await` in your `async fn` is a smaller future. The compiler welds them into a
single state machine, and that machine is the task's future.

One shipping container (task) holding many boxes (futures). Tokio only tracks containers.

The laziness matters more than I expected. `let f = fetch();` does *nothing*. No work starts.
It only begins when something polls it, which `.await` does. This is different from JavaScript
promises, which start the moment you create them. It bites people who build a `Vec` of futures
expecting parallelism and get nothing until they hand it to `join_all`.

## Three awaits are not concurrent

This one I asked as a question rather than a claim — if I pull from three sources inside a
single spawned task, do those interleave? I suspected they might not, and the answer is no.

``` rust
let a = fetch_a().await;   // wait 100ms
let b = fetch_b().await;   // wait 100ms — starts only after a finishes
let c = fetch_c().await;   // wait 100ms
```

**300ms.** `fetch_b()` isn't even *created* until line 1 finishes. Three sequential awaits are
just sequential.

To interleave inside one task you have to say so:

``` rust
let (a, b, c) = tokio::join!(fetch_a(), fetch_b(), fetch_c());
```

Now all three futures exist at once and the task polls all three each time it wakes. **~100ms.**
Same task, same thread, no extra allocation.

The general shape of async Rust: **nothing is concurrent unless you name a combinator that
makes it so.** Only three things create concurrency —

- `tokio::spawn` — hand a task to the runtime to run independently
- `join!` / `try_join!` — run several futures in one task, interleaved
- `select!` — race several futures, take the first to finish

A bare `.await` on its own line creates zero concurrency. It just yields a slot to whatever
already exists.

## Three futures in one task vs three spawned tasks

The concrete question: pull from three sources, save to a DB. Two ways.

**A — one task, `join!` the fetches, one save**

``` rust
tokio::spawn(async {
    let (a, b, c) = tokio::join!(fetch_a(), fetch_b(), fetch_c());
    save(a, b, c).await;
});
```

- One container. Tokio sees exactly one task.
- The three fetches interleave on **one thread**. A task cannot split itself.
- Waits for all three; the slowest sets the pace.
- One save with all three results — you can write one transaction.
- The futures are just locals, so no `'static` or `Send` bounds between them. Borrowing a
  `&str` from the surrounding scope works fine.

**B — three spawned tasks, each saves its own**

``` rust
for src in sources {
    tokio::spawn(async move {
        let data = fetch(src).await;
        save(data).await;
    });
}
```

- Three containers. Tokio can put them on three **different threads** — real parallelism.
- Each saves as soon as it's ready. No waiting on the slowest.
- Independent: one panicking doesn't touch the others. But nobody is watching either — drop
  the `JoinHandle`s and you won't learn about failures, and the tasks are killed if the
  runtime shuts down first.
- Everything moved in must be `'static + Send`. No borrowing from the caller. This is where
  `Arc` and `.clone()` start appearing.
- Three separate DB writes. If you needed atomicity, you've lost it.

### When to use which

Ask: **do I need one combined result?**

Fetch-three-then-save is a yes, so design A. Simpler, cheaper, one transaction. Three network
waits interleave fine on one thread — waiting on a socket costs no CPU.

Design B earns its keep when the work is CPU-heavy and you want real parallelism across cores,
or when the jobs are genuinely unrelated and should succeed or fail on their own.

> **Rule of thumb:** `join!` for concurrency, `spawn` for parallelism *and* independence. If
> you spawn and then immediately `join_all` the handles, ask whether you wanted `join!` — you
> may have paid for allocation and `Send` bounds to get nothing back.

## Does spawn mean a separate thread?

No. `spawn` means *eligible* to run on another thread. Not a promise.

The multi-thread runtime starts a fixed set of **worker threads**, by default one per CPU
core. That count is fixed at startup and never grows. Each worker has its own local queue.

When you `spawn` from inside a task, the new task usually lands on **the local queue of the
worker you're already on**. So three spawned tasks may all start on the same thread, running
concurrently there — interleaved at await points, exactly like `join!`.

What spreads them out is **work stealing**: an idle worker looks at a busy worker's queue and
takes half. On a quiet 8-core box, the three probably do land on three threads. On a saturated
machine they might all stay put.

> `spawn` gives concurrency **guaranteed**, parallelism **opportunistic**.

Two corollaries:

- A task can move between threads *between* awaits. That's why spawned futures must be `Send`.
- Under `#[tokio::main(flavor = "current_thread")]` there is one thread and `spawn` never
  gives parallelism at all. Only concurrency.

## Await points are the only yield points

This is the sentence I wish I'd read first.

Tokio is a **cooperative** scheduler. It cannot interrupt a running task. It only regains
control when a task hits an `.await` that returns `Pending` and hands the thread back
voluntarily.

No `.await` returning `Pending` → no yield → the scheduler is helpless.

Which is why a tight CPU loop with no awaits is exactly as harmful as blocking I/O. Same
disease.

## spawn vs spawn_blocking

`std::fs::read_to_string` makes a syscall and the OS puts **the thread** to sleep until the
disk answers. There is no `.await` inside it. Nothing for tokio to hook into.

Compare `tokio::net::TcpStream::read`: it asks the OS "tell me when data is ready," is told
"not yet," and returns `Poll::Pending`. That is the future saying *I'm not done, go run
someone else*. The blocking read cannot say that. It just doesn't return.

### What regular spawn does to you

``` rust
tokio::spawn(async {
    let s = std::fs::read_to_string("big.txt").unwrap();  // 2 seconds
    process(s).await;
});
```

On a 4-core machine — 4 workers:

1. The task lands on worker 2 and starts.
2. It hits the blocking read. Worker 2's thread sleeps in the kernel.
3. Worker 2 is gone for two full seconds. It can't run tasks, can't poll, can't notice.
4. Every task in worker 2's local queue is frozen with it.

You just lost 25% of your runtime. Two things soften it and neither is a fix:

- **Work stealing rescues the queue, not the thread.** Idle workers steal the *pending* tasks
  off worker 2's queue, which helps — but worker 2 itself stays asleep.
- **It's survivable at low volume.** One occasional blocking read on a 16-core box is fine.
  The failure is nonlinear: under load several requests each grab a worker, and at 4-of-4
  blocked your server isn't slow, it's **stopped**. Health checks fail. Nothing polls.

That's what makes this bug nasty. It tests fine and dies in production.

### What spawn_blocking does

``` rust
let s = tokio::task::spawn_blocking(|| {
    std::fs::read_to_string("big.txt").unwrap()
}).await?;
```

The closure goes to a **different pool** — the blocking pool, separate from the core-sized
workers. A thread there sleeps for two seconds and nobody cares; that pool is designed to hold
sleeping threads.

Back on the worker, `spawn_blocking` returns a `JoinHandle` immediately, and `JoinHandle` is a
real future that returns `Pending`. **That is your await point.** The worker yields and goes
off to serve other tasks.

So: you wrap a synchronous, non-yielding operation so that from the async side it looks and
behaves like any other future.

One detail worth knowing — `tokio::fs::read_to_string` exists and looks properly async, but
under the hood it is just `spawn_blocking` around the std call. Convenient, but it isn't doing
anything cleverer.

## Stats: how cheap is "cheap"?

"Cheap" was doing too much work in my head, so — real numbers.

| | Task (`spawn`) | OS thread (`spawn_blocking`) |
|---|---|---|
| Memory | ~64–200 bytes | 2 MB stack *reserved*, ~8–16 KB actually used |
| Creation cost | tens of nanoseconds | ~10–30 microseconds |
| Practical ceiling | millions | thousands |

A thread is roughly **1000× more expensive** than a task. Threads are not cheap in absolute
terms.

The saving grace is that the 2 MB is *virtual* address space — the OS only commits pages you
touch. 512 idle threads cost maybe 8 MB of real RAM, not 1 GB. And tokio reaps threads idle
for more than 10 seconds, so the pool shrinks back.

So "cheap" means **cheap relative to stalling a worker**. Thirty microseconds to spawn a
thread versus two seconds of a dead worker is an obvious trade. It is not free, though —
`spawn_blocking` at 100k/sec would be a bad idea.

Two pool sizes, and why they differ:

- **Worker pool**: one thread per core, fixed. Workers are meant to always be busy, so more
  than one per core just adds context switching.
- **Blocking pool**: grows on demand to ~512 by default, idle threads reaped. Blocking work is
  mostly *waiting*, and a waiting thread costs little.

### When to use spawn_blocking

Rough threshold: **if it might take longer than ~100 microseconds and doesn't await, use
`spawn_blocking`.**

- File I/O, `std::process::Command`, a blocking DB driver, a C binding → `spawn_blocking`
- Image resize, hashing a large buffer, compression → `spawn_blocking` (or Rayon inside it)
- Parsing a small JSON body, a quick hashmap lookup → inline, the overhead isn't worth it

And the caveat: the blocking pool is capped at 512 threads by default. Queue more than that
and they wait. It's a bounded resource, not a magic escape hatch.

## A quick note on Rayon

I asked whether Rayon was the thing I'd been describing. Partly — it's a different tool for a
different problem.

- **Tokio** is for **waiting**. Many tasks, mostly idle on sockets. Concurrency is the point;
  parallelism is a bonus.
- **Rayon** is for **computing**. Take one big CPU-bound job and split it across cores. No
  async, no futures — just threads and work stealing.

``` rust
use rayon::prelude::*;
let total: u64 = numbers.par_iter().map(expensive).sum();
```

Both pools are core-sized and both steal work. The difference is *what* they steal: Rayon
splits a **data range** in half and hands half away; tokio moves **whole tasks**.

They combine. Tokio handles connections; heavy computation gets handed off:

``` rust
let result = tokio::task::spawn_blocking(|| {
    rayon_heavy_computation(data)   // Rayon inside, off the async workers
}).await?;
```

`spawn_blocking` keeps the CPU work off tokio's workers, Rayon spreads it across cores, and
the `.await` lets the rest of the server keep serving.

> **Rule of thumb:** if the thread would be *waiting*, tokio. If it would be *working*, Rayon.
> Never do the second on the first one's threads.

## What I actually took away

- `.await` suspends the task, not the thread.
- A task is one future; that future contains many.
- Futures are lazy. Nothing runs until polled.
- Sequential awaits are sequential. `join!` is what interleaves.
- `spawn` promises concurrency, not parallelism.
- Await points are the only yield points, so blocking code and tight CPU loops both freeze a
  worker.
- `spawn_blocking` isn't free, it's just far cheaper than the alternative.

I still have not read the `Future` trait's `poll` signature closely, or worked out what
`Pin` is really protecting against. That's the next one.
