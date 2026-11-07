#!/usr/bin/env python3
"""bb_mcp: MCP server for the BB (PCB Kaardistaja) repository.

Shared by Claude Code, Codex and Gemini CLI so that every assistant gets the same
project view: live status, document outline and sections, search, documentation
checks, decisions, and a review inbox.

Transport: stdio (newline-delimited JSON-RPC 2.0). Standard library only, Python 3.10+.
All tools are read-only except `bb_submit_review`, which only creates a new file under
docs/review/inbox/ and never overwrites anything.
"""
from __future__ import annotations

import datetime as _dt
import fnmatch
import json
import os
import re
import subprocess
import sys
import traceback
from pathlib import Path
from typing import Any, Callable

SERVER_NAME = "bb_mcp"
SERVER_VERSION = "0.1.0"
SUPPORTED_PROTOCOLS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"]
CHAR_LIMIT = 25_000

ROOT = Path(os.environ.get("BB_ROOT") or Path(__file__).resolve().parents[2]).resolve()
INBOX = ROOT / "docs" / "review" / "inbox"

# Files that keep old wording on purpose (history, superseded plans, review packets).
HISTORICAL_GLOBS = ["docs/superpowers/*", "docs/adr/ADR-001-*", "docs/review/*"]
DEFAULT_STALE_TERMS = [
    "evidenceId", "src/core", "src/modules", "AppModule", "beginTransaction", "TxHandle",
    "CONTRACT_VERSION", "HOST_API_VERSION", "journal_mode=WAL", "ProjectStore", "asset-protokoll",
]
VERDICTS = ["JAH", "JAH, PÄRAST PARANDUSI", "EI"]

INSTRUCTIONS = (
    "BB is a local PCB mapping and repair desktop app (TypeScript + Tauri), currently in the "
    "documentation stage. Documents are in Estonian. Start with bb_status, then bb_list_docs, and "
    "read only the sections you need with bb_outline and bb_read_section. Run bb_check_docs after "
    "editing docs. External reviewers file findings with bb_submit_review."
)


# --------------------------------------------------------------------------- helpers


class ToolError(Exception):
    """Error shown to the model as a tool result with isError = true."""


def rel(path: Path) -> str:
    return path.resolve().relative_to(ROOT).as_posix()


def md_files(include_superpowers: bool = True) -> list[Path]:
    files = sorted(p for p in ROOT.glob("*.md") if p.is_file())
    files += sorted(p for p in (ROOT / "docs").rglob("*.md") if p.is_file())
    files += sorted(p for p in (ROOT / "tools").rglob("README.md") if ".venv" not in p.parts)
    if not include_superpowers:
        files = [p for p in files if "superpowers" not in p.parts]
    return files


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def is_historical(relpath: str) -> bool:
    return any(fnmatch.fnmatch(relpath, g) for g in HISTORICAL_GLOBS)


def slug(title: str) -> str:
    """GitHub-style heading anchor."""
    s = title.strip().lower()
    s = re.sub(r"[^\w\- ]", "", s)
    return s.replace(" ", "-")


def headings(text: str) -> list[dict[str, Any]]:
    out, in_fence = [], False
    for no, line in enumerate(text.splitlines(), start=1):
        if line.lstrip().startswith("```"):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        m = re.match(r"^(#{1,6})\s+(.*?)\s*#*\s*$", line)
        if m:
            out.append({"level": len(m.group(1)), "title": m.group(2), "anchor": slug(m.group(2)), "line": no})
    return out


def resolve_doc(name: str) -> Path:
    """Accepts '03', '03-arhitektuur', 'docs/03-arhitektuur.md', 'ADR-003', 'STATUS', 'AGENTS'."""
    raw = name.strip().replace("\\", "/").lstrip("./")
    if not raw:
        raise ToolError("Empty document name. Call bb_list_docs to see valid names.")
    files = md_files()
    by_rel = {rel(p).lower(): p for p in files}
    key = raw.lower()
    for candidate in (key, key + ".md", "docs/" + key, "docs/" + key + ".md"):
        if candidate in by_rel:
            return by_rel[candidate]
    stem_hits = [p for p in files if p.stem.lower().startswith(Path(key).stem.lower())]
    if len(stem_hits) == 1:
        return stem_hits[0]
    hits = stem_hits or [p for p in files if key in rel(p).lower()]
    if len(hits) == 1:
        return hits[0]
    if not hits:
        raise ToolError(f"No document matches '{name}'. Call bb_list_docs to see valid names.")
    listing = ", ".join(rel(p) for p in hits[:15])
    raise ToolError(f"'{name}' matches several documents: {listing}. Use the full path.")


def clip(text: str, limit: int = CHAR_LIMIT) -> str:
    if len(text) <= limit:
        return text
    return text[:limit] + f"\n\n[Truncated at {limit} characters. Narrow the request (heading, limit or query).]"


def git(*args: str) -> str:
    try:
        res = subprocess.run(["git", "-C", str(ROOT), *args], capture_output=True, text=True,
                             encoding="utf-8", errors="replace", timeout=10)
    except (OSError, subprocess.TimeoutExpired) as exc:
        return f"(git unavailable: {exc})"
    if res.returncode != 0:
        return f"(git error: {res.stderr.strip().splitlines()[0] if res.stderr.strip() else res.returncode})"
    return res.stdout.strip()


# --------------------------------------------------------------------------- tools


def tool_status(_: dict[str, Any]) -> str:
    status_out = git("status", "--porcelain=v1", "-b")
    head = git("log", "-1", "--format=%h %s (%cs)")
    if status_out.startswith("(git"):
        header, changes = status_out, []
    else:
        branch_line = status_out.splitlines()
        header = branch_line[0].removeprefix("## ") if branch_line else "(no git info)"
        changes = branch_line[1:]
    parts = ["# BB status", "", "## Git (live)", f"- Branch: `{header}`", f"- HEAD: {head}",
             f"- Changed or untracked paths: {len(changes)}"]
    parts += [f"  - `{c}`" for c in changes[:60]]
    if len(changes) > 60:
        parts.append(f"  - … and {len(changes) - 60} more")
    status_file = ROOT / "docs" / "STATUS.md"
    parts += ["", "## docs/STATUS.md (written by people and assistants; verify against git)", ""]
    parts.append(read_text(status_file) if status_file.exists() else "(docs/STATUS.md is missing)")
    return clip("\n".join(parts))


def tool_list_docs(args: dict[str, Any]) -> str:
    rows = ["| Path | Title | Lines | Status | Sections |", "|---|---|---|---|---|"]
    for path in md_files(include_superpowers=args.get("include_superpowers", False)):
        text = read_text(path)
        hs = headings(text)
        title = next((h["title"] for h in hs if h["level"] == 1), path.stem)
        status = ""
        m = re.search(r"^\*\*Staatus:\*\*\s*(.+)$", text, re.M)
        if m:
            status = m.group(1).strip()
        elif text.lstrip().startswith(">") and "ASENDATUD" in text[:400]:
            status = "ASENDATUD"
        rows.append(f"| `{rel(path)}` | {title} | {len(text.splitlines())} | {status} | "
                    f"{sum(1 for h in hs if h['level'] == 2)} |")
    return clip("\n".join(rows))


def tool_outline(args: dict[str, Any]) -> str:
    path = resolve_doc(args["doc"])
    hs = headings(read_text(path))
    if not hs:
        return f"`{rel(path)}` has no headings."
    lines = [f"# Outline of `{rel(path)}`", ""]
    lines += [f"{'  ' * (h['level'] - 1)}- {h['title']}  (`#{h['anchor']}`, line {h['line']})" for h in hs]
    return clip("\n".join(lines))


def tool_read_section(args: dict[str, Any]) -> str:
    path = resolve_doc(args["doc"])
    text = read_text(path)
    limit = args.get("max_chars", 12_000)
    heading = (args.get("heading") or "").strip()
    if not heading:
        return clip(f"# `{rel(path)}` (whole document)\n\n{text}", limit)
    hs = headings(text)
    want = heading.lstrip("#").strip()
    exact = [h for h in hs if h["anchor"] == slug(want) or h["title"].lower() == want.lower()]
    hits = exact or [h for h in hs if want.lower() in h["title"].lower()]
    if not hits:
        raise ToolError(f"No heading matching '{heading}' in {rel(path)}. Call bb_outline to see headings.")
    if len(hits) > 1 and not exact:
        names = "; ".join(h["title"] for h in hits[:10])
        raise ToolError(f"'{heading}' matches several headings in {rel(path)}: {names}. Be more specific.")
    h = hits[0]
    lines = text.splitlines()
    end = len(lines)
    for other in hs:
        if other["line"] > h["line"] and other["level"] <= h["level"]:
            end = other["line"] - 1
            break
    body = "\n".join(lines[h["line"] - 1:end]).rstrip()
    return clip(f"`{rel(path)}` lines {h['line']}–{end}\n\n{body}", limit)


def tool_search(args: dict[str, Any]) -> str:
    query = args["query"]
    limit = args.get("limit", 30)
    flags = 0 if args.get("case_sensitive") else re.IGNORECASE
    try:
        pattern = re.compile(query if args.get("regex") else re.escape(query), flags)
    except re.error as exc:
        raise ToolError(f"Invalid regex: {exc}. Set regex=false for a plain text search.") from exc
    scope = args.get("scope", "docs")
    files = md_files(include_superpowers=scope == "all")
    if scope == "docs":
        files = [p for p in files if rel(p).startswith("docs/")]
    elif scope not in ("all", "docs"):
        files = [p for p in files if fnmatch.fnmatch(rel(p), scope)]
    results, total = [], 0
    for path in files:
        current = ""
        in_fence = False
        for no, line in enumerate(read_text(path).splitlines(), start=1):
            if line.lstrip().startswith("```"):
                in_fence = not in_fence
            m = None if in_fence else re.match(r"^#{1,6}\s+(.*)$", line)
            if m:
                current = m.group(1).strip()
            if pattern.search(line):
                total += 1
                if len(results) < limit:
                    snippet = line.strip()
                    if len(snippet) > 220:
                        snippet = snippet[:217] + "…"
                    results.append(f"- `{rel(path)}:{no}` [{current or '—'}] {snippet}")
    if not results:
        return f"No matches for '{query}' (scope: {scope})."
    head = f"{total} matches for '{query}' (scope: {scope})"
    if total > len(results):
        head += f", showing first {len(results)}; raise limit or narrow the query"
    return clip(head + "\n\n" + "\n".join(results))


def tool_check_docs(args: dict[str, Any]) -> str:
    terms = args.get("stale_terms") or DEFAULT_STALE_TERMS
    include_hist = args.get("include_historical", False)
    files = md_files(include_superpowers=False)
    anchors_cache: dict[Path, set[str]] = {}
    issues: list[str] = []

    def anchors(p: Path) -> set[str]:
        if p not in anchors_cache:
            anchors_cache[p] = {h["anchor"] for h in headings(read_text(p))}
        return anchors_cache[p]

    for path in files:
        text = read_text(path)
        r = rel(path)
        if text.count("```") % 2:
            issues.append(f"`{r}`: unbalanced code fence (```)")
        # Mermaid sequence diagrams: ';' inside a message ends the statement and breaks parsing.
        for block in re.finditer(r"```mermaid\n(.*?)```", text, re.S):
            body = block.group(1)
            if body.lstrip().startswith("sequenceDiagram"):
                start = text[:block.start()].count("\n") + 2
                for off, line in enumerate(body.splitlines()):
                    if re.search(r"-[->]*>>?[^:]*:.*;", line):
                        issues.append(f"`{r}:{start + off}`: ';' in a Mermaid sequence message breaks parsing")
        prose = re.sub(r"```.*?```", lambda m: "\n" * m.group(0).count("\n"), text, flags=re.S)
        for m in re.finditer(r"\]\(([^)\s#]*)(#[^)\s]+)?\)", prose):
            target, anchor = m.group(1), m.group(2)
            if target.startswith(("http://", "https://", "mailto:")):
                continue
            line_no = prose[:m.start()].count("\n") + 1
            dest = (path.parent / target).resolve() if target else path
            if not dest.exists():
                issues.append(f"`{r}:{line_no}`: missing link target `{target}`")
                continue
            if anchor and dest.suffix == ".md" and anchor[1:] not in anchors(dest):
                issues.append(f"`{r}:{line_no}`: missing anchor `{target}{anchor}`")
        if include_hist or not is_historical(r):
            for no, line in enumerate(text.splitlines(), start=1):
                for term in terms:
                    if term in line:
                        issues.append(f"`{r}:{no}`: stale term `{term}`")
    header = (f"Checked {len(files)} Markdown files (links, anchors, code fences, Mermaid sequence "
              f"messages, {len(terms)} stale terms; historical files "
              f"{'included' if include_hist else 'skipped for stale terms'}).")
    if not issues:
        return header + "\n\nNo problems found."
    shown = issues[:200]
    more = f"\n- … and {len(issues) - 200} more" if len(issues) > 200 else ""
    return clip(f"{header}\n\n{len(issues)} problems:\n" + "\n".join(f"- {i}" for i in shown) + more)


def tool_decisions(_: dict[str, Any]) -> str:
    lines = ["# Decisions", "", "## ADRs", ""]
    for path in sorted((ROOT / "docs" / "adr").glob("ADR-*.md")):
        text = read_text(path)
        title = next((h["title"] for h in headings(text) if h["level"] == 1), path.stem)
        m = re.search(r"^\*\*Staatus:\*\*\s*(.+)$", text, re.M)
        lines.append(f"- `{rel(path)}`: {title} | Staatus: {m.group(1).strip() if m else '?'}")
    for path in sorted((ROOT / "docs" / "review").glob("*otsused*.md")):
        text = read_text(path)
        sec = re.search(r"^## Kasutaja otsustada\s*\n(.*?)(?=^## |\Z)", text, re.M | re.S)
        if sec:
            lines += ["", f"## Open user decisions in `{rel(path)}`", "", sec.group(1).strip()]
    status = ROOT / "docs" / "STATUS.md"
    if status.exists():
        need = [l for l in read_text(status).splitlines() if "Otsust vajab" in l]
        if need:
            lines += ["", "## From docs/STATUS.md", "", *need]
    inbox = sorted(INBOX.glob("*.md")) if INBOX.exists() else []
    lines += ["", f"## Review inbox: {len(inbox)} file(s)", *[f"- `{rel(p)}`" for p in inbox[-20:]]]
    return clip("\n".join(lines))


def tool_submit_review(args: dict[str, Any]) -> str:
    reviewer = args["reviewer"].strip().lower()
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,29}", reviewer):
        raise ToolError("reviewer must be 1–30 characters of a–z, 0–9 or '-', e.g. 'gpt', 'gemini', 'claude'.")
    INBOX.mkdir(parents=True, exist_ok=True)
    today = _dt.date.today().isoformat()
    path = INBOX / f"{today}-{reviewer}.md"
    n = 2
    while path.exists():
        path = INBOX / f"{today}-{reviewer}-{n}.md"
        n += 1
    out = [f"# Ülevaatus: {args['subject'].strip()}", "",
           f"- **Ülevaataja:** {reviewer}", f"- **Kuupäev:** {today}",
           f"- **Git HEAD:** {git('log', '-1', '--format=%h %s')}",
           f"- **Üldhinnang:** {args['verdict']}", "", "## Kokkuvõte", "", args["summary"].strip(), "",
           "## Leiud", ""]
    for i, f in enumerate(args.get("findings", []), start=1):
        out += [f"### {i}. [{f['severity']}] {f['title'].strip()}", "",
                f"- **Jaotis:** {f['section'].strip()}",
                f"- **Stsenaarium:** {f['scenario'].strip()}",
                f"- **Soovitatud muudatus:** {f['change'].strip()}", ""]
    if not args.get("findings"):
        out += ["Leide pole.", ""]
    if (args.get("notes") or "").strip():
        out += ["## Muu", "", args["notes"].strip(), ""]
    path.write_text("\n".join(out), encoding="utf-8", newline="\n")
    return (f"Review saved to `{rel(path)}`. It is not committed; the user or Claude "
            f"consolidates it into the decisions file.")


# --------------------------------------------------------------------------- schemas

RO = {"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True, "openWorldHint": False}
DOC_ARG = {"type": "string", "minLength": 1, "maxLength": 200,
           "description": "Document name or path, e.g. '03', '04-andmemudel', 'ADR-003', 'STATUS', "
                          "'docs/05-moodulid.md'. Call bb_list_docs for the list."}

TOOLS: list[dict[str, Any]] = [
    {"name": "bb_status", "title": "BB status", "handler": tool_status, "annotations": RO,
     "description": "Live git state (branch, HEAD, changed files) plus docs/STATUS.md, the handover note "
                    "of current work and next step. Call this first.",
     "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False}},
    {"name": "bb_list_docs", "title": "List BB documents", "handler": tool_list_docs, "annotations": RO,
     "description": "Table of all Markdown documents (path, title, line count, ADR status, number of "
                    "sections). Use it to find the right document before reading.",
     "inputSchema": {"type": "object", "additionalProperties": False, "properties": {
         "include_superpowers": {"type": "boolean", "default": False,
                                 "description": "Also list superseded Flutter-era plan/spec files."}}}},
    {"name": "bb_outline", "title": "Document outline", "handler": tool_outline, "annotations": RO,
     "description": "Heading tree of one document with anchors and line numbers. Use before "
                    "bb_read_section to pick a heading.",
     "inputSchema": {"type": "object", "additionalProperties": False, "required": ["doc"],
                     "properties": {"doc": DOC_ARG}}},
    {"name": "bb_read_section", "title": "Read document section", "handler": tool_read_section,
     "annotations": RO,
     "description": "Text of one section (the heading and everything until the next heading of the same "
                    "or higher level). Without a heading returns the whole document, truncated.",
     "inputSchema": {"type": "object", "additionalProperties": False, "required": ["doc"], "properties": {
         "doc": DOC_ARG,
         "heading": {"type": "string", "maxLength": 200,
                     "description": "Heading text, part of it, or anchor, e.g. '9. Salvestus', "
                                    "'#ühenduse-tase-connectionlevels', 'Piiks'."},
         "max_chars": {"type": "integer", "minimum": 500, "maximum": CHAR_LIMIT, "default": 12000,
                       "description": "Maximum characters to return."}}}},
    {"name": "bb_search", "title": "Search documents", "handler": tool_search, "annotations": RO,
     "description": "Search Markdown documents line by line. Each hit shows path:line, the section "
                    "heading it is under, and the line.",
     "inputSchema": {"type": "object", "additionalProperties": False, "required": ["query"], "properties": {
         "query": {"type": "string", "minLength": 1, "maxLength": 300,
                   "description": "Text or regex, e.g. 'SaveCoordinator' or 'beep\\.record'."},
         "regex": {"type": "boolean", "default": False, "description": "Treat query as a regular expression."},
         "case_sensitive": {"type": "boolean", "default": False},
         "scope": {"type": "string", "default": "docs", "maxLength": 200,
                   "description": "'docs' (docs/ only), 'all' (all Markdown incl. root and superseded "
                                  "files), or a glob such as 'docs/adr/*'."},
         "limit": {"type": "integer", "minimum": 1, "maximum": 200, "default": 30}}}},
    {"name": "bb_check_docs", "title": "Check documents", "handler": tool_check_docs, "annotations": RO,
     "description": "Consistency check of all Markdown files: missing link targets and anchors, "
                    "unbalanced code fences, ';' in Mermaid sequence messages, and stale terms from "
                    "replaced designs. Run after editing documentation.",
     "inputSchema": {"type": "object", "additionalProperties": False, "properties": {
         "stale_terms": {"type": "array", "maxItems": 50,
                         "items": {"type": "string", "minLength": 2, "maxLength": 80},
                         "description": "Terms to flag. Default: terms of replaced designs such as "
                                        "evidenceId, beginTransaction, CONTRACT_VERSION."},
         "include_historical": {"type": "boolean", "default": False,
                                "description": "Also flag stale terms in history files (reviews, "
                                               "ADR-001, superseded plans)."}}}},
    {"name": "bb_decisions", "title": "Decisions", "handler": tool_decisions, "annotations": RO,
     "description": "All ADRs with their status, open user decisions from review decision files and "
                    "STATUS, and the review inbox. Note: an ADR marked 'Ettepanek' is not accepted.",
     "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False}},
    {"name": "bb_submit_review", "title": "Submit a review", "handler": tool_submit_review,
     "annotations": {"readOnlyHint": False, "destructiveHint": False, "idempotentHint": False,
                     "openWorldHint": False},
     "description": "File an architecture or document review into docs/review/inbox/<date>-<reviewer>.md. "
                    "Creates a new file, never overwrites or commits. Write in Estonian.",
     "inputSchema": {"type": "object", "additionalProperties": False,
                     "required": ["reviewer", "subject", "verdict", "summary"], "properties": {
         "reviewer": {"type": "string", "minLength": 1, "maxLength": 30,
                      "description": "Who reviews: 'gpt', 'gemini', 'claude', …"},
         "subject": {"type": "string", "minLength": 3, "maxLength": 200,
                     "description": "What was reviewed, e.g. 'ADR-003 v2 ja 03 arhitektuur'."},
         "verdict": {"type": "string", "enum": VERDICTS, "description": "Overall verdict."},
         "summary": {"type": "string", "minLength": 1, "maxLength": 4000},
         "findings": {"type": "array", "maxItems": 30, "items": {
             "type": "object", "additionalProperties": False,
             "required": ["severity", "title", "section", "scenario", "change"], "properties": {
                 "severity": {"type": "string", "enum": ["P1", "P2", "P3"],
                              "description": "P1 blocks the milestone, P2 should be fixed, P3 nice to have."},
                 "title": {"type": "string", "minLength": 3, "maxLength": 200},
                 "section": {"type": "string", "minLength": 1, "maxLength": 200,
                             "description": "Document and section, e.g. '03 § 9'."},
                 "scenario": {"type": "string", "minLength": 1, "maxLength": 2000,
                              "description": "Concrete failure scenario."},
                 "change": {"type": "string", "minLength": 1, "maxLength": 2000,
                            "description": "Proposed change."}}}},
         "notes": {"type": "string", "maxLength": 8000,
                   "description": "Answers to open questions or anything else."}}}},
]
TOOL_BY_NAME = {t["name"]: t for t in TOOLS}


def validate(value: Any, schema: dict[str, Any], where: str = "arguments") -> None:
    """Small JSON-schema subset validator for the schemas above."""
    kind = schema.get("type")
    checks: dict[str, Callable[[Any], bool]] = {
        "object": lambda v: isinstance(v, dict),
        "array": lambda v: isinstance(v, list),
        "string": lambda v: isinstance(v, str),
        "integer": lambda v: isinstance(v, int) and not isinstance(v, bool),
        "boolean": lambda v: isinstance(v, bool),
    }
    if kind and not checks[kind](value):
        raise ToolError(f"{where} must be of type {kind}.")
    if "enum" in schema and value not in schema["enum"]:
        raise ToolError(f"{where} must be one of: {', '.join(map(str, schema['enum']))}.")
    if kind == "string":
        if len(value.strip()) < schema.get("minLength", 0):
            raise ToolError(f"{where} must have at least {schema['minLength']} characters.")
        if len(value) > schema.get("maxLength", 10**9):
            raise ToolError(f"{where} must have at most {schema['maxLength']} characters.")
    if kind == "integer":
        if value < schema.get("minimum", -10**12) or value > schema.get("maximum", 10**12):
            raise ToolError(f"{where} must be between {schema.get('minimum')} and {schema.get('maximum')}.")
    if kind == "array":
        if len(value) > schema.get("maxItems", 10**9):
            raise ToolError(f"{where} may have at most {schema['maxItems']} items.")
        for i, item in enumerate(value):
            validate(item, schema.get("items", {}), f"{where}[{i}]")
    if kind == "object":
        props = schema.get("properties", {})
        for req in schema.get("required", []):
            if req not in value:
                raise ToolError(f"{where}.{req} is required.")
        if schema.get("additionalProperties") is False:
            extra = sorted(set(value) - set(props))
            if extra:
                raise ToolError(f"{where} has unknown field(s): {', '.join(extra)}.")
        for key, sub in props.items():
            if key in value:
                validate(value[key], sub, f"{where}.{key}")


# --------------------------------------------------------------------------- protocol


def tool_listing() -> list[dict[str, Any]]:
    return [{k: t[k] for k in ("name", "title", "description", "inputSchema", "annotations")} for t in TOOLS]


def call_tool(params: dict[str, Any]) -> dict[str, Any]:
    tool = TOOL_BY_NAME[params["name"]]
    args = params.get("arguments") or {}
    try:
        validate(args, tool["inputSchema"])
        text = tool["handler"](args)
        return {"content": [{"type": "text", "text": text}], "isError": False}
    except ToolError as exc:
        return {"content": [{"type": "text", "text": f"Error: {exc}"}], "isError": True}
    except Exception as exc:  # noqa: BLE001 - report, keep the server alive
        traceback.print_exc(file=sys.stderr)
        return {"content": [{"type": "text", "text": f"Internal error: {type(exc).__name__}: {exc}"}],
                "isError": True}


def handle(msg: Any) -> dict[str, Any] | None:
    if not isinstance(msg, dict) or "method" not in msg:
        return None  # responses from the client or junk: nothing to answer
    method, params = msg["method"], msg.get("params") or {}
    if "id" not in msg:
        return None  # notification (initialized, cancelled, …)
    mid = msg["id"]

    def ok(result: dict[str, Any]) -> dict[str, Any]:
        return {"jsonrpc": "2.0", "id": mid, "result": result}

    def err(code: int, message: str) -> dict[str, Any]:
        return {"jsonrpc": "2.0", "id": mid, "error": {"code": code, "message": message}}

    if method == "initialize":
        requested = params.get("protocolVersion")
        version = requested if requested in SUPPORTED_PROTOCOLS else SUPPORTED_PROTOCOLS[0]
        return ok({"protocolVersion": version,
                   "capabilities": {"tools": {"listChanged": False}},
                   "serverInfo": {"name": SERVER_NAME, "title": "BB / PCB Kaardistaja", "version": SERVER_VERSION},
                   "instructions": INSTRUCTIONS})
    if method == "ping":
        return ok({})
    if method == "tools/list":
        return ok({"tools": tool_listing()})
    if method == "tools/call":
        if params.get("name") not in TOOL_BY_NAME:
            return err(-32602, f"Unknown tool: {params.get('name')}. Call tools/list.")
        return ok(call_tool(params))
    if method in ("resources/list", "resources/templates/list", "prompts/list"):
        key = {"resources/list": "resources", "resources/templates/list": "resourceTemplates",
               "prompts/list": "prompts"}[method]
        return ok({key: []})
    return err(-32601, f"Method not found: {method}")


def send(obj: Any) -> None:
    sys.stdout.buffer.write(json.dumps(obj, ensure_ascii=False).encode("utf-8") + b"\n")
    sys.stdout.buffer.flush()


def main() -> None:
    print(f"{SERVER_NAME} {SERVER_VERSION} serving {ROOT}", file=sys.stderr)
    for raw in sys.stdin.buffer:
        line = raw.strip()
        if not line:
            continue
        try:
            msg = json.loads(line.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            send({"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "Parse error"}})
            continue
        if isinstance(msg, list):
            replies = [r for r in (handle(m) for m in msg) if r is not None]
            if replies:
                send(replies)
            continue
        reply = handle(msg)
        if reply is not None:
            send(reply)


if __name__ == "__main__":
    main()
