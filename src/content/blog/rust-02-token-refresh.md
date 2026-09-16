---
title: "Ten Requests, One Token"
description: "The JS trick of caching a promise doesn't port to Rust — futures are inert. Here's what replaces it."
date: "2026-08-30"
draft: true
tags: ["rust", "async", "javascript"]
---

> This is a learning note. I hit this in JS years ago, ran into it again while writing a
> small Redis-like store in Rust, and worked the Rust side through with Claude.

## The bug, in JS

An auth token expires. Ten requests are in flight. All ten notice at the same moment, all
ten fire a refresh call. You get ten tokens, nine wasted round trips, and — depending on the
provider — nine invalidated tokens racing to overwrite each other.

The fix in JS is three lines. Cache the *promise*, not the token:

```js
let pending = null;

function getToken() {
  if (valid(token)) return Promise.resolve(token);
  if (!pending) {
    pending = fetchToken().finally(() => { pending = null; });
  }
  return pending;
}
```

Everyone awaits the same object. One network call. Done.

## Why that doesn't port

A JS promise is *already running*. `fetchToken()` fires the HTTP request immediately, and
the promise is a handle to work in progress. Handing the same handle to ten callers works
because they're all watching one running job.

A Rust future is inert. Calling an `async fn` does nothing at all — no work starts, no
socket opens. It's a recipe, not a running job. It makes progress only when something
**polls** it, and polling needs exclusive access. One owner.

So "stash the future in a field and hand it to everyone" doesn't compile. And if it did,
nobody would be driving it.

| | JS promise | Rust future |
|---|---|---|
| Starts when | you call the function | something polls it |
| Shared by | handing out the object | needs `Shared` or a spawned task |
| Result | multicast to all `.then`s | delivered to the single poller |

## Shape 1: a lock around the refresh

The one I'd write first. State is `Arc<Mutex<Option<Token>>>`, using **tokio's** `Mutex` —
the std one can't be held across an `await`.

Each caller:

1. Take the lock.
2. Token still valid? Clone it, drop the lock, return.
3. Expired? **Holding the lock**, do the refresh, store the result.

Step 3 is the whole trick. The other nine callers are stuck at step 1. When the winner
releases, each re-runs step 2 — and now the token is fresh, so they just take it. One
network call, same as the promise fix.

That re-check after acquiring the lock is the habit to build. The world changes while you
wait your turn.

## "Doesn't that block everything?"

That was my objection too. It splits into two questions.

**During the refresh, everyone waits.** Yes — and so did the JS version. Ten callers
awaiting one promise are all stopped until it resolves. Identical. You never made anyone
faster; you stopped making nine redundant calls.

**In the happy path, everyone queues on a lock.** This is the part that feels wrong, and the
thing that dissolves it is: *awaiting a tokio `Mutex` does not block a thread.*

A task that can't get the lock is **parked** — set aside, and the thread immediately picks up
other work. Ten thousand waiters cost ten thousand small wakers, not ten thousand threads.
So "blocks all tasks" is true in the sense those tasks can't progress, and false in the sense
that matters for throughput.

And the happy-path critical section is: compare a timestamp, clone an `Arc<str>`, drop the
lock. Tens of nanoseconds. For a queue to form there you'd need contention where the lock is
the least of your problems.

## Shape 2: share the running work

If you want the literal promise semantics, `futures::future::Shared` gives you a clonable
future where every clone awaits one execution and gets a copy of the result. Output must be
`Clone`, so errors usually get wrapped in an `Arc`.

Store `Option<Shared<…>>` behind a mutex, hand out clones, clear the slot on expiry. It
works. There's more bookkeeping — chiefly: if the refresh *fails*, do you hand everyone the
same cached error? (Usually no. Clear it, let someone retry.) Same question the `.finally()`
in the JS version was quietly answering.

## Shape 3: nobody refreshes on the request path

Spawn one task that owns the token, sleeps until just before expiry, refreshes, and
publishes through a `tokio::sync::watch` channel. Callers read the latest value from their
receiver. No lock around I/O, no race, because only one task ever refreshes.

Costs a task for the life of the process, and you need a story for "the server rejected the
token early, refresh now."

## If the lock genuinely bothers you

Put the token in an `arc_swap::ArcSwap` and keep a separate small mutex that only the refresh
path touches:

1. Atomic load. Valid? Return. Never contends, fully parallel.
2. Expired? Take the refresh mutex, re-check the atomic, refresh if still needed, store back.

Contention-free common case, serialization only in the rare expiry window — exactly where
you want it. This is roughly what production HTTP clients do.

## What I'd actually do

Shape 1. Fifteen lines, obvious in six months, genuinely correct. Move to `ArcSwap` when you
measure a reason to.

One gotcha regardless: don't hold a `std::sync::Mutex` across an `.await`. The compiler
usually stops you — the guard isn't `Send` — but the reason is worth knowing. A blocking
mutex held while a task is parked stalls the whole executor thread.
