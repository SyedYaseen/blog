---
title: "Exit Codes Don't Lie"
description: "Building graceful shutdown into a tokio TCP server, one wrong turn at a time"
date: "2026-08-29"
tags: ["rust", "async", "linux"]
---

> This is a learning experiment. I was writing a small Redis-like store to learn Rust,
> worked the problem through with Claude, and the findings here were written up as a blog
> post with its help. The code, the bugs, and the terminal output are from my actual session.

I asked what looked like a trivia question — should a cancelled server exit non-zero? — and
ended up rewriting my shutdown path five times. Here is every step, including the ones that
were wrong.

## The question

My server had no shutdown path at all. Ctrl-C killed it mid-write. So: when a cancellation
request arrives, do I exit with a non-zero code, or something else?

The answer turned out to be less about codes and more about who is reading them.

## Exit codes are a contract

The exit code is read by whatever supervises the process — your shell, systemd, Docker,
Kubernetes, a CI job. They all interpret it the same way:

| Code | What the supervisor concludes |
|---|---|
| `0` | Did what it was asked, stopped cleanly |
| non-zero | Broke — restart it, alert, mark the build red |

A SIGTERM *is an instruction*. If you caught it, drained connections and flushed state, you
obeyed it. That is `0`. Exiting non-zero there makes systemd log a unit failure and
restart-loop you, and makes Kubernetes count a crash for doing exactly what the SIGTERM asked.

Non-zero is right in four cases: the drain hit its timeout and you abandoned in-flight work;
persistence failed on the way out; shutdown was triggered by a fatal error rather than a
request; or the operator hit Ctrl-C a second time to say stop being polite.

**The wrinkle.** If you *don't* trap the signal, the kernel kills you and the shell reports
`128 + signum` — `130` for SIGINT, `143` for SIGTERM. Some CLI tools deliberately reproduce
this by restoring the default handler and re-raising. For a server that intentionally
intercepts SIGTERM to drain, plain `0` is the norm; systemd's default `SuccessExitStatus`
even treats a SIGTERM death as success.

## Three unrelated things called "cancel"

Worth separating before touching any code. Only the last one involves an exit code at all.

1. **A request or connection ends.** The client hangs up. Break the connection loop, drop the
   socket. Nothing global happens.
2. **An admin kills one connection** (Redis `CLIENT KILL`). Same thing, triggered elsewhere.
3. **The whole process shuts down.** Signal-driven. This is the only one where the exit code
   is a question.

---

I started from a deliberately naive echo server: accept, spawn, loop forever, with a sleep
standing in for real work so a mid-response shutdown would be visible.

## 1. Catching the signal, and a hot loop

First attempt at racing the signal against `accept()`. It compiled. It also printed several
hundred lines a second.

``` rust
tokio::select! {
    _ = tokio::signal::ctrl_c() => { println!("Shutting down...") }

    // this branch never waits for anything
    _ = async { tokio::signal::unix::SignalKind::terminate() } => {
        println!("Terminating down...")
    }
    ...
}
```

`SignalKind::terminate()` only builds a value that *names* the signal. Nothing listens. The
async block finishes instantly, so the branch is always ready and `select!` fires it forever.

```text
listening on 6871 (pid 29656)
Terminating down...
Terminating down...
Terminating down...
... ~400 lines/sec
```

The real API has two steps: register a handler once, then await it. And it has to be built
*outside* the loop, or you re-register on every iteration.

``` rust
let mut sigterm = signal(SignalKind::terminate())?;   // registers with the OS
let mut sigint  = signal(SignalKind::interrupt())?;

loop {
    tokio::select! {
        _ = sigint.recv()  => { c_tkn.cancel(); break; }
        _ = sigterm.recv() => { c_tkn.cancel(); break; }
        ...
    }
}
```

`tokio::signal::ctrl_c()` is the odd one out — a one-shot helper you call and await. Using
`signal(SignalKind::interrupt())` instead makes both signals work the same way, and pays off
later.

## 2. The branch pattern that swallows errors

My accept branch started out like this, which looks perfectly idiomatic:

``` rust
Ok((socket, addr)) = listener.accept() => { /* spawn */ }
```

That is a *refutable* pattern — one that some values fail to match. Most of Rust forbids
refutable patterns where there is no "otherwise" branch; that is why `let Ok(v) = res;` will
not compile. `select!` allows them, and does something surprising on a non-match: it
**silently disables that branch**. If every branch ends up disabled it panics. Either way the
`Err` vanishes with no message.

The fix is to bind irrefutably and match inside the handler, where ordinary Rust rules apply:

``` rust
res = listener.accept() => {
    match res {
        Ok((socket, addr)) => {
            let token = c_tkn.clone();
            tracker.spawn(async move { handle_conn(socket, token).await });
        }
        Err(e) => eprintln!("accept failed: {}", e),
    }
}
```

Refutable patterns are right when "didn't match" means "this branch is done forever" —
`Some(x) = rx.recv()`, where `None` means the channel closed. An `accept()` error is
transient, so it needs logging, not silence.

Related: accept errors should not bubble up with `?`. They fail per-connection and
transiently — `ECONNABORTED` when a client vanishes during the handshake, `EMFILE` when you
are out of file descriptors. Killing the server because one client disappeared is wrong. A
failed `bind` at startup is the opposite, and should propagate.

## 3. Cancelling at the right moment

Each connection task gets a clone of a `CancellationToken` and races it against the read. The
subtle part is *where* the race goes.

``` rust
// The cancel can only win *here*, while we are waiting for the next line.
// Once read_line hands us bytes we owe the client a reply, so the work and
// the write happen inside the branch where nothing can interrupt them.
tokio::select!(
    biased;
    _ = c_tkn.cancelled() => {
        println!("Task is cancelled");
        break;
    }
    res = reader.read_line(&mut line) => {
        match res {
            Ok(0) => break,                                       // peer hung up
            Ok(_) => {
                tokio::time::sleep(Duration::from_secs(5)).await;  // stand-in for work
                writer.write_all(line.as_bytes()).await?;
            }
            Err(e) => { eprintln!("read failed: {}", e); break; }
        }
    }
);
```

The rule: cancel at a frame boundary. Race the *read*, not the whole loop body. Put the cancel
around the work and you cut clients off mid-response, which is worse than not draining at all.

`biased;` makes `select!` poll arms top to bottom instead of in random order, so when a line is
buffered *and* the token is cancelled, cancel always wins. Without it, shutdown behaviour
varies run to run. It has a cost — an always-ready top arm would starve the ones below — but
signals are rare, so it is safe here.

**Cancel safety.** `read_line` is *not* cancel-safe. When the cancel arm wins, `select!` drops
the half-finished read and any bytes it had already pulled off the socket are gone, with `line`
possibly holding a partial line. Fine here, since the connection is closing anyway. If you need
cancel-safe line reading, that is `tokio_util::codec::Framed` with `LinesCodec`.
`AsyncReadExt::read_buf` *is* cancel-safe, which is why the buffer-and-decode loop in my actual
server survives being raced.

## 4. A compiler error that was actually good news

Adding `break` to the signal arms immediately broke the build:

```text
error[E0308]: expected `Result<(), Error>`, found `()`
```

Before the `break`, the loop could never finish, so it never produced a value. Rust gives that
case a free pass: an expression that never completes has type `!` and can stand in for
anything, including `Result`. Adding `break` ended the free pass. Now the loop finishes,
produces `()`, and that is what `main` returns.

The fix is a value after the loop — and it is the whole thesis of the post in one line:

``` rust
    }  // end of accept loop

    Ok(())   // reaching here means we shut down cleanly: exit 0
```

The errors point at `#[tokio::main]` and mention an "async block", because that attribute
rewrites `main` and wraps the body. When an error blames `#[tokio::main]`, check your own
return type first.

## 5. Exiting 0 while dropping work on the floor

At this point it compiled and looked finished. I tested it with a request in flight — client
connected, line sent, server mid-work — then sent SIGTERM:

```text
accepted 127.0.0.1:54852
Terminating...
client got: b''          <- no echo, socket just closed
exit code: 0             <- "I shut down cleanly"
```

That is the failure this whole exercise is about. `main` broke out of the loop, hit `Ok(())`,
and the process exited while the connection task was still working. The client never got its
reply, and the server reported success.

The missing piece is a barrier: stop accepting, then *wait*. `tokio_util::task::TaskTracker`
does exactly that.

``` rust
let tracker = TaskTracker::new();

// ... in the accept arm:
tracker.spawn(async move { handle_conn(socket, token).await });

// ... after the loop:
tracker.close();          // "no more tasks are coming" -- without this, wait() hangs
tracker.wait().await;     // returns when the last task finishes
```

`close()` is not optional. Without it the tracker keeps expecting new work and `wait()` never
returns.

Same test, now:

```text
Terminating...
Task is cancelled
client got: b'hello\n'    <- the reply it owed
exit code: 0 | drain took 1.8s
```

## 6. What TaskTracker actually stores

I assumed it kept a list of `JoinHandle`s. It does not. The entire struct, in tokio-util
0.7.19:

``` rust
struct TaskTrackerInner {
    state: AtomicUsize,   // lowest bit = closed flag, rest = number of live tasks
    on_last_exit: Notify,
}
```

`tracker.spawn(fut)` wraps your future so it carries a token, calls `tokio::spawn`, and hands
the `JoinHandle` back to *you*. When the task ends the token drops, the count falls, and if it
hits zero *and* the closed bit is set, `Notify` wakes whoever is in `wait()`. Memory is
constant at 3 connections or 300,000.

Two values share one integer: the number is `count * 2 + (closed ? 1 : 0)`.

| Value | Binary | Meaning |
|---|---|---|
| 0 | 000 | open, 0 tasks |
| 1 | 001 | closed, 0 tasks |
| 4 | 100 | open, 2 tasks |
| 5 | 101 | closed, 2 tasks |

``` rust
fn add_task(&self)   { self.state.fetch_add(2, Relaxed); }   // count + 1
fn drop_task(&self)  { self.state.fetch_sub(2, Release); }   // count - 1
fn set_closed(&self) { self.state.fetch_or(1, AcqRel); }     // set the flag
fn set_open(&self)   { self.state.fetch_and(!1, AcqRel); }   // clear the flag
```

`+2` adds one task because the count starts one bit up. `|1` sets the flag without touching
the count.

Why pack them? Because shutdown is one *combined* question: is the count zero *and* is it
closed? With two separate atomics you could read "count is 0", and before you read the flag
another thread spawns a task — waking the waiter while work is still running. One packed value
answers both halves in a single indivisible operation. The source leans on that directly:

``` rust
let state = self.state.fetch_sub(2, Ordering::Release);
if state == 3 { self.notify_now(); }
```

`fetch_sub` returns the value from *before* the subtraction. `3` is `011` — closed flag set,
count of 1. "It was exactly 3" means "I was the last task, and we are closed." One integer
comparison decides it.

This also explains an API detail I would have found puzzling otherwise: `spawn()` and `close()`
take `&self`, not `&mut self`, because an atomic can be mutated through a shared reference.
That is why a tracker can be cloned and handed around, and `CancellationToken` works the same
way. Meanwhile `sigterm.recv()` does need `&mut self`, which is why one of my locals needed
`mut` and the other did not.

Versus `JoinSet`: that is the one that owns the handles. It returns each task's value from
`join_next()` and aborts everything when dropped, but requires a single shared output type. For
connection-per-task work returning `()`, where you only need the drain barrier, `TaskTracker`
is the better fit.

## 7. The deadline, and the first honest non-zero

`tracker.wait()` waits forever. One stuck connection — a client that stops reading until your
write buffer fills — and shutdown never completes. So it needs a deadline, and the deadline is
where the first legitimate non-zero code appears.

``` rust
tracker.close();
tokio::time::timeout(Duration::from_secs(15), tracker.wait()).await?;
Ok(())
```

`timeout` yields `Result<_, Elapsed>`, and `Elapsed` converts into `io::Error` as
`ErrorKind::TimedOut` — so plain `?` works, and a blown deadline exits 1.

```text
Terminating...
Error: Kind(TimedOut)
exit code: 1 after 2.0s
```

That `Error: Kind(TimedOut)` line is `main`'s `Termination` impl printing the error's `Debug`.
Ugly, but it is the normal fatal path.

## 8. The second Ctrl-C that did nothing at all

One case was still missing. During a long drain, what happens if the operator hits Ctrl-C
again? I tested it with a 30-second deadline and 20 seconds of work:

```text
Terminating...
>>> sending SIGINT during the drain   (nothing)
>>> sending another SIGINT            (nothing)
>>> alive? True
>>> had to SIGKILL it
```

Completely ignored. Two reasons, and the second one is the important one.

`select!` is an expression, not a background listener. While it is being polled it holds one
future per arm; when a branch wins and you `break`, the expression is over and **all of those
futures are dropped**, including `sigint.recv()`. The variable is still alive, but nobody is
calling `.recv()` on it, so nobody looks.

And registering a handler **replaces** the default "kill the process" behaviour. Before the
program touched signals, Ctrl-C killed it. After, the signal is yours to handle — and if you do
not, it is swallowed. That is why SIGKILL was the only way out.

The fix races the *drain* against another signal. Not inside the signal branch — that branch is
over in microseconds; the drain is the thing that takes 15 seconds.

``` rust
tracker.close();

tokio::select! {
    _ = sigint.recv() => {
        println!("Force shut down. Abandoning inflight work.");
        process::exit(130);
    }
    res = tokio::time::timeout(Duration::from_secs(15), tracker.wait()) => {
        res?
    }
}

Ok(())
```

Same `sigint`, still in scope, still registered — the payoff for building it once outside the
loop. `process::exit` never returns, so its type is `!` and the arm does not need to match the
other arm's type. It also skips destructors, which here is the point. `130` is `128 + 2`, the
conventional "died by SIGINT".

**The bug I nearly shipped.** My first version of that arm just printed a message. The
`select!` then ended and fell through to `Ok(())` — so force-quitting mid-work exited **0**. A
false `1` causes a needless restart; a false `0` hides dropped work. The second is worse.

## Testing it

This is harder to test by hand than it looks. Shutdown behaviour only differs when a client is
connected *with work in flight* at the instant the signal lands — otherwise every path exits 0
immediately and everything looks fine.

My first attempt failed for an unrelated reason: I backgrounded the client with
`nc 127.0.0.1 6871 &`. A background job cannot read the keyboard, so the line I typed never
arrived, so there was never any work to drain. I replaced the whole thing with a Python
harness — standard library only, no `nc`, no bash.

``` python
def run(case, sig):
    server = subprocess.Popen([BIN])
    time.sleep(0.5)

    client = None
    if case != "idle":
        client = socket.create_connection(ADDR)
        client.settimeout(20)
        if case in ("busy", "force"):
            client.sendall(b"hello\n")   # starts the server's fake 5s of work
        time.sleep(0.3)

    started = time.time()
    server.send_signal(getattr(signal, f"SIG{sig}"))

    if case == "force":
        time.sleep(1.0)
        server.send_signal(signal.SIGINT)   # impatient operator

    code = server.wait(timeout=30)
    reply = client.recv(64) if client else None
    print(f"exit {code} after {time.time()-started:.1f}s | client got {reply!r}")
```

The client-side `recv` is the part that matters. The exit code tells you what the server
*claims*; the reply tells you whether it was true.

```text
===== idle =====     no client at all
exit 0   after 0.0s   client None

===== quiet =====    connected, never sent a request
Task is cancelled
exit 0   after 0.0s   client b''

===== busy =====     request in flight
Task is cancelled
exit 0   after 4.7s   client b'hello\n'

===== force =====    second SIGINT mid-drain
Force shut down. Abandoning inflight work.
exit 130 after 1.0s   client b''
```

`quiet` proves cancellation reaches a parked connection. `busy` proves the drain actually waits
and delivers. `force` proves the impatient path reports honestly. Dropping the deadline below
the work time gives the fourth outcome, exit 1.

## What I would tell myself at the start

1. **A requested shutdown is a success.** Exit 0. Non-zero is for abandoning work, not for
   being asked to stop.
2. **Handle SIGTERM, not just Ctrl-C.** Docker and Kubernetes send SIGTERM. Handle only SIGINT
   and production never drains — it just gets SIGKILLed thirty seconds later.
3. **Cancel at a frame boundary.** Race the read, not the whole loop body, or you cut clients
   off mid-response.
4. **Bind irrefutably in `select!`.** A refutable pattern disables the branch on a non-match
   and eats your error.
5. **Every wait needs a deadline.** `tracker.wait()` alone hangs forever on one stuck
   connection.
6. **Registering a handler disarms the default.** Once you own a signal, ignoring it means the
   process cannot be stopped that way at all.
7. **Test with work in flight.** Every shutdown path looks correct when there is nothing to
   drain.

Versions: tokio 1.53.1, tokio-util 0.7.19.
