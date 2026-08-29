---
title: "LeetCode 735: Asteroid Collision"
description: "Working the collision rules out on a stack, in C++"
date: "2025-12-16"
tags: ["algorithms", "cpp"]
---

## Intuition

A collision happens under exactly one condition: the asteroid already in flight
is moving right (positive) and the incoming one is moving left (negative).
Every other pairing — both right, both left, or left-then-right — means the two
are moving apart and will never meet.

That asymmetry is what makes this a stack problem. A surviving right-moving
asteroid stays a candidate for collision with everything that comes after it,
and it is always the *most recent* one that gets hit first. Last in, first out.

## Approach

Walk the array once, holding survivors on a stack.

1. While the stack is non-empty, the top is positive, and the incoming asteroid
   is negative — the two collide. Compare sizes via their sum, since the signs
   are already opposite:
   - **sum < 0** — the incoming one is bigger. Pop the top and loop again; the
     same incoming asteroid may destroy several in a row.
   - **sum > 0** — the one on the stack is bigger. Set `i = 0` to mark the
     incoming asteroid as destroyed.
   - **sum == 0** — equal size, both explode. Pop the top and set `i = 0`.
2. After the loop, push `i` if it is non-zero.

Using `0` as the "destroyed" marker works because the problem guarantees no
asteroid has size zero, so the value is free to reuse as a sentinel. It also
falls out neatly: `0` terminates the `while` (it is not negative) and fails the
push check on the way out.

The single pass with each asteroid pushed and popped at most once gives O(n)
time and O(n) space.

## Code

```cpp
class Solution {
public:
    vector<int> asteroidCollision(vector<int>& asteroids) {
        vector<int> st={};

        for (int i: asteroids) {
            while (!st.empty() && i < 0 && st.back() > 0) {
                int diff = st.back() + i;
                if (diff<0) {
                    st.pop_back();
                } else if (diff>0) {
                    i=0;
                } else {
                    i=0; st.pop_back();
                }
            }

            if (i != 0) {
                st.push_back(i);
            }
        }

        return st;
    }
};
```

A `vector` rather than a `std::stack` here — the answer has to be returned in
order, and `vector` gives you `push_back`/`pop_back`/`back` for the stack
behaviour while already being the return type.
