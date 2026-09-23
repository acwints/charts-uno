"""
Guards against the event-loop stall behind the production 502s.

The API is one uvicorn process on one asyncio loop. A synchronous SDK call
made directly from an ``async def`` freezes every other request — including
Railway's healthcheck — for as long as it runs. These tests pin the two
defences: the helpers really move work off the loop and enforce timeouts, and
no service file calls a blocking SDK method without going through them.
"""

import asyncio
import pathlib
import re
import threading
import time
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from services import blocking
from services import research_service as rs

SERVICES = pathlib.Path(__file__).resolve().parent.parent / "services"


def run(coro):
    return asyncio.run(coro)


class RunBlockingTests(unittest.TestCase):
    def test_work_happens_off_the_event_loop_thread(self) -> None:
        loop_thread = threading.current_thread()
        seen = {}

        def work(x, *, y):
            seen["thread"] = threading.current_thread()
            return x + y

        self.assertEqual(run(blocking.run_blocking(work, 2, y=3, timeout=5)), 5)
        self.assertIsNot(seen["thread"], loop_thread)

    def test_timeout_frees_the_awaiting_request(self) -> None:
        def slow():
            time.sleep(0.5)
            return "late"

        # Measured inside the coroutine: the await must give up at the
        # timeout even though the thread runs on. (asyncio.run() joins the
        # default executor on exit, so a stopwatch around it would include
        # the thread's full 0.5s and measure the wrong thing.)
        async def scenario():
            started = time.monotonic()
            with self.assertRaises(asyncio.TimeoutError):
                await blocking.run_blocking(slow, timeout=0.05)
            return time.monotonic() - started

        self.assertLess(run(scenario()), 0.3)

    def test_generate_content_forwards_kwargs_and_returns_the_response(self) -> None:
        calls = []

        class Models:
            def generate_content(self, **kwargs):
                calls.append(kwargs)
                return SimpleNamespace(text="ok")

        client = SimpleNamespace(models=Models())
        response = run(blocking.generate_content(client, model="m", contents="hello"))
        self.assertEqual(response.text, "ok")
        self.assertEqual(calls, [{"model": "m", "contents": "hello"}])

    def test_query_rows_bounds_the_server_side_wait_and_row_count(self) -> None:
        seen = {}

        class Job:
            def result(self, *, max_results, timeout):
                seen.update(max_results=max_results, timeout=timeout)
                return iter([{"ok": 1}, {"ok": 2}])

        class Client:
            def query(self, sql, *, job_config):
                seen.update(sql=sql, job_config=job_config)
                return Job()

        rows = run(blocking.query_rows(Client(), "SELECT 1", job_config="cfg", max_results=7, timeout=9))
        self.assertEqual(rows, [{"ok": 1}, {"ok": 2}])
        self.assertEqual(seen, {"sql": "SELECT 1", "job_config": "cfg", "max_results": 7, "timeout": 9})


class NoBareBlockingCallsTests(unittest.TestCase):
    """Static guard: a bare sync SDK call on the request path is a regression."""

    FILES = ("ai_service.py", "research_service.py", "public_dataset_service.py")

    def test_every_model_call_is_awaited_or_in_the_known_sync_helper(self) -> None:
        for name in self.FILES:
            src = (SERVICES / name).read_text().splitlines()
            for number, line in enumerate(src, start=1):
                if ".models.generate_content(" not in line:
                    continue
                if ".aio.models.generate_content(" in line:
                    continue  # already async
                if name == "public_dataset_service.py" and "_generate_sql_with_llm" in "\n".join(src[max(0, number - 40):number]):
                    # The one sync helper; its async caller runs it via run_blocking.
                    self.assertIn("await run_blocking(\n            _generate_sql_with_llm", "\n".join(src))
                    continue
                self.fail(f"{name}:{number} calls the model synchronously on the request path: {line.strip()}")

    def test_no_direct_bigquery_result_calls_outside_the_helper(self) -> None:
        for name in self.FILES:
            src = (SERVICES / name).read_text()
            self.assertNotRegex(src, re.compile(r"\.query\([^\n]*\)\.result\("), f"{name} runs BigQuery on the loop")
        self.assertIn("job.result(max_results=max_results, timeout=timeout)", (SERVICES / "blocking.py").read_text())

    def test_every_generate_content_wrapper_call_is_awaited(self) -> None:
        for name in self.FILES:
            for number, line in enumerate((SERVICES / name).read_text().splitlines(), start=1):
                if "generate_content(client, " in line:
                    self.assertIn("await ", line, f"{name}:{number} forgot to await the wrapper")


class DeterministicRaceSqlTests(unittest.TestCase):
    def test_tv_race_prompt_uses_the_known_good_sql_without_asking_the_model(self) -> None:
        def explode():
            raise AssertionError("the model must not be consulted for a TV race prompt")

        with patch.object(rs, "GOOGLE_API_KEY", "set"), patch.object(rs, "_get_client", explode):
            sql = run(rs._generate_bigquery_sql("best tv shows of all time by average rating after each episode"))
        self.assertIsNotNone(sql)
        self.assertIn("title_episode", sql)
        self.assertTrue(rs._is_safe_bigquery_sql(sql))

    def test_other_prompts_still_consult_the_model_off_the_loop(self) -> None:
        loop_thread = threading.current_thread()
        seen = {}

        class Models:
            def generate_content(self, **kwargs):
                seen["thread"] = threading.current_thread()
                return SimpleNamespace(text="SELECT 1 FROM `bigquery-public-data.imdb.title_basics`")

        with patch.object(rs, "GOOGLE_API_KEY", "set"), patch.object(rs, "_get_client", lambda: SimpleNamespace(models=Models())):
            sql = run(rs._generate_bigquery_sql("average imdb rating by year"))
        self.assertEqual(sql, "SELECT 1 FROM `bigquery-public-data.imdb.title_basics`")
        self.assertIsNot(seen["thread"], loop_thread)


if __name__ == "__main__":
    unittest.main()
