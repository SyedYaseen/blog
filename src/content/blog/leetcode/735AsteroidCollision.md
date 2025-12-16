# Intuition
1. Collision will happen only if last ast on arr is +ve and incoming is -ve.

# Approach
1. Add items to stack after the loop.
2. Iterate and check if stack has elements, top is +ve and incoming -ve
3. If diff 
    1. +ve, incoming broken, set i=0, as temp var for tracking
    2. -ve, top of stack broken, remove that, i is already value to be inserted/ compared with next top stack item in next iter.
    3. if 0, both stack pop, i=0
4. if i not 0, insert to stack. 

# Code
```cpp []
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
