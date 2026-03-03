from collections import defaultdict, deque
from time import time


class SlidingWindowRateLimiter:
    def __init__(self) -> None:
        self._buckets: dict[str, deque[float]] = defaultdict(deque)

    def is_allowed(self, key: str, window_seconds: int, max_requests: int) -> bool:
        now = time()
        bucket = self._buckets[key]
        floor = now - window_seconds
        while bucket and bucket[0] < floor:
            bucket.popleft()

        if len(bucket) >= max_requests:
            return False

        bucket.append(now)
        return True


rate_limiter = SlidingWindowRateLimiter()
