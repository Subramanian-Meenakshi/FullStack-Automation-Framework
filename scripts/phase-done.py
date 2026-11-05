#!/usr/bin/env python3
"""Mark Phase N complete in Sandhata Employee Portal.md.

Flips the phase's Status block and updates section 16 (status list + next action).
Usage: python3 scripts/phase-done.py <N>
"""
import re
import sys
from pathlib import Path

MD = Path(__file__).resolve().parent.parent / "Sandhata Employee Portal.md"

TITLES = {
    4: "Auth Service", 5: "Employee CRUD", 6: "Correlation ID",
    7: "Audit Logging", 8: "Redis Cache", 9: "Kafka Producer",
    10: "Kafka Consumer", 11: "LocalStack S3 Integration",
    12: "React Portal", 13: "Playwright Framework",
    14: "Prometheus Grafana Observability",
    15: "Reports Optimisation, Cleanup and README",
    16: "CI/CD (GitHub Actions)",
}


def fail(msg: str) -> None:
    print(f"FAIL {msg}")
    sys.exit(1)


def main() -> None:
    if len(sys.argv) != 2 or not sys.argv[1].isdigit():
        fail("usage: phase-done.py <N>")
    n = int(sys.argv[1])
    if n not in TITLES:
        fail(f"phase {n} not supported (4-16)")

    text = MD.read_text(encoding="utf-8")
    changed = []

    # 1. flip Status inside "## Phase N" section (last match wins)
    heading = f"## Phase {n}"
    starts = [m.start() for m in re.finditer(re.escape(heading), text)]
    if not starts:
        fail(f"'{heading}' not found")
    start = starts[-1]
    end = text.find("\n---", start)
    if end == -1:
        end = len(text)
    section = text[start:end]

    if "Status:\n\nCOMPLETE" in section:
        changed.append(f"phase{n}.status already COMPLETE")
    elif "Status:\n\nNOT STARTED" in section:
        section = section.replace("Status:\n\nNOT STARTED", "Status:\n\nCOMPLETE", 1)
        text = text[:start] + section + text[end:]
        changed.append(f"phase{n}.status -> COMPLETE")
    else:
        fail(f"no Status block found in {heading} section")

    # 2. section 16: ensure "Phase N / COMPLETE" exists before Current blockers
    m = re.search(r"(?=Current blockers:)", text)
    if not m:
        fail("section 16 'Current blockers:' not found")
    ins = m.start()
    block = f"Phase {n}\n\nCOMPLETE\n\n"
    if re.search(rf"Phase {n}\n\nCOMPLETE", text):
        changed.append(f"sec16.phase{n} already listed")
    else:
        text = text[:ins] + block + text[ins:]
        changed.append(f"sec16 +Phase {n} COMPLETE")

    # 3. next action line
    if n >= 16:
        new_action = "All phases complete."
    else:
        new_action = f"Begin Phase {n + 1} {TITLES[n + 1]}."
    updated, count = re.subn(
        r"(Next action:\n\n)[^\n]+", lambda mm: mm.group(1) + new_action, text, count=1
    )
    if count != 1:
        fail("Next action line not found")
    text = updated
    changed.append(f"next_action -> {new_action}")

    MD.write_text(text, encoding="utf-8")
    for c in changed:
        print(f"OK {c}")
    print(f"RESULT {MD.name}")


if __name__ == "__main__":
    main()
