#!/usr/bin/env python3
"""Bake the complete published 2014–Tasha's rules corpus, plus only the 2024 Ranger.

Usage:
    python3 scripts/bake-canonical-5e.py [path/to/5etools-src]

The output is deterministic. Source order, reprint selection, provenance, rejected
post-cutoff records, and unresolved 5etools tags are validated before writing.
"""

from __future__ import annotations

import copy
import json
import re
import shutil
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

APP_ROOT = Path(__file__).resolve().parent.parent
VETOOLS_ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else APP_ROOT.parent / "5etools-src"
DATA = VETOOLS_ROOT / "data"
IMG_ROOT = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else APP_ROOT.parent / "5etools-img"
ART = APP_ROOT / "public" / "art"
OUT = APP_ROOT / "public" / "compendium.json"
REPORT = APP_ROOT / "public" / "content-report.json"
CUTOFF = "2020-11-17"
RANGER_SOURCE = "XPHB"
DEFAULT_ENABLED = {"SRD", "PHB", "MM", "DMG", "EEPC", "SCAG", "VGM", "XGE", "MTF", "TCE", RANGER_SOURCE}
PLANE_SHIFT = {
    "PSZ": ("Plane Shift: Zendikar", "2016-04-27"),
    "PSI": ("Plane Shift: Innistrad", "2016-07-12"),
    "PSK": ("Plane Shift: Kaladesh", "2017-02-16"),
    "PSA": ("Plane Shift: Amonkhet", "2017-07-06"),
    "PSX": ("Plane Shift: Ixalan", "2018-01-09"),
    "PSD": ("Plane Shift: Dominaria", "2018-07-31"),
}
SIZE = {"F": "Medium", "D": "Medium", "T": "Tiny", "S": "Small", "M": "Medium", "L": "Large", "H": "Huge", "G": "Gargantuan", "V": "Varies"}
ALIGN = {"L": "lawful", "C": "chaotic", "NX": "neutral", "NY": "neutral", "N": "neutral", "G": "good", "E": "evil", "U": "unaligned", "A": "any alignment"}
SCHOOL = {"A": "A", "C": "C", "D": "D", "E": "EN", "V": "EV", "I": "I", "N": "N", "T": "T", "P": "EV"}
XP = {0: 10, .125: 25, .25: 50, .5: 100, 1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800, 6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900, 11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000, 16: 15000, 17: 18000, 18: 20000, 19: 22000, 20: 25000, 21: 33000, 22: 41000, 23: 50000, 24: 62000, 25: 75000, 26: 90000, 27: 105000, 28: 120000, 29: 135000, 30: 155000}


def load(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower().replace("*", " star ")).strip("-")


def source_fixture() -> dict[str, dict[str, Any]]:
    parser = (VETOOLS_ROOT / "js" / "parser.js").read_text(encoding="utf-8")
    constants = dict(re.findall(r'Parser\.(SRC_[A-Za-z0-9_]+)\s*=\s*"([^"]+)"', parser))
    dates = {}
    names = {}
    for key, date in re.findall(r'Parser\.SOURCE_JSON_TO_DATE\[Parser\.(SRC_[A-Za-z0-9_]+)\]\s*=\s*"([^"]+)"', parser):
        if key in constants:
            dates[constants[key]] = date
    for key, name in re.findall(r'Parser\.SOURCE_JSON_TO_FULL\[Parser\.(SRC_[A-Za-z0-9_]+)\]\s*=\s*"([^"]+)"', parser):
        if key in constants:
            names[constants[key]] = name
    for filename, key in (("books.json", "book"), ("adventures.json", "adventure")):
        for row in load(DATA / filename)[key]:
            code = row["id"]
            names[code] = row["name"]
            if row.get("published"):
                dates[code] = row["published"]
    for code, (name, date) in PLANE_SHIFT.items():
        names[code], dates[code] = name, date
    rows = {}
    for code, date in dates.items():
        if date <= CUTOFF:
            rows[code] = {
                "code": code,
                "name": names.get(code, code),
                "published": date,
                "defaultEnabled": code in DEFAULT_ENABLED,
            }
    rows["SRD"] = {
        "code": "SRD",
        "name": "System Reference Document 5.1",
        "published": "2016-05-04",
        "defaultEnabled": True,
    }
    rows[RANGER_SOURCE] = {
        "code": RANGER_SOURCE,
        "name": "Player's Handbook (2024) — Ranger only",
        "published": "2024-09-17",
        "defaultEnabled": True,
        "scope": "Ranger class and Ranger subclasses only",
    }
    rows["MPMM"] = {
        "code": "MPMM",
        "name": "Mordenkainen Presents: Monsters of the Multiverse",
        "published": "2022-05-17",
        "defaultEnabled": True,
        "scope": "Minotaur race only",
    }
    return rows


SOURCES = source_fixture()


SMALL_WORDS = {"of", "the", "and", "or", "a", "an", "in", "on", "with"}
KEY_LABELS = {"anyArtisansTool": "any artisan's tools", "anyMusicalInstrument": "any musical instrument", "anyGamingSet": "any gaming set", "anyStandard": "any standard language", "anyExotic": "any exotic language"}


def label(value: str) -> str:
    """Human label for a 5etools proficiency key: 'sleight of hand' -> 'Sleight of Hand', "navigator's tools" -> "Navigator's Tools", 'anyArtisansTool' -> "Any artisan's tools"."""
    text = KEY_LABELS.get(value, re.sub(r"(?<=[a-z])(?=[A-Z])", " ", str(value))).replace("_", " ").strip()
    words = text.split(" ")
    return " ".join(w if (i and w.lower() in SMALL_WORDS) else (w[:1].upper() + w[1:]) for i, w in enumerate(words) if w)


def allowed_source(source: str | None) -> bool:
    return bool(source and source in SOURCES and source != RANGER_SOURCE and source != "MPMM")


def minotaur_exception(row: dict[str, Any]) -> bool:
    return row.get("source") == "MPMM" and row.get("name") == "Minotaur"

def ranger_exception(row: dict[str, Any]) -> bool:
    return row.get("source") == RANGER_SOURCE and row.get("className", row.get("name")) == "Ranger"


def source_meta(row: dict[str, Any]) -> dict[str, Any]:
    source = row.get("source", "")
    sources = [source]
    other = row.get("otherSources") or []
    sources.extend(x.get("source") for x in other if isinstance(x, dict) and x.get("source"))
    return {
        "src": source,
        "sources": sources or ([source] if source else []),
        "source": SOURCES.get(source, {}).get("name", source),
        "page": row.get("page"),
        "published": SOURCES.get(source, {}).get("published"),
    }


TAG_RE = re.compile(r"\{@([A-Za-z0-9]+)(?: ([^{}]*))?\}")


def strip_tags(value: Any) -> str:
    text = str(value if value is not None else "")
    for _ in range(12):
        if "{@" not in text:
            break
        changed = False
        def replace(match: re.Match[str]) -> str:
            nonlocal changed
            changed = True
            tag, body = match.group(1), match.group(2) or ""
            parts = [p.strip() for p in body.split("|")]
            # Tags that carry no body ({@h}, {@hitYourSpellAttack}, a bare {@recharge}) still render.
            if tag == "recharge":
                return f"(Recharge {parts[0]}–6)" if parts[0] else "(Recharge 6)"
            if tag == "h":
                return "Hit: "
            if tag == "m":
                return "Miss: "
            if tag == "hom":
                return "Hit or Miss: "
            if tag == "hitYourSpellAttack":
                return "your spell attack modifier"
            if tag == "dcYourSpellSave":
                return "your spell save DC"
            if not parts or not parts[0]:
                return ""
            if tag == "chance":
                return f"{parts[0]} percent"
            if tag in {"atk", "atkr"}:
                return {"m": "Melee Attack:", "r": "Ranged Attack:", "m,r": "Melee or Ranged Attack:", "mw": "Melee Weapon Attack:", "rw": "Ranged Weapon Attack:", "mw,rw": "Melee or Ranged Weapon Attack:", "ms": "Melee Spell Attack:", "rs": "Ranged Spell Attack:", "ms,rs": "Melee or Ranged Spell Attack:"}.get(parts[0], "Attack:")
            if tag == "dc":
                return f"DC {parts[0]}"
            if tag in {"hit", "d20"}:
                return f"+{parts[0]}" if not parts[0].startswith("+") else parts[0]
            if tag == "actSave":
                return f"{parts[0].upper()} Saving Throw:"
            if tag in {"actSaveSuccess", "actSaveSuccessOrFail"}:
                return "Success:"
            if tag in {"actSaveFail", "actSaveFailBy"}:
                return "Failure:"
            if tag == "actTrigger":
                return "Trigger:"
            if tag == "actResponse":
                return "Response:"
            if tag == "classFeature":
                return parts[5] if len(parts) > 5 and parts[5] else parts[0]
            if tag == "subclassFeature":
                return parts[7] if len(parts) > 7 and parts[7] else parts[0]
            if tag == "subclass":
                return parts[4] if len(parts) > 4 and parts[4] else parts[0]
            if tag in {"deity", "card"}:
                return parts[3] if len(parts) > 3 and parts[3] else parts[0]
            if tag == "quickref":
                return parts[4] if len(parts) > 4 and parts[4] else parts[0]
            if tag in {"filter", "dice", "damage", "scaledice", "scaledamage", "skill", "sense", "language", "note", "book", "adventure", "link"}:
                return parts[0]
            if len(parts) > 2 and parts[2] and not ("=" in parts[2] or ";" in parts[2]):
                return parts[2]
            return parts[0]
        next_text = TAG_RE.sub(replace, text)
        text = next_text
        if not changed:
            break
    text = re.sub(r"\bPB\b", "your proficiency bonus", text)
    return text.replace("summonSpellLevel", "the spell's level").replace("\u00ad", "")


def render_entries(value: Any, out: list[str]) -> None:
    if value is None:
        return
    if isinstance(value, (str, int, float)):
        text = strip_tags(value).strip()
        if text:
            out.append(text)
        return
    if isinstance(value, list):
        for item in value:
            render_entries(item, out)
        return
    if not isinstance(value, dict):
        return
    kind = value.get("type")
    if kind == "list":
        for item in value.get("items", []):
            bits: list[str] = []
            render_entries(item, bits)
            if bits:
                out.append("• " + " ".join(bits))
        return
    if kind == "table":
        if value.get("caption"):
            out.append(strip_tags(value["caption"]) + ":")
        if value.get("colLabels"):
            out.append(" | ".join(strip_tags(x) for x in value["colLabels"]))
        for row in value.get("rows", []):
            cells = []
            for cell in row:
                if isinstance(cell, dict):
                    roll = cell.get("roll")
                    if roll:
                        cells.append(str(roll.get("exact", f"{roll.get('min', '')}–{roll.get('max', '')}")))
                    else:
                        cells.append(strip_tags(cell.get("entry", "")))
                else:
                    cells.append(strip_tags(cell))
            out.append(" | ".join(cells))
        return
    body: list[str] = []
    render_entries(value.get("entries", value.get("entry", value.get("items", []))), body)
    if value.get("name"):
        name = strip_tags(value["name"]).strip()
        body_text = "\n".join(body).strip()
        if name.endswith(":") or name.endswith("."):
            out.append(f"{name} {body_text}".strip())
        else:
            out.append(f"{name}. {body_text}".strip())
    else:
        out.extend(body)


def render_text(value: Any) -> str:
    out: list[str] = []
    render_entries(value, out)
    return "\n".join(x for x in out if x).strip()


def apply_mod(target: dict[str, Any], mods: dict[str, Any]) -> None:
    for prop, raw_ops in mods.items():
        ops = raw_ops if isinstance(raw_ops, list) else [raw_ops]
        for op in ops:
            if not isinstance(op, dict):
                continue
            mode = op.get("mode")
            if prop in {"*", "_"}:
                if mode == "replaceTxt":
                    find, replace = op.get("replace", ""), op.get("with", "")
                    def walk(value: Any) -> Any:
                        if isinstance(value, str):
                            return value.replace(find, replace)
                        if isinstance(value, list):
                            return [walk(x) for x in value]
                        if isinstance(value, dict):
                            return {k: walk(v) for k, v in value.items()}
                        return value
                    target.update(walk(target))
                elif mode == "setProp" and op.get("prop"):
                    target[op["prop"]] = copy.deepcopy(op.get("value"))
                continue
            current = target.get(prop)
            items = copy.deepcopy(op.get("items", op.get("item", [])))
            if not isinstance(items, list):
                items = [items]
            if mode == "appendArr":
                target[prop] = (current if isinstance(current, list) else []) + items
            elif mode == "prependArr":
                target[prop] = items + (current if isinstance(current, list) else [])
            elif mode == "appendIfNotExistsArr":
                arr = current if isinstance(current, list) else []
                for item in items:
                    if item not in arr:
                        arr.append(item)
                target[prop] = arr
            elif mode == "replaceArr":
                arr = current if isinstance(current, list) else []
                names = op.get("replace", op.get("names", []))
                if isinstance(names, str):
                    names = [names]
                indices = [i for i, x in enumerate(arr) if (x.get("name") if isinstance(x, dict) else x) in names]
                if indices:
                    at = indices[0]
                    arr = [x for i, x in enumerate(arr) if i not in indices]
                    arr[at:at] = items
                else:
                    arr.extend(items)
                target[prop] = arr
            elif mode == "removeArr":
                arr = current if isinstance(current, list) else []
                names = op.get("names", op.get("remove", []))
                if isinstance(names, str):
                    names = [names]
                target[prop] = [x for x in arr if (x.get("name") if isinstance(x, dict) else x) not in names]
            elif mode == "insertArr":
                arr = current if isinstance(current, list) else []
                ix = max(0, min(len(arr), int(op.get("index", len(arr)))))
                target[prop] = arr[:ix] + items + arr[ix:]
            elif mode == "renameArr":
                for item in current if isinstance(current, list) else []:
                    if isinstance(item, dict) and item.get("name") == op.get("rename"):
                        item["name"] = op.get("with", item["name"])
            elif mode == "replaceTxt":
                target[prop] = str(current or "").replace(op.get("replace", ""), op.get("with", ""))
            elif mode == "setProp":
                target[prop] = copy.deepcopy(op.get("value"))
            elif mode == "scalarAddProp":
                target[prop] = (current or 0) + op.get("scalar", 0)
            elif mode == "scalarMultProp":
                target[prop] = (current or 0) * op.get("scalar", 1)
            elif mode == "prefixSuffixStringProp":
                target[prop] = f"{op.get('prefix', '')}{current or ''}{op.get('suffix', '')}"


def copy_key(row: dict[str, Any], fallback: dict[str, Any] | None = None) -> tuple[Any, ...]:
    # Class and subclass features share names across classes and levels ("Ability Score Improvement",
    # "Spellcasting", "Extra Attack"), so identity must include those fields where present.
    # Subraces may carry no name of their own (the plain PHB Human, Half-Elf, Half-Orc, Tiefling), so their
    # identity is the parent race they extend.
    fb = fallback or {}
    return tuple(row.get(k, fb.get(k)) for k in ("name", "source", "className", "subclassShortName", "level", "raceName", "raceSource"))


def resolve_copies(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    index = {copy_key(x): x for x in rows if x.get("name") and x.get("source")}
    cache: dict[tuple[Any, ...], dict[str, Any]] = {}
    active: set[tuple[Any, ...]] = set()
    def resolve(row: dict[str, Any]) -> dict[str, Any]:
        key = copy_key(row)
        if key in cache:
            return copy.deepcopy(cache[key])
        if key in active:
            return copy.deepcopy(row)
        active.add(key)
        spec = row.get("_copy")
        if spec:
            base = index.get(copy_key(spec, row))
            merged = resolve(base) if base else {}
            merged.update(copy.deepcopy({k: v for k, v in row.items() if k != "_copy"}))
            apply_mod(merged, spec.get("_mod", {}))
        else:
            merged = copy.deepcopy(row)
        active.discard(key)
        cache[key] = merged
        return copy.deepcopy(merged)
    return [resolve(row) for row in rows]


def collect_json(pattern: str, key: str) -> list[dict[str, Any]]:
    rows = []
    for path in sorted(DATA.glob(pattern)):
        try:
            rows.extend(load(path).get(key, []))
        except (json.JSONDecodeError, UnicodeDecodeError):
            pass
    return rows


def rank(row: dict[str, Any]) -> tuple[str, str]:
    return (SOURCES.get(row.get("source", ""), {}).get("published", "0000-00-00"), row.get("source", ""))


def latest(rows: list[dict[str, Any]], key_fn) -> list[dict[str, Any]]:
    grouped: dict[Any, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        grouped[key_fn(row)].append(row)
    out = []
    for key in sorted(grouped, key=lambda x: str(x)):
        variants = sorted(grouped[key], key=rank)
        chosen = copy.deepcopy(variants[-1])
        all_sources = []
        for variant in variants:
            all_sources.extend(source_meta(variant)["sources"])
        chosen["_allSources"] = list(dict.fromkeys(all_sources))
        out.append(chosen)
    return out


def provenance(row: dict[str, Any], kind: str, *parents: str) -> dict[str, Any]:
    meta = source_meta(row)
    if row.get("_allSources"):
        meta["sources"] = row["_allSources"]
    return {
        "id": ":".join([kind, slug(meta["src"]), *(slug(x) for x in parents), slug(row.get("name", "unnamed"))]),
        **meta,
    }


def source_tail(row: dict[str, Any]) -> str:
    meta = source_meta(row)
    return f"Source: {meta['source']}" + (f", p. {meta['page']}" if meta.get("page") else "")


def convert_spell(row: dict[str, Any], spell_lookup: dict[str, Any]) -> dict[str, Any]:
    distance = row.get("range", {}).get("distance", {})
    rtype = row.get("range", {}).get("type")
    dtype = distance.get("type")
    amount = distance.get("amount")
    if rtype == "special":
        range_text = "Special"
    elif rtype == "point":
        range_text = {"self": "Self", "touch": "Touch", "sight": "Sight", "unlimited": "Unlimited"}.get(dtype, f"{amount} {dtype}" if amount is not None else str(dtype or ""))
    else:
        range_text = f"Self ({amount}-{str(dtype or 'foot').replace('feet', 'foot')} {rtype})"
    components = row.get("components", {})
    component_text = ", ".join(x for x in ["V" if components.get("v") else "", "S" if components.get("s") else "", f"M ({strip_tags(components.get('m', {}).get('text') if isinstance(components.get('m'), dict) else components.get('m'))})" if components.get("m") else ""] if x)
    durations = []
    for duration in row.get("duration", []):
        kind = duration.get("type")
        if kind == "instant": durations.append("Instantaneous")
        elif kind == "special": durations.append("Special")
        elif kind == "permanent": durations.append("Until dispelled" + (" or triggered" if "trigger" in duration.get("ends", []) else ""))
        elif kind == "timed":
            d = duration.get("duration", {})
            n, unit = d.get("amount"), d.get("type", "")
            durations.append(f"{'Concentration, up to ' if duration.get('concentration') else ''}{n} {unit}{'s' if isinstance(n, int) and n != 1 else ''}")
    lookup = spell_lookup.get(row.get("source", "").lower(), {}).get(row.get("name", "").lower(), {})
    class_names = set()
    for class_source, classes in lookup.get("class", {}).items():
        if allowed_source(class_source):
            class_names.update(classes)
        elif class_source == RANGER_SOURCE and "Ranger" in classes:
            class_names.add("Ranger")
    # Supplement spells (Xanathar's, Tasha's, Wildemount…) join class lists through classVariant, keyed by the class's own source.
    for class_source, classes in lookup.get("classVariant", {}).items():
        for class_name, info in classes.items():
            defined = [x for x in (info or {}).get("definedInSources", []) if allowed_source(x)]
            if not defined: continue
            if allowed_source(class_source) or (class_source == RANGER_SOURCE and class_name == "Ranger"):
                class_names.add(class_name)
    for class_source, classes in lookup.get("subclass", {}).items():
        if not allowed_source(class_source) and class_source != RANGER_SOURCE:
            continue
        for class_name, class_sources in classes.items():
            if class_source == RANGER_SOURCE and class_name != "Ranger":
                continue
            for subclass_source, subclasses in class_sources.items():
                if allowed_source(subclass_source) or (subclass_source == RANGER_SOURCE and class_name == "Ranger"):
                    for short, v in subclasses.items():
                        sub_name = v.get("name", short)
                        listed = SUBCLASS_SPELLS.get((class_name, sub_name))
                        if listed is None or row.get("name", "").lower() in listed:
                            class_names.add(f"{class_name} ({sub_name})")
    text = "\n".join(x for x in [render_text(row.get("entries", [])), render_text(row.get("entriesHigherLevel", []))] if x)
    casting_time = " or ".join(
        f"{x.get('number')} {x.get('unit')}" + (f", {strip_tags(x.get('condition'))}" if x.get("condition") else "")
        for x in row.get("time", [])
    )
    return {
        **provenance(row, "spell"),
        "name": row["name"], "level": row.get("level", 0), "school": SCHOOL.get(row.get("school"), row.get("school", "")),
        "classes": ", ".join(sorted(class_names)),
        "time": casting_time,
        "range": range_text, "components": component_text, "duration": " or ".join(durations), "ritual": bool(row.get("meta", {}).get("ritual")),
        "text": f"{text}\n\n{source_tail(row)}".strip(),
    }


def prerequisite_text(rows: Any) -> str:
    if not rows:
        return ""
    parts = []
    for row in rows if isinstance(rows, list) else [rows]:
        if not isinstance(row, dict):
            continue
        bits = []
        if row.get("level"):
            level = row["level"].get("level") if isinstance(row["level"], dict) else row["level"]
            bits.append(f"Level {level}+")
        if row.get("spellcasting") or row.get("pact") or row.get("spellcasting2020") or row.get("spellcastingFeature"):
            bits.append("Spellcasting or Pact Magic feature")
        for block in row.get("ability", []) if isinstance(row.get("ability"), list) else []:
            if not isinstance(block, dict):
                continue
            bits.extend(f"{ability.upper()} {score}+" for ability, score in block.items() if ability in {"str", "dex", "con", "int", "wis", "cha"})
        if row.get("race"):
            bits.append(" or ".join(x.get("name", "") for x in row["race"]))
        if row.get("proficiency"):
            for p in row["proficiency"] if isinstance(row["proficiency"], list) else [row["proficiency"]]:
                if isinstance(p, dict):
                    if p.get("armor"): bits.append(f"proficiency with {p['armor']} armor")
                    if p.get("weapon"): bits.append(f"proficiency with {p['weapon']} weapons")
                elif isinstance(p, str):
                    bits.append(f"proficiency with {p}")
        if row.get("feat"):
            bits.extend(strip_tags(x) for x in row["feat"] if isinstance(x, str))
        if row.get("other"):
            bits.append(strip_tags(row["other"]))
        parts.append(", ".join(x for x in bits if x))
    return " or ".join(x for x in parts if x)

def ability_bumps(row: dict[str, Any]) -> list[str]:
    out = []
    for block in row.get("ability", []):
        if not isinstance(block, dict):
            continue
        out.extend(k for k, v in block.items() if k in {"str", "dex", "con", "int", "wis", "cha"} and isinstance(v, (int, float)) and v > 0)
        choose = block.get("choose", {})
        out.extend(choose.get("from", []))
    return list(dict.fromkeys(out))


SPELL_CANON: dict[str, tuple[str, int]] = {}
UNRESOLVED_SPELL_REFS: Counter = Counter()


def spell_ref(raw: str) -> dict[str, Any]:
    """'speak with animals', 'light#c', 'identify|xphb', 'mending|xphb#c' -> canonical name + level."""
    text = str(raw)
    cantrip = text.endswith("#c")
    if cantrip: text = text[:-2]
    cast_at = re.search(r"#(\d+)$", text)
    if cast_at: text = text[: cast_at.start()]
    key = text.split("|")[0].strip().lower()
    hit = SPELL_CANON.get(key)
    if not hit: UNRESOLVED_SPELL_REFS[key] += 1
    return {"spell": hit[0] if hit else key.title(), "level": hit[1] if hit else (0 if cantrip else None), "castAt": int(cast_at.group(1)) if cast_at else None}


def spell_grants(row: dict[str, Any], attached: Any = None) -> list[dict[str, Any]]:
    """Flatten a 5etools `additionalSpells` block (or an item's `attachedSpells`) into grant records.

    Each grant: spell, level, how (innate/known/prepared/expanded), cost, at (level gate, 0 = always),
    plus uses/each/resource/ability when the cost is limited, or choose/count/all for pick-a-spell entries.
    cost: will · slot · daily · rest · limited · charges · resource · ritual · item.
    """
    out: list[dict[str, Any]] = []
    def clean(rec: dict[str, Any]) -> dict[str, Any]:
        return {k: v for k, v in rec.items() if v is not None and v is not False}
    def entries(how: str, at: Any, spell_level: Any, items: Any, cost: str, extra: dict[str, Any]) -> None:
        for item in items or []:
            base = {"how": how, "cost": cost, "at": at, **extra}
            if isinstance(item, str):
                out.append(clean({**spell_ref(item), **base}))
            elif isinstance(item, dict) and item.get("choose") is not None:
                out.append(clean({"choose": item["choose"], "count": item.get("count", 1), "level": spell_level, **base}))
            elif isinstance(item, dict) and item.get("all") is not None:
                out.append(clean({"all": item["all"], "level": spell_level, **base}))
    def body(how: str, at: Any, spell_level: Any, value: Any, extra: dict[str, Any]) -> None:
        if isinstance(value, list):
            entries(how, at, spell_level, value, "will" if how == "innate" else "slot", extra); return
        if not isinstance(value, dict): return
        for mode, inner in value.items():
            if mode == "_": body(how, at, spell_level, inner, extra)
            elif mode in {"will", "ritual"}: entries(how, at, spell_level, inner, mode, extra)
            elif mode == "other": entries(how, at, spell_level, inner, "item", extra)
            elif mode in {"daily", "rest", "limited", "charges", "resource"}:
                for uses, items in (inner or {}).items():
                    each = isinstance(uses, str) and uses.endswith("e") and uses[:-1].isdigit()
                    n = int(uses[:-1]) if each else (int(uses) if str(uses).isdigit() else uses)
                    entries(how, at, spell_level, items, mode, {**extra, "uses": n, "each": each})
    groups = row.get("additionalSpells") or []
    if attached is not None:
        groups = [{"innate": {"_": attached if isinstance(attached, list) else attached}, "ability": row.get("ability") if isinstance(attached, dict) else None}]
        if isinstance(attached, dict) and attached.get("ability"): groups[0]["ability"] = attached["ability"]
    for group in groups:
        ability = group.get("ability")
        extra = {"ability": ability if isinstance(ability, str) else (ability or {}).get("choose"), "resource": group.get("resourceName")}
        for how in ("innate", "known", "prepared", "expanded"):
            for gate, value in (group.get(how) or {}).items():
                gate = str(gate)
                if gate.startswith("s") and gate[1:].isdigit(): at, spell_level = 0, int(gate[1:])
                else: at, spell_level = (0 if gate == "_" else int(gate)), None
                body(how, at, spell_level, value, extra)
    return out


def with_grants(record: dict[str, Any], row: dict[str, Any], attached: Any = None) -> dict[str, Any]:
    grants = spell_grants(row, attached)
    return {**record, "grants": grants} if grants else record


ARMOR_KEY = {"light": "LA", "medium": "MA", "heavy": "HA", "shield": "S"}


def structured_profs(row: dict[str, Any]) -> dict[str, Any]:
    """The proficiencies a feat or race declares in 5etools' structured fields, in the app's shape:
    armor codes, weapons (simple / martial / named / a pick), skills or a skill pick, tools."""
    out: dict[str, Any] = {}
    for blk in row.get("armorProficiencies") or []:
        for k, v in blk.items():
            if v is True and k in ARMOR_KEY: out.setdefault("armor", []).append(ARMOR_KEY[k])
    for blk in row.get("weaponProficiencies") or []:
        for k, v in blk.items():
            if k in {"simple", "martial"} and v: out.setdefault("weapons", {})[k] = True
            elif k == "choose" and isinstance(v, dict): out.setdefault("weapons", {})["choose"] = {"n": v.get("count", 1)}
            elif v is True: out.setdefault("weapons", {}).setdefault("named", []).append(label(k.split("|")[0]))
    for blk in row.get("skillProficiencies") or []:
        for k, v in blk.items():
            if k == "choose" and isinstance(v, dict): out.setdefault("skillChoice", []).append({"n": v.get("count", 1), "from": [label(x) for x in v.get("from", [])]})
            elif k == "any" and isinstance(v, int): out.setdefault("skillChoice", []).append({"n": v, "from": []})
            elif v is True: out.setdefault("skills", []).append(label(k))
    for blk in row.get("toolProficiencies") or []:
        for k, v in blk.items():
            if k == "any" and isinstance(v, int): out.setdefault("toolChoice", []).append("Any Tool")
            elif k in KEY_LABELS and isinstance(v, int): out.setdefault("toolChoice", []).append(label(k))
            elif k == "choose" and isinstance(v, dict): out.setdefault("toolChoice", []).append("one of " + ", ".join(label(x.split("|")[0]) for x in v.get("from", [])))
            elif v is True: out.setdefault("tools", []).append(label(k))
    return out


def feat_needs(row: dict[str, Any]) -> dict[str, Any]:
    """A feat's proficiency prerequisite: {armor: 'MA'} for 'proficiency with medium armor', {weapon: 'martial'}."""
    out: dict[str, Any] = {}
    for pre in row.get("prerequisite") or []:
        for req in pre.get("proficiency") or []:
            if req.get("armor") in ARMOR_KEY: out["armor"] = ARMOR_KEY[req["armor"]]
            if req.get("weapon") in {"simple", "martial"}: out["weapon"] = req["weapon"]
    return out


def convert_feat(row: dict[str, Any]) -> dict[str, Any]:
    body = render_text(row.get("entries", []))
    profs = structured_profs(row)
    needs = feat_needs(row)
    return with_grants({**({"profs": profs} if profs else {}), **({"needs": needs} if needs else {}),
        **provenance(row, "feat"), "name": row["name"], "cat": "Canonical",
        "desc": body.split("\n\n")[0] if "\n\n" in body else body, "prereq": prerequisite_text(row.get("prerequisite")), "bump": ability_bumps(row),
        "text": f"{body}\n\n{source_tail(row)}".strip(), "canonical": True,
    }, row)

WEAPON_NAMES: set[str] = set()
SUBCLASS_SPELLS: dict[tuple[str, str], set[str]] = {}
PROF_RE = re.compile(r"gains? proficiency (?:with|in) ([^.]*)\.", re.I)
ARMOR_WORDS = {"light armor": "LA", "medium armor": "MA", "heavy armor": "HA", "shields": "S"}
COUNT_WORDS = {"one": 1, "two": 2, "three": 3, "four": 4}


def feature_profs(feature: dict[str, Any]) -> dict[str, Any] | None:
    """Structured proficiencies a subclass feature grants, read from its fixed vocabulary:
    'you gain proficiency with martial weapons and heavy armor' -> {armor: [HA], weapons: {martial: true}}.
    Skills, tools, and saves are kept for display; a skill pick becomes skillChoice {n, from}."""
    if not WEAPON_NAMES:
        for row in load(DATA / "items-base.json").get("baseitem", []):
            if row.get("weapon") and row.get("name"): WEAPON_NAMES.add(row["name"].lower())
    text = " ".join(x if isinstance(x, str) else "" for x in feature.get("entries", []))
    out: dict[str, Any] = {}
    for clause in PROF_RE.findall(text):
        low = clause.lower()
        armor = [code for word, code in ARMOR_WORDS.items() if word in low]
        if armor: out["armor"] = sorted(set(out.get("armor", []) + armor))
        if "martial weapon" in low: out.setdefault("weapons", {})["martial"] = True
        if "simple weapon" in low: out.setdefault("weapons", {})["simple"] = True
        for item in re.findall(r"\{@item ([^|}]+)", clause):
            name = item.strip()
            if name.lower() in WEAPON_NAMES: out.setdefault("weapons", {}).setdefault("named", []).append(label(name))
            elif "artisan's tools" in name.lower() or "gaming set" in name.lower(): out.setdefault("toolChoice", []).append(label(name))
            else: out.setdefault("tools", []).append(label(name))
        # Only the proficiency clause itself decides skills; a trailing "and you gain two cantrips…" is another benefit.
        skill_part = re.split(r",? and you (?:gain|learn|choose)", clause, maxsplit=1)[0]
        skills = [label(x.split("|")[0].strip()) for x in re.findall(r"\{@skill ([^}]+)\}", skill_part)]
        low = skill_part.lower()
        if skills:
            if "your choice" in low or " or " in low:
                n = next((v for w, v in COUNT_WORDS.items() if re.search(rf"\b{w}\b", low)), 1)
                out.setdefault("skillChoice", []).append({"n": n, "from": skills})
            else: out["skills"] = out.get("skills", []) + skills
        elif "skills of your choice" in low:
            n = next((v for w, v in COUNT_WORDS.items() if re.search(rf"\b{w}\b", low)), 1)
            out.setdefault("skillChoice", []).append({"n": n, "from": []})
    return out or None


def nested_feature_refs(value: Any, key: str) -> list[str]:
    """Feature references embedded in a feature's entries, in reading order (e.g. a domain's level-1 block
    referencing its Bonus Proficiencies and Wrath of the Storm sub-features)."""
    found: list[str] = []
    if isinstance(value, dict):
        if value.get(key): found.append(value[key] if isinstance(value[key], str) else value[key].get(key, ""))
        for child in value.values(): found.extend(nested_feature_refs(child, key))
    elif isinstance(value, list):
        for child in value: found.extend(nested_feature_refs(child, key))
    return [x for x in found if x]


def class_feature_refs(row: dict[str, Any], field: str) -> list[str]:
    refs = []
    for ref in row.get(field, []):
        refs.append(ref.get("classFeature", ref.get("subclassFeature", "")) if isinstance(ref, dict) else ref)
    return [x for x in refs if x]


def convert_classes() -> tuple[list[dict[str, Any]], dict[str, list[dict[str, Any]]], list[dict[str, Any]], dict[str, str], dict[str, Any]]:
    class_rows, subclass_rows, class_features, subclass_features = [], [], [], []
    for path in sorted((DATA / "class").glob("class-*.json")):
        data = load(path)
        class_rows.extend(data.get("class", [])); subclass_rows.extend(data.get("subclass", []))
        class_features.extend(data.get("classFeature", [])); subclass_features.extend(data.get("subclassFeature", []))
    class_rows = resolve_copies(class_rows); subclass_rows = resolve_copies(subclass_rows)
    class_features = resolve_copies(class_features); subclass_features = resolve_copies(subclass_features)
    selected_classes = []
    for name in sorted({x.get("name") for x in class_rows if x.get("name") and x.get("name") != "Sidekick"}):
        candidates = [x for x in class_rows if x.get("name") == name and (allowed_source(x.get("source")) or ranger_exception(x))]
        if name == "Ranger": candidates = [x for x in candidates if x.get("source") == RANGER_SOURCE]
        elif name == "Artificer": candidates = [x for x in candidates if x.get("source") == "TCE"] or candidates
        else: candidates = [x for x in candidates if x.get("source") == "PHB"] or candidates
        if candidates: selected_classes.append(sorted(candidates, key=rank)[-1])
    class_feature_index = {(x.get("name"), x.get("className"), x.get("source"), x.get("level")): x for x in class_features}
    converted_classes, feature_records, feature_texts = [], [], {}
    for row in selected_classes:
        refs = class_feature_refs(row, "classFeatures")
        levels: dict[str, list[str]] = defaultdict(list)
        seen_refs: set[str] = set()
        while refs:
            ref = refs.pop(0)
            if ref in seen_refs: continue
            seen_refs.add(ref)
            bits = ref.split("|")
            if len(bits) < 4: continue
            name, class_name, source, level = bits[0], bits[1], bits[2] or row.get("source", "PHB"), int(bits[3])
            feature = class_feature_index.get((name, class_name, source, level))
            if not feature: continue
            refs[0:0] = nested_feature_refs(feature.get("entries", []), "classFeature")
            text = render_text(feature.get("entries", []))
            levels[str(level)].append(name)
            rec = {**provenance(feature, "class-feature", class_name, str(level)), "name": name, "className": class_name, "level": level, "text": text}
            feature_records.append(rec)
            if text:
                feature_texts[f"{class_name}:{name}"] = text
                if not class_name.endswith(" Sidekick"): feature_texts.setdefault(name, text)
        skill_blocks = row.get("startingProficiencies", {}).get("skills", [])
        skill_choice = next((x.get("choose", {}) for x in skill_blocks if isinstance(x, dict) and x.get("choose")), {})
        asi = [int(level) for level, names in levels.items() if any("Ability Score Improvement" in name for name in names)]
        subclass_levels = [int(level) for level, names in levels.items() if any("Subclass" in name or name == row.get("subclassTitle") for name in names)]
        converted_classes.append({
            **provenance(row, "class"),
            "name": row["name"],
            "die": row.get("hd", {}).get("faces"),
            "saves": row.get("proficiency", []),
            "caster": {"full": "full", "1/2": "half", "artificer": "half1", "1/3": "third", "pact": "pact"}.get(row.get("casterProgression")),
            "subLvl": min(subclass_levels) if subclass_levels else 3,
            "subName": row.get("subclassTitle", "Subclass"),
            "skills": [label(x) for x in skill_choice.get("from", [])],
            "nSkills": skill_choice.get("count", 0),
            "asi": asi,
            "features": dict(levels),
            **({"grants": spell_grants(row)} if spell_grants(row) else {}),
        })
    selected_subclasses = []
    grouped: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for row in subclass_rows:
        if allowed_source(row.get("source")) or ranger_exception(row):
            grouped[(row.get("className", ""), row.get("name", ""))].append(row)
    revised_ranger = {"Beast Master", "Fey Wanderer", "Gloom Stalker", "Hunter"}
    for (class_name, name), candidates in sorted(grouped.items()):
        if not class_name or not name: continue
        if class_name == "Ranger" and name in revised_ranger:
            choices = [x for x in candidates if x.get("source") == RANGER_SOURCE]
            if choices: selected_subclasses.append(choices[-1]); continue
        choices = [x for x in candidates if x.get("source") != RANGER_SOURCE]
        if choices: selected_subclasses.append(sorted(choices, key=rank)[-1])
    subclass_feature_index = {(x.get("name"), x.get("className"), x.get("classSource"), x.get("subclassShortName"), x.get("source"), x.get("level")): x for x in subclass_features}
    subs: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in selected_subclasses:
        feats: dict[str, list[str]] = defaultdict(list)
        profs: list[dict[str, Any]] = []
        refs = class_feature_refs(row, "subclassFeatures")
        seen_refs: set[str] = set()
        while refs:
            ref = refs.pop(0)
            if ref in seen_refs: continue
            seen_refs.add(ref)
            bits = ref.split("|")
            if len(bits) < 6: continue
            name, class_name, class_source, sub_short, source, level = bits[0], bits[1], bits[2] or row.get("classSource", "PHB"), bits[3], bits[4] or row.get("source", ""), int(bits[5])
            feature = subclass_feature_index.get((name, class_name, class_source, sub_short, source, level))
            if not feature: continue
            refs[0:0] = nested_feature_refs(feature.get("entries", []), "subclassFeature")
            text = render_text(feature.get("entries", []))
            feats[str(level)].append(name)
            granted = feature_profs(feature)
            if granted: profs.append({"at": level, "feature": name, **granted})
            rec = {**provenance(feature, "subclass-feature", class_name, row["name"], str(level)), "name": name, "className": class_name, "subclass": row["name"], "level": level, "text": text}
            feature_records.append(rec)
            if text:
                feature_texts[f"{class_name}:{row['name']}:{name}"] = text
                feature_texts.setdefault(name, text)
        # A subclass that lists spells by name gets tagged only for those; one that opens a whole list ("all wizard
        # spells" for an Eldritch Knight) or declares nothing keeps the lookup's own tags.
        grants = spell_grants(row)
        SUBCLASS_SPELLS[(row["className"], row["name"])] = None if not row.get("additionalSpells") or any(g.get("all") for g in grants) else {g["spell"].lower() for g in grants if g.get("spell")}
        subs[row["className"]].append(with_grants({**provenance(row, "subclass", row["className"]), "name": row["name"], "feats": dict(feats), **({"profs": profs} if profs else {})}, row))
    for values in subs.values(): values.sort(key=lambda x: x["name"])
    feature_sources = {}
    for f in feature_records:
        name = f["name"]
        meta = source_meta(f)
        feature_sources[name] = meta
        clean_name = re.sub(r"\s*\(.*?\)", "", name).strip()
        if clean_name and clean_name != name:
            feature_sources[clean_name] = meta
        if f.get("className"):
            feature_sources[f"{f['className']}:{name}"] = meta
            if clean_name: feature_sources[f"{f['className']}:{clean_name}"] = meta
        if f.get("subclass"):
            feature_sources[f"{f['className']}:{f['subclass']}:{name}"] = meta
            if clean_name: feature_sources[f"{f['className']}:{f['subclass']}:{clean_name}"] = meta
    return converted_classes, dict(subs), feature_records, feature_texts, feature_sources


def convert_optional_features() -> tuple[list[dict[str, Any]], dict[str, Any]]:
    rows = [x for x in load(DATA / "optionalfeatures.json").get("optionalfeature", []) if allowed_source(x.get("source"))]
    for path in sorted((DATA / "class").glob("class-*.json")):
        for row in load(path).get("classFeature", []):
            if row.get("isClassFeatureVariant") and (allowed_source(row.get("source")) or ranger_exception(row)):
                rows.append(row)
    rows = latest(resolve_copies(rows), lambda x: (x.get("className", ""), x.get("name", ""), tuple(x.get("featureType", []))))
    out = []
    opt_map = {}
    for row in rows:
        text = render_text(row.get("entries", []))
        rec = {**provenance(row, "optional-feature", row.get("className", "general")), "name": row["name"], "className": row.get("className"), "level": row.get("level"), "featureType": row.get("featureType", []), "replaces": row.get("consumes", {}).get("name"), "prerequisite": prerequisite_text(row.get("prerequisite")), "text": text}
        out.append(rec)
        if row.get("name") and text:
            opt_map[row["name"]] = {"name": row["name"], "desc": text, "src": row.get("source"), "sources": rec["sources"]}
    return out, opt_map

def convert_mechanics_options() -> dict[str, Any]:
    opt_raw = load(DATA / "optionalfeatures.json").get("optionalfeature", [])
    rows = [x for x in resolve_copies(opt_raw) if allowed_source(x.get("source"))]
    invocations, inv_info = [], {}
    metamagic, mm_info = [], {}
    maneuvers, style_desc = {}, {}
    fighting_styles = defaultdict(list)
    pact_boons, boon_info = [], {}
    infusions, arcane_shots, runes, elemental_disciplines = [], [], [], []

    for row in rows:
        name = row.get("name")
        src = row.get("source")
        fts = row.get("featureType", [])
        text = render_text(row.get("entries", []))
        meta = source_meta(row)

        if "EI" in fts:
            lvl = 0
            pact = ""
            other_req = ""
            for p in row.get("prerequisite", []):
                if p.get("level"):
                    l = p["level"].get("level") if isinstance(p["level"], dict) else p["level"]
                    lvl = max(lvl, int(l))
                if p.get("pact"):
                    pact = f"Pact of the {p['pact']}"
                if p.get("spell"):
                    for sp in p["spell"]:
                        if "eldritch blast" in sp: other_req = "eldritch blast cantrip"
                        elif "hex" in sp: other_req = "hex/curse"
            req_text = pact or other_req
            invocations.append(with_grants({
                "name": name,
                "lvl": lvl,
                "req": req_text,
                "desc": text,
                "src": src,
                "sources": meta["sources"],
            }, row))
            inv_info[name] = text

        if "MM" in fts:
            metamagic.append({"name": name, "desc": text, "src": src, "sources": meta["sources"]})
            mm_info[name] = text

        if any("MV" in x for x in fts):
            maneuvers[name] = {"name": name, "desc": text, "src": src, "sources": meta["sources"]}

        if any("FS" in x for x in fts):
            style_desc[name] = text.split("\n")[0] if text else ""
            style = with_grants({"name": name, "src": src, "sources": meta["sources"]}, row)
            if "FS:F" in fts or "FS" in fts: fighting_styles["Fighter"].append(style)
            if "FS:P" in fts: fighting_styles["Paladin"].append(style)
            if "FS:R" in fts: fighting_styles["Ranger"].append(style)
            if "FS:B" in fts: fighting_styles["Bard"].append(style)

        if "PB" in fts:
            pact_boons.append(with_grants({"name": name, "desc": text, "src": src, "sources": meta["sources"]}, row))
            boon_info[name] = text

        if "AI" in fts:
            prereq_lvl = 0
            for p in row.get("prerequisite", []):
                if p.get("level"):
                    l = p["level"].get("level") if isinstance(p["level"], dict) else p["level"]
                    prereq_lvl = max(prereq_lvl, int(l))
            infusions.append({"name": name, "minLevel": prereq_lvl, "desc": text, "src": src, "sources": meta["sources"]})

        if "AS" in fts:
            arcane_shots.append({"name": name, "desc": text, "src": src, "sources": meta["sources"]})

        if "RN" in fts:
            runes.append({"name": name, "desc": text, "src": src, "sources": meta["sources"]})

        if "ED" in fts:
            prereq_lvl = 0
            for p in row.get("prerequisite", []):
                if p.get("level"):
                    l = p["level"].get("level") if isinstance(p["level"], dict) else p["level"]
                    prereq_lvl = max(prereq_lvl, int(l))
            elemental_disciplines.append({"name": name, "minLevel": prereq_lvl, "desc": text, "src": src, "sources": meta["sources"]})

    invocations.sort(key=lambda x: (x["lvl"], x["name"]))
    metamagic.sort(key=lambda x: x["name"])
    pact_boons.sort(key=lambda x: x["name"])
    infusions.sort(key=lambda x: (x["minLevel"], x["name"]))
    arcane_shots.sort(key=lambda x: x["name"])
    runes.sort(key=lambda x: x["name"])
    elemental_disciplines.sort(key=lambda x: (x["minLevel"], x["name"]))

    return {
        "invocations": invocations,
        "invocationInfo": inv_info,
        "metamagic": metamagic,
        "metamagicInfo": mm_info,
        "maneuvers": maneuvers,
        "fightingStyles": dict(fighting_styles),
        "styleDesc": style_desc,
        "pactBoons": pact_boons,
        "boonInfo": boon_info,
        "infusions": infusions,
        "arcaneShots": arcane_shots,
        "runes": runes,
        "elementalDisciplines": elemental_disciplines,
    }


def race_bonus(row: dict[str, Any]) -> tuple[dict[str, int], dict[str, Any]]:
    bonus: dict[str, int] = {}
    choice: dict[str, Any] = {}
    abilities = row.get("ability", [])
    if abilities:
        block = abilities[0]
        for key in ("str", "dex", "con", "int", "wis", "cha"):
            if isinstance(block.get(key), int): bonus[key] = block[key]
        choose = block.get("choose", {})
        if choose:
            choice = {"choose": choose.get("count", 1), "chooseAmt": choose.get("amount", 1), "chooseNot": [x for x in ("str", "dex", "con", "int", "wis", "cha") if x not in choose.get("from", [])]}
    return bonus, choice


# Where a race's own fluff carries no art, or only its parent race's, the image mirror often still holds a
# dedicated picture elsewhere (a later book, a subrace plate, the Monster Manual). Curated by hand.
RACE_ART = {
    "Drow": "bestiary/MM/Drow.webp",
    "Eladrin Elf": "races/MPMM/Eladrin.webp",
    "Shadar-kai Elf": "races/MPMM/Shadar-kai.webp",
    "Pallid Elf": "races/EGW/Elf (Pallid).webp",
    "Duergar Dwarf": "races/MPMM/Duergar.webp",
    "Lotusden Halfling": "races/EGW/Halfling (Lotusden).webp",
    "Deep/Svirfneblin Gnome": "races/MPMM/Deep Gnome.webp",
    "Gnome (Deep)": "races/MPMM/Deep Gnome.webp",
    "Tiefling (Variant: Devil's Tongue)": "races/SCAG/Feral Tiefling.webp",
    "Tiefling (Variant: Hellfire)": "races/SCAG/Feral Tiefling.webp",
    "Tiefling (Variant: Infernal Legacy)": "races/SCAG/Feral Tiefling.webp",
    "Tiefling (Variant: Winged)": "races/SCAG/Feral Tiefling.webp",
    "Wildhunt Shifter": "races/ERLW/Shifter (Wildhunt).webp",
    "Bugbear": "races/VGM/Bugbear.webp",
    "Hobgoblin": "races/VGM/Hobgoblin.webp",
    "Goblin (Dankwood)": "races/VGM/Goblin.webp",
    "Aven (Ibis-Headed)": "races/PSA/Aven (Ibis-Headed).webp",
    "Bullywug": "bestiary/MM/Bullywug.webp",
    "Gnoll": "bestiary/MM/Gnoll.webp",
    "Grimlock": "bestiary/MM/Grimlock.webp",
    "Kuo-Toa": "bestiary/MM/Kuo-toa.webp",
    "Troglodyte": "bestiary/MM/Troglodyte.webp",
    "Skeleton": "bestiary/MM/Skeleton.webp",
    "Zombie": "bestiary/MM/Zombie.webp",
}


def convert_races() -> tuple[list[dict[str, Any]], dict[str, Any], dict[str, Any], dict[str, Any]]:
    races_data = load(DATA / "races.json")
    fluff_races_raw = resolve_copies(load(DATA / "fluff-races.json").get("raceFluff", []))
    fluff_races, fluff_art = {}, {}
    for fl in fluff_races_raw:
        fname, fsrc = fl.get("name", "").lower(), fl.get("source", "")
        ftext = render_text(fl.get("entries", []))
        if fname and ftext:
            fluff_races[(fname, fsrc)] = ftext
            fluff_races.setdefault(fname, ftext)
        # Art lives in the 5etools image mirror; the fluff records point at it by repository-relative path.
        art = next((img["href"]["path"] for img in (fl.get("images") or []) if isinstance(img, dict) and isinstance(img.get("href"), dict) and img["href"].get("type") == "internal" and img["href"].get("path")), None)
        if fname and art:
            fluff_art[(fname, fsrc)] = art
            # Several books illustrate the same race; when no source matches, prefer the latest book we ship.
            best = fluff_art.get(fname)
            if best is None or (rank(fl) > rank(best[1]) and (allowed_source(fsrc) or not allowed_source(best[1].get("source")))):
                fluff_art[fname] = (art, fl)
    fluff_art = {k: (v[0] if isinstance(v, tuple) else v) for k, v in fluff_art.items()}
    raw_races = resolve_copies(races_data.get("race", []))
    raw_subraces = resolve_copies(races_data.get("subrace", []))
    allowed_races = latest([r for r in raw_races if allowed_source(r.get("source")) or minotaur_exception(r)], lambda x: x.get("name", ""))
    base_by_name = {r["name"].lower(): r for r in allowed_races if r.get("name")}
    full_races = []
    race_traits = {}

    for r in raw_races + raw_subraces:
        if not allowed_source(r.get("source")) and not minotaur_exception(r):
            continue
        rname = r.get("name", "")
        for entry in r.get("entries", []):
            if isinstance(entry, dict) and entry.get("name"):
                tname = strip_tags(entry["name"])
                ttext = render_text(entry.get("entries", []))
                if tname and ttext:
                    meta = source_meta(r)
                    race_traits[tname] = {"name": tname, "race": rname, "desc": ttext, "src": r.get("source"), "sources": meta["sources"]}

    for sub in raw_subraces:
        src = sub.get("source")
        if not allowed_source(src):
            continue
        base_name = sub.get("raceName")
        if not base_name:
            continue
        base = base_by_name.get(base_name.lower())
        if not base:
            continue
        merged = copy.deepcopy(base)
        sub_copy = copy.deepcopy(sub)
        sub_name = sub_copy.get("name", "")
        if sub_name == "None" or not sub_name:
            display_name = base_name
        elif base_name in sub_name:
            display_name = sub_name
        elif sub_name in {"Hill", "Mountain", "Duergar"}:
            display_name = f"{sub_name} Dwarf"
        elif sub_name in {"High", "Wood", "Drow", "Eladrin", "Sea", "Shadar-kai", "Avariel", "Ghaunadaur", "Pallid"}:
            display_name = f"{sub_name} Elf" if not sub_name.endswith("Elf") and sub_name != "Drow" else sub_name
        elif sub_name in {"Lightfoot", "Stout", "Ghostwise", "Lotusden"}:
            display_name = f"{sub_name} Halfling"
        elif sub_name in {"Rock", "Forest", "Deep", "Svirfneblin", "Deep/Svirfneblin"}:
            display_name = f"{sub_name} Gnome"
        elif sub_name in {"Protector", "Scourge", "Fallen"}:
            display_name = f"{sub_name} Aasimar"
        elif sub_name in {"Air", "Earth", "Fire", "Water"}:
            display_name = f"{sub_name} Genasi"
        elif sub_name in {"Githyanki", "Githzerai"}:
            display_name = sub_name
        elif sub_name in {"Beasthide", "Longtooth", "Swiftstride", "Wildhunt"}:
            display_name = f"{sub_name} Shifter"
        elif sub_name in {"Asmodeus", "Baalzebul", "Dispater", "Fierna", "Glasya", "Levistus", "Mammon", "Mephistopheles", "Zariel"}:
            display_name = f"Tiefling (Bloodline of {sub_name})"
        elif sub_name.startswith("Variant;"):
            display_name = f"{base_name} ({sub_name.replace('Variant;', 'Variant:').strip()})"
        elif sub_name == "Variant":
            display_name = f"Variant {base_name}"
        else:
            display_name = f"{base_name} ({sub_name})"

        merged.update({
            "name": display_name,
            "baseRace": base_name,
            "subraceName": sub_name,
            "source": src,
            "page": sub.get("page", base.get("page")),
        })
        if sub.get("ability"):
            if sub.get("overwrite", {}).get("ability"):
                merged["ability"] = copy.deepcopy(sub["ability"])
            else:
                base_ab = (base.get("ability") or [{}])[0]
                sub_ab = (sub.get("ability") or [{}])[0]
                comb_ab = {}
                for k in ("str", "dex", "con", "int", "wis", "cha"):
                    val = (base_ab.get(k) or 0) + (sub_ab.get(k) or 0)
                    if val: comb_ab[k] = val
                choose = sub_ab.get("choose") or base_ab.get("choose")
                if choose: comb_ab["choose"] = choose
                merged["ability"] = [comb_ab]
        merged["entries"] = (base.get("entries") or []) + (sub.get("entries") or [])
        if sub.get("additionalSpells"): merged["additionalSpells"] = sub["additionalSpells"]
        if sub.get("speed"): merged["speed"] = sub["speed"]
        if sub.get("darkvision"): merged["darkvision"] = sub["darkvision"]
        if sub.get("skillProficiencies"):
            merged["skillProficiencies"] = (base.get("skillProficiencies") or []) + sub["skillProficiencies"]
        for key in ("armorProficiencies", "weaponProficiencies", "toolProficiencies"):
            if sub.get(key): merged[key] = (base.get(key) or []) + sub[key]
        if sub.get("languageProficiencies"):
            merged["languageProficiencies"] = (base.get("languageProficiencies") or []) + sub["languageProficiencies"]
        full_races.append(merged)

    has_sub = {sub.get("raceName", "").lower() for sub in raw_subraces if sub.get("raceName") and allowed_source(sub.get("source"))}
    for r in raw_races:
        if allowed_source(r.get("source")) and r.get("name", "").lower() not in has_sub:
            full_races.append(r)

    rows = latest(full_races, lambda x: x.get("name", ""))
    records, runtime, langs = [], {}, {}
    for row in rows:
        bonus, choice = race_bonus(row)
        speed = row.get("speed", 30)
        if isinstance(speed, dict): speed = speed.get("walk", 30)
        text = render_text(row.get("entries", []))
        meta_names = {"age", "size", "speed", "languages", "ability score increase", "alignment", "subrace", "creature type"}
        traits = [strip_tags(x.get("name")) for x in row.get("entries", []) if isinstance(x, dict) and x.get("name") and strip_tags(x.get("name")).strip().lower() not in meta_names]
        if row["name"] == "Human":
            traits = ["+1 to all ability scores"]
        elif row["name"] == "Variant Human":
            traits = ["+1 to two different ability scores", "One extra skill proficiency", "One feat of your choice at 1st level"]
        elif row["name"] == "Custom Lineage":
            traits = ["+2 to one ability score of your choice", "Darkvision 60 ft or one extra skill", "One feat of your choice at 1st level", "Size Small or Medium (your choice)"]

        core_base_races = {
            "Hill Dwarf",
            "High Elf",
            "Lightfoot Halfling",
            "Human",
            "Dragonborn",
            "Rock Gnome",
            "Half-Elf",
            "Half-Orc",
            "Tiefling",
            "Variant Human",
            "Custom Lineage",
        }
        is_expanded = row["name"] not in core_base_races
        skills = row.get("skillProficiencies") or []
        skill_choose = next((x.get("choose") for x in skills if isinstance(x, dict) and x.get("choose")), None)
        any_skills = sum(v for x in skills if isinstance(x, dict) for k, v in x.items() if k == "any" and isinstance(v, int))
        fixed_skills = [label(k.replace("sleight of hand", "Sleight of Hand")) for x in skills if isinstance(x, dict) for k, v in x.items() if k not in {"choose", "any"} and v]
        if any_skills and not skill_choose:
            skill_choose = {"count": any_skills, "from": []}

        record = {**provenance(row, "race"), "name": row["name"], "text": text}
        records.append(record)
        base_key = row.get("baseRace", row["name"]).lower()
        fluff_of = lambda table: table.get((row["name"].lower(), row.get("source", ""))) or table.get(row["name"].lower()) or table.get((base_key, row.get("source", ""))) or table.get(base_key)
        race_flavor = fluff_of(fluff_races) or ""
        race_art = RACE_ART.get(row["name"]) or fluff_of(fluff_art)

        race_entry = {
            "bonus": bonus,
            **choice,
            "speed": speed,
            "flavor": race_flavor,
            **({"art": race_art} if race_art else {}),
            "traits": traits or ([text] if text else []),
            "src": row.get("source"),
            "sources": record["sources"],
            **({"group": "expanded"} if is_expanded else {}),
            **({"skills": skill_choose.get("count", 1)} if skill_choose else {}),
            **({"skillsFrom": [label(x) for x in skill_choose["from"]]} if skill_choose and skill_choose.get("from") else {}),
            **({"grantSkills": fixed_skills} if fixed_skills else {}),
        }
        race_profs = {k: v for k, v in structured_profs(row).items() if k in {"armor", "weapons", "tools", "toolChoice"}}
        if race_profs: race_entry["profs"] = race_profs
        race_entry = with_grants(race_entry, row)
        if row["name"] in {"Variant Human", "Custom Lineage"}:
            race_entry["optional"] = True
            race_entry["feat"] = True
            if row["name"] == "Custom Lineage":
                race_entry["lineageTrait"] = True
        runtime[row["name"]] = race_entry
        language_rows = row.get("languageProficiencies") or []
        fixed, count = [], 0
        for block in language_rows:
            if not isinstance(block, dict):
                continue
            for k, v in block.items():
                if v is True and k not in {"choose", "other"}:
                    fixed.append(label(k))
                elif k in {"anyStandard", "any", "anyExotic"} and isinstance(v, int):
                    count += v
                elif k == "choose" and isinstance(v, dict):
                    count += v.get("count", 1)
        langs[row["name"]] = {"fixed": list(dict.fromkeys(fixed)) or ["Common"], "choose": count}
    return records, runtime, langs, race_traits

def convert_backgrounds() -> tuple[list[dict[str, Any]], dict[str, Any]]:
    bg_fluff_raw = load(DATA / "fluff-backgrounds.json").get("backgroundFluff", [])
    bg_fluff = {}
    for fl in bg_fluff_raw:
        fname, fsrc = fl.get("name", "").lower(), fl.get("source", "")
        ftext = render_text(fl.get("entries", []))
        if fname and ftext:
            bg_fluff[(fname, fsrc)] = ftext
            bg_fluff.setdefault(fname, ftext)
    rows = resolve_copies(load(DATA / "backgrounds.json").get("background", []))
    rows = latest([x for x in rows if allowed_source(x.get("source"))], lambda x: x.get("name", ""))
    records, runtime = [], {}
    for row in rows:
        text = render_text(row.get("entries", []))
        skills = []
        for block in row.get("skillProficiencies", []):
            skills.extend(label(k) for k, v in block.items() if k != "choose" and v)
        language_rows = row.get("languageProficiencies") or []
        fixed_langs, language_count = [], 0
        for block in language_rows:
            if not isinstance(block, dict):
                continue
            for k, v in block.items():
                if v is True and k not in {"choose", "other"}:
                    fixed_langs.append(label(k))
                elif k in {"anyStandard", "any", "anyExotic"} and isinstance(v, int):
                    language_count += v
                elif k == "choose" and isinstance(v, dict):
                    language_count += v.get("count", 1)

        tool_rows = row.get("toolProficiencies") or []
        tool_bits = []
        for block in tool_rows:
            if not isinstance(block, dict):
                continue
            for k, v in block.items():
                if v is True and k not in {"choose"}:
                    tool_bits.append(label(k))
                elif k == "anyArtisansTool":
                    tool_bits.append("One type of artisan's tools" if v == 1 else f"{v} artisan's tools")
                elif k == "anyMusicalInstrument":
                    tool_bits.append("One musical instrument" if v == 1 else f"{v} musical instruments")
                elif k == "anyGamingSet":
                    tool_bits.append("One gaming set" if v == 1 else f"{v} gaming sets")
                elif k == "choose" and isinstance(v, dict):
                    tool_bits.append(f"Choose {v.get('count', 1)} from " + ", ".join(label(x) for x in v.get("from", [])))
        feature = next((x for x in row.get("entries", []) if isinstance(x, dict) and str(x.get("name", "")).startswith("Feature:")), None)
        record = {**provenance(row, "background"), "name": row["name"], "text": text}
        records.append(record)
        bg_flavor = bg_fluff.get((row["name"].lower(), row.get("source", ""))) or bg_fluff.get(row["name"].lower()) or ""
        if not bg_flavor:
            flavor_bits = []
            for e in row.get("entries", []):
                if isinstance(e, dict) and (str(e.get("name", "")).startswith("Feature:") or e.get("name") == "Suggested Characteristics" or e.get("type") == "list"):
                    continue
                t = render_text(e)
                if t:
                    flavor_bits.append(t)
            bg_flavor = "\n\n".join(flavor_bits)
        flavor = bg_flavor
        runtime[row["name"]] = {
            "skills": skills,
            "langs": language_count,
            "fixedLangs": fixed_langs,
            "tools": ", ".join(tool_bits) if tool_bits else render_text(row.get("toolProficiencies", [])) or None,
            "gold": 0,
            "flavor": flavor,
            "feature": strip_tags(feature.get("name", "")).replace("Feature:", "").strip() if feature else "Background Feature",
            "featureText": render_text(feature.get("entries", [])) if feature else text,
            "text": text,
            "src": row.get("source"),
            "sources": record["sources"],
        }
        runtime[row["name"]] = with_grants(runtime[row["name"]], row)
    return records, runtime


BONUS_FIELDS = {"bonusAc": "ac", "bonusSavingThrow": "save", "bonusWeapon": "weapon", "bonusSpellAttack": "spellAtk", "bonusSpellSaveDc": "spellDc"}


def item_bonus(row: dict[str, Any]) -> dict[str, int]:
    """'+1' strings on the item (or its variant template) become integers keyed ac / save / weapon / spellAtk / spellDc."""
    out = {}
    for src_key, key in BONUS_FIELDS.items():
        raw = row.get(src_key, (row.get("inherits") or {}).get(src_key))
        m = re.match(r"^\s*([+-]?\d+)", str(raw)) if raw is not None else None
        if m and int(m.group(1)): out[key] = int(m.group(1))
    # An AC bonus some items grant only to the unarmored (Bracers of Defense) or the shieldless (Badge of the Watch).
    if out.get("ac"):
        text = render_text(row.get("entries", (row.get("inherits") or {}).get("entries", []))).lower()
        clause = next((c for c in re.split(r"(?<=\.)\s+", text) if "bonus to ac" in c), "")
        if re.search(r"(wearing no armor|aren't wearing armor|not wearing armor)", clause): out["acNoArmor"] = True
        if re.search(r"(aren't using a shield|not using a shield|no shield)", clause): out["acNoShield"] = True
    return out


CLASS_WORDS = {"artificer", "barbarian", "bard", "cleric", "druid", "fighter", "monk", "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard"}
RACE_WORDS = {"dwarf", "elf", "half-elf", "warforged", "humanoid", "small humanoid", "mind flayer", "gnome", "halfling", "dragonborn", "tiefling", "human", "half-orc"}


def attune_requirement(text: str) -> dict[str, Any] | None:
    """'by a cleric or paladin of good alignment' -> {classes: [Cleric, Paladin], alignment: 'good'}.
    Only the fixed vocabulary is structured; anything else stays display-only under 'other'."""
    low = text.lower().strip().rstrip(".")
    m = re.match(r"^by (?:an? |the )?(.+?)(?: of ([a-z -]+?) alignment)?$", low)
    if not m: return {"other": text}
    subject, alignment = m.group(1), m.group(2)
    out: dict[str, Any] = {}
    if alignment: out["alignment"] = alignment.strip()
    tokens = [t.strip() for t in re.split(r",|\bor\b", subject) if t.strip()]
    tokens = [re.sub(r"^(an?|the) ", "", t) for t in tokens]
    for t in tokens:
        if t in CLASS_WORDS: out.setdefault("classes", []).append(t.capitalize())
        elif t == "spellcaster": out["spellcaster"] = True
        elif t in RACE_WORDS: out.setdefault("races", []).append(t)
        elif t == "creature": pass
        else: return {"other": text}
    return out or {"other": text}


def item_ability(row: dict[str, Any]) -> dict[str, Any] | None:
    """Ability score effects: {set: {con: 19}} for a fixed score, {add: {con: 2}} for a flat bonus. Picks are left to the table."""
    ab = row.get("ability", (row.get("inherits") or {}).get("ability"))
    if not isinstance(ab, dict): return None
    out: dict[str, Any] = {}
    static = ab.get("static")
    if isinstance(static, dict): out["set"] = {k: int(v) for k, v in static.items() if k in ("str", "dex", "con", "int", "wis", "cha") and isinstance(v, int)}
    add = {k: int(v) for k, v in ab.items() if k in ("str", "dex", "con", "int", "wis", "cha") and isinstance(v, int)}
    if add: out["add"] = add
    return {k: v for k, v in out.items() if v} or None


def item_attune(row: dict[str, Any]) -> Any:
    """True when the item needs attunement, or the condition text ('by a Spellcaster') when it names one."""
    raw = row.get("reqAttune", (row.get("inherits") or {}).get("reqAttune"))
    if raw is True: return True
    if isinstance(raw, str) and raw.strip(): return strip_tags(raw).strip()
    return None


def variant_fits(req: dict[str, Any], base: dict[str, Any]) -> bool:
    base_type = str(base.get("type", "")).split("|")[0]
    for key, want in req.items():
        ok = (
            (key in {"weapon", "armor", "sword", "axe", "bow", "crossbow", "firearm", "staff", "club", "hammer", "mace", "spear", "dagger", "polearm", "net"} and bool(base.get(key)) == bool(want))
            or (key == "type" and base_type == str(want).split("|")[0])
            or (key == "name" and base.get("name") == want)
            or (key in {"weaponCategory", "dmgType", "source"} and base.get(key) == want)
            or (key == "property" and want in (base.get("property") or []))
        )
        if not ok: return False
    return True


def variant_excluded(v: dict[str, Any], base: dict[str, Any]) -> bool:
    ex = v.get("excludes") or {}
    for key, val in ex.items():
        if key == "name" and base.get("name") in (val if isinstance(val, list) else [val]): return True
        if key == "property" and any(p in (base.get("property") or []) for p in (val if isinstance(val, list) else [val])): return True
        if key == "type" and str(base.get("type", "")).split("|")[0] in [str(x).split("|")[0] for x in (val if isinstance(val, list) else [val])]: return True
        if key in {"weapon", "armor", "sword", "axe", "bow", "crossbow", "net"} and val and base.get(key): return True
    return False


def generic_magic_items(variants: list[dict[str, Any]], bases: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Every magic-item template of an allowed source (+1 Weapon, Holy Avenger, Flame Tongue, Mariner's Armor…) applied to
    each PHB base item it fits, the way the source's own item list is built, so 'Holy Avenger Longsword' and
    '+2 Chain Mail' exist as real, equippable records carrying the template's bonuses, attunement, and text."""
    out = []
    for v in variants:
        inh = v.get("inherits") or {}
        if not allowed_source(inh.get("source")): continue
        for base in bases:
            if base.get("source") != "PHB": continue
            if not any(variant_fits(r, base) for r in v.get("requires", [])) or variant_excluded(v, base): continue
            def fill(text: str) -> str:
                return re.sub(r"\{=(\w+)(?:/[a-z]+)?\}", lambda mm: base["name"].lower() if mm.group(1) == "baseName" else str(inh.get(mm.group(1), "")), text)
            entries = [fill(e) if isinstance(e, str) else e for e in inh.get("entries", [])]
            name = f"{inh.get('namePrefix', '')}{base['name']}{inh.get('nameSuffix', '')}"
            row = {**base, **{k: val for k, val in inh.items() if k not in {"namePrefix", "nameSuffix", "entries", "nameRemove", "propertyAdd", "propertyRemove", "valueExpression", "weightExpression", "lootTables"}},
                   "name": name, "source": inh.get("source"), "page": inh.get("page"), "entries": entries, "variantOf": v.get("name")}
            out.append(row)
    return out


def convert_item(row: dict[str, Any], kind: str = "item") -> dict[str, Any]:
    text = render_text(row.get("entries", []))
    value = row.get("value")
    attached = row.get("attachedSpells") or (row.get("inherits") or {}).get("attachedSpells")
    charges = row.get("charges", (row.get("inherits") or {}).get("charges"))
    bonus = item_bonus(row)
    attune = item_attune(row)
    attune_req = attune_requirement(attune) if isinstance(attune, str) and attune.lower() != "optional" else None
    ability = item_ability(row)
    return with_grants({**provenance(row, kind), "name": row["name"], "type": row.get("type", row.get("rarity", "")), **({"charges": charges} if isinstance(charges, int) else {}), **({"bonus": bonus} if bonus else {}), **({"attune": attune} if attune else {}), **({"attuneReq": attune_req} if attune_req else {}), **({"ability": ability} if ability else {}), "weight": row.get("weight", 0), "value": (value / 100 if isinstance(value, (int, float)) else value or ""), "ac": row.get("ac", 0) if isinstance(row.get("ac", 0), (int, float)) else 0, "strReq": row.get("strength", 0), "stealthDis": bool(row.get("stealth")), "dmg1": row.get("dmg1", ""), "dmg2": row.get("dmg2", ""), "dmgType": row.get("dmgType", ""), "property": ",".join([x if isinstance(x, str) else str(x.get("uid", "")).split("|")[0] for x in row.get("property", [])] + (["M"] if row.get("weaponCategory") == "martial" else [])), "range": row.get("range", ""), "text": f"{text}\n\n{source_tail(row)}".strip()}, row, attached)


def cr_number(value: Any) -> float | int | None:
    value = value.get("cr") if isinstance(value, dict) else value
    if value in {None, "Unknown", "—"}: return None
    if value == "1/8": return .125
    if value == "1/4": return .25
    if value == "1/2": return .5
    try: return int(value)
    except (ValueError, TypeError): return None


def named_entries(rows: Any) -> list[dict[str, str]]:
    return [{"n": strip_tags(x.get("name", "")), "t": render_text(x.get("entries", []))} for x in rows or [] if x.get("name") and render_text(x.get("entries", []))]


def convert_monster(row: dict[str, Any]) -> dict[str, Any] | None:
    if not row.get("hp") or not row.get("ac") or row.get("str") is None:
        return None
    ac_rows = [x if isinstance(x, dict) else {"ac": x} for x in row.get("ac") or []]
    ac_values = [x.get("ac") for x in ac_rows if isinstance(x.get("ac"), (int, float))]
    ac_special = next((str(x["special"]) for x in ac_rows if x.get("special")), "")
    ac_special_base = re.match(r"\s*(\d+)", ac_special)
    hp = row.get("hp") or {}
    cr = cr_number(row.get("cr"))
    speed = row.get("speed") or {}
    speeds = []
    for key in ("walk", "burrow", "climb", "fly", "swim"):
        if key not in speed:
            continue
        value = speed[key].get("number") if isinstance(speed[key], dict) else speed[key]
        speeds.append(f"{'' if key == 'walk' else key + ' '}{value} ft.")
    ctype = row.get("type", "creature")
    if isinstance(ctype, dict):
        tags = ctype.get("tags") or []
        ctype = ctype.get("type", "creature") + (f" ({', '.join(x for x in tags if isinstance(x, str))})" if tags else "")
    alignment = [ALIGN.get(x) for x in row.get("alignment") or [] if isinstance(x, str) and ALIGN.get(x)]
    traits = named_entries(row.get("trait"))
    for casting in row.get("spellcasting") or []:
        traits.append({"n": strip_tags(casting.get("name", "Spellcasting")), "t": render_text(casting.get("headerEntries", []))})
    skills = row.get("skill") or {}
    senses = row.get("senses") or []
    languages = row.get("languages") or []
    return {
        **provenance(row, "creature"),
        "name": row["name"],
        "size": SIZE.get((row.get("size") or ["M"])[0], "Medium"),
        "type": ctype,
        "align": " ".join(dict.fromkeys(alignment)),
        "cr": cr,
        "xp": XP.get(cr),
        "ac": max(ac_values) if ac_values else int(ac_special_base.group(1)) if ac_special_base else None,
        "acS": strip_tags(ac_special) or None,
        "hp": hp.get("average", 1),
        "hpS": strip_tags(hp.get("special", "")) or None,
        "hd": str(hp.get("formula", "")).replace(" ", ""),
        "spd": ", ".join(speeds),
        "ab": {k: row.get(k) for k in ("str", "dex", "con", "int", "wis", "cha")},
        "skills": ", ".join(f"{label(k)} {strip_tags(v)}" for k, v in skills.items() if k != "other"),
        "sen": ", ".join([*(strip_tags(x) for x in senses), f"passive Perception {row['passive']}" if row.get("passive") is not None else ""]).strip(", "),
        "lang": ", ".join(strip_tags(x) for x in languages),
        "traits": traits or None,
        "acts": named_entries(row.get("action")) or None,
        "bonus": named_entries(row.get("bonus")) or None,
        "reacts": named_entries(row.get("reaction")) or None,
        "leg": named_entries(row.get("legendary")) or None,
    }

def normalized_title(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower().replace("’", "'"))


SOURCE_BY_TITLE = {normalized_title(row["name"]): code for code, row in SOURCES.items()}
SOURCE_BY_TITLE.update({
    normalized_title("5e SRD"): "SRD",
    normalized_title("Player's Handbook"): "PHB",
    normalized_title("Dungeon Master's Guide"): "DMG",
    normalized_title("Monster Manual"): "MM",
    normalized_title("Tasha's Cauldron of Everything"): "TCE",
    normalized_title("Xanathar's Guide to Everything"): "XGE",
    normalized_title("Sword Coast Adventurer's Guide"): "SCAG",
    normalized_title("Volo's Guide to Monsters"): "VGM",
    normalized_title("Mordenkainen's Tome of Foes"): "MTF",
})


def legacy_source(row: dict[str, Any]) -> str | None:
    direct = row.get("src")
    if direct in SOURCES:
        return direct
    if isinstance(direct, str) and normalized_title(direct) in SOURCE_BY_TITLE:
        return SOURCE_BY_TITLE[normalized_title(direct)]
    named = row.get("source")
    if named in SOURCES:
        return named
    if isinstance(named, str) and normalized_title(named) in SOURCE_BY_TITLE:
        return SOURCE_BY_TITLE[normalized_title(named)]
    match = re.search(r"Source:\s*([^,\n]+)", row.get("text", ""))
    if match:
        return SOURCE_BY_TITLE.get(normalized_title(match.group(1)))
    return None


def merge_existing(canonical: list[dict[str, Any]], existing: list[dict[str, Any]], kind: str) -> list[dict[str, Any]]:
    legacy_by_name = {slug(str(row.get("name", ""))): row for row in existing if row.get("name")}
    canonical_names = {slug(str(row.get("name", ""))) for row in canonical}
    canonical_ids = {row.get("id") for row in canonical}
    reserved = {"id", "src", "sources", "source", "page", "published", "canonical", "classes"}
    for record in canonical:
        legacy = legacy_by_name.get(slug(record["name"]))
        if not legacy:
            continue
        for key, value in legacy.items():
            if key not in reserved and (key not in record or record[key] in (None, "", [], {})):
                record[key] = copy.deepcopy(value)
        legacy_sources = [x for x in legacy.get("sources", []) if x in SOURCES]
        code = legacy_source(legacy)
        if code:
            legacy_sources.append(code)
        for source in legacy_sources:
            if source not in record["sources"]:
                record["sources"].append(source)
    for legacy in existing:
        name = str(legacy.get("name", ""))
        if not name or slug(name) in canonical_names:
            continue
        if kind == "feat" and slug(re.sub(r"\s*\([^)]*\)$", "", name)) in canonical_names:
            continue
        code = legacy_source(legacy)
        if not code or (not allowed_source(code) and code != "SRD"):
            continue
        record_id = f"{kind}:{slug(code)}:{slug(name)}"
        if record_id in canonical_ids:
            continue
        record = copy.deepcopy(legacy)
        page_match = re.search(r"Source:\s*[^,\n]+,\s*p\.\s*(\d+)", record.get("text", ""))
        record.update({
            "id": record_id,
            "src": code,
            "sources": [code],
            "source": SOURCES[code]["name"],
            "page": int(page_match.group(1)) if page_match else record.get("page"),
            "published": SOURCES[code]["published"],
        })
        canonical.append(record)
        canonical_names.add(slug(name))
        canonical_ids.add(record_id)
    return sorted(canonical, key=lambda x: (x.get("name", "").lower(), x.get("id", "")))


def bundle_art(paths: list[str]) -> None:
    """Copy the referenced images out of the 5etools image mirror so the app ships them itself."""
    if not IMG_ROOT.exists():
        raise SystemExit(f"5etools image mirror not found: {IMG_ROOT}")
    missing = [rel for rel in paths if not (IMG_ROOT / rel).exists()]
    if missing:
        raise SystemExit("race art missing from image mirror: " + ", ".join(missing))
    wanted = set(paths)
    for stale in (p for p in ART.rglob("*") if p.is_file() and str(p.relative_to(ART)) not in wanted):
        stale.unlink()
    for empty in sorted((p for p in ART.rglob("*") if p.is_dir() and not any(p.iterdir())), reverse=True):
        empty.rmdir()
    for rel in paths:
        dst = ART / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(IMG_ROOT / rel, dst)
    print(f"Bundled {len(paths)} race images into {ART}")


def main() -> None:
    if not DATA.exists():
        raise SystemExit(f"5etools data not found: {DATA}")
    existing = load(OUT) if OUT.exists() else {}
    spell_lookup = load(DATA / "generated" / "gendata-spell-source-lookup.json")
    raw_spells = collect_json("spells/spells-*.json", "spell")
    spells = latest([x for x in raw_spells if allowed_source(x.get("source"))], lambda x: x.get("name", ""))
    SPELL_CANON.update({x["name"].lower(): (x["name"], x.get("level", 0)) for x in spells})
    raw_feats = load(DATA / "feats.json").get("feat", [])
    feats = latest(resolve_copies([x for x in raw_feats if allowed_source(x.get("source"))]), lambda x: x.get("name", ""))
    classes, subs, features, feature_texts, feature_sources = convert_classes()
    optional_features, opt_feature_map = convert_optional_features()
    races, runtime_races, race_langs, race_traits = convert_races()
    backgrounds, runtime_backgrounds = convert_backgrounds()

    raw_items = load(DATA / "items-base.json").get("baseitem", [])
    raw_items += load(DATA / "items.json").get("item", []) + load(DATA / "items.json").get("itemGroup", [])
    raw_items += load(DATA / "magicvariants.json").get("magicvariant", [])
    raw_items += generic_magic_items(load(DATA / "magicvariants.json").get("magicvariant", []), load(DATA / "items-base.json").get("baseitem", []))
    items = latest([x for x in resolve_copies(raw_items) if allowed_source(x.get("source"))], lambda x: x.get("name", ""))
    raw_rewards = load(DATA / "rewards.json").get("reward", [])
    rewards = latest(resolve_copies([x for x in raw_rewards if allowed_source(x.get("source"))]), lambda x: x.get("name", ""))

    raw_monsters = collect_json("bestiary/bestiary-*.json", "monster")
    monster_rows = resolve_copies(raw_monsters)
    monster_rows = latest([x for x in monster_rows if allowed_source(x.get("source"))], lambda x: x.get("name", ""))
    bestiary = [x for x in (convert_monster(row) for row in monster_rows) if x]

    converted_feats = merge_existing([convert_feat(x) for x in feats], existing.get("feats", []), "feat")
    converted_spells = merge_existing([convert_spell(x, spell_lookup) for x in spells], existing.get("spells", []), "spell")
    converted_items = merge_existing([convert_item(x) for x in items], existing.get("items", []), "item")
    bestiary = merge_existing(bestiary, existing.get("bestiary", []), "creature")

    class_runtime = {}
    for row in classes:
        name = row["name"]
        if name.endswith(" Sidekick"):
            continue
        class_runtime[name] = {
            "name": name,
            "src": row["src"],
            "sources": row["sources"],
            "die": row["die"],
            "saves": row["saves"],
            "caster": row["caster"],
            "subLvl": row["subLvl"],
            "subName": row["subName"],
            "skills": row["skills"],
            "nSkills": row["nSkills"],
            "asi": row["asi"],
            "feats": row["features"],
            "subs": [x["name"] for x in subs.get(name, [])],
            **({"grants": row["grants"]} if row.get("grants") else {}),
        }
    mechanics = convert_mechanics_options()
    output = {
        "meta": {"schemaVersion": 2, "cutoff": CUTOFF, "exception": "XPHB Ranger and Ranger subclasses only", "report": "content-report.json"},
        "sources": sorted(SOURCES.values(), key=lambda x: (x["published"], x["code"])),
        "classes": classes, "races": races, "backgrounds": backgrounds,
        "subs": subs, "features": features, "optionalFeatures": optional_features,
        "feats": converted_feats,
        "spells": converted_spells,
        "items": converted_items,
        "rewards": [with_grants({**provenance(x, "reward"), "name": x["name"], "type": x.get("type"), "text": render_text(x.get("entries", []))}, x) for x in rewards],
        "bestiary": bestiary,
        "featureTexts": feature_texts,
        "runtime": {
            "classes": class_runtime,
            "races": runtime_races,
            "raceLangs": race_langs,
            "raceTraits": race_traits,
            "optionalFeatureMap": opt_feature_map,
            "backgrounds": runtime_backgrounds,
            "featureSources": feature_sources,
            **mechanics,
        },
        "skippedClasses": [],
    }
    counts = {k: len(v) if isinstance(v, list) else sum(len(x) for x in v.values()) if k == "subs" else len(v) for k, v in output.items() if k in {"classes", "races", "backgrounds", "subs", "features", "optionalFeatures", "feats", "spells", "items", "rewards", "bestiary"}}
    output["meta"]["counts"] = counts

    leaked = []
    def check(value: Any, path: str = "") -> None:
        if isinstance(value, dict):
            if value.get("src") == RANGER_SOURCE and not (value.get("name") == "Ranger" or value.get("className") == "Ranger" or path.startswith("subs.Ranger")):
                leaked.append(value.get("id", path))
            if value.get("src") == "MPMM" and not (value.get("name") == "Minotaur" or path.startswith("runtime.raceTraits") or path.startswith("runtime.raceLangs")):
                leaked.append(value.get("id", path))
            for key, child in value.items(): check(child, f"{path}.{key}" if path else key)
        elif isinstance(value, list):
            for i, child in enumerate(value): check(child, f"{path}[{i}]")
    check(output)
    if leaked:
        raise SystemExit("Unrelated XPHB records leaked: " + ", ".join(leaked[:20]))
    unresolved = Counter()
    def scan_tags(value: Any) -> None:
        if isinstance(value, str):
            for tag in re.findall(r"\{@([A-Za-z0-9]+)", value): unresolved[tag] += 1
        elif isinstance(value, dict):
            for child in value.values(): scan_tags(child)
        elif isinstance(value, list):
            for child in value: scan_tags(child)
    scan_tags(output)
    if unresolved:
        raise SystemExit("Unresolved 5etools tags: " + ", ".join(f"{k}={v}" for k, v in unresolved.most_common()))
    ids = []
    def collect_ids(value: Any) -> None:
        if isinstance(value, dict):
            if value.get("id"):
                ids.append(value["id"])
            for child in value.values():
                collect_ids(child)
        elif isinstance(value, list):
            for child in value:
                collect_ids(child)
    collect_ids(output)
    duplicate_ids = sorted(x for x, count in Counter(ids).items() if count > 1)
    if duplicate_ids:
        raise SystemExit("Duplicate canonical IDs: " + ", ".join(duplicate_ids[:20]))

    raw_by_domain = {
        "spells": raw_spells,
        "feats": raw_feats,
        "items": raw_items,
        "rewards": raw_rewards,
        "bestiary": raw_monsters,
    }
    rejected_by_source = {}
    for domain, rows in raw_by_domain.items():
        rejected_by_source[domain] = dict(sorted(Counter(row.get("source", "unknown") for row in rows if not allowed_source(row.get("source"))).items()))
    report = {
        "schemaVersion": 1,
        "cutoff": CUTOFF,
        "sourceCount": len(SOURCES),
        "defaultEnabled": sorted(code for code, row in SOURCES.items() if row["defaultEnabled"]),
        "selectedCounts": counts,
        "reprintsCollapsed": {
            "spells": sum(allowed_source(x.get("source")) for x in raw_spells) - len(spells),
            "feats": sum(allowed_source(x.get("source")) for x in raw_feats) - len(feats),
            "items": sum(allowed_source(x.get("source")) for x in raw_items) - len(items),
            "rewards": sum(allowed_source(x.get("source")) for x in raw_rewards) - len(rewards),
            "bestiary": sum(allowed_source(x.get("source")) for x in raw_monsters) - len(monster_rows),
        },
        "legacyRecordsPreserved": {
            "spells": len(converted_spells) - len(spells),
            "feats": len(converted_feats) - len(feats),
            "items": len(converted_items) - len(items),
            "bestiary": len(bestiary) - len(monster_rows),
        },
        "rejectedBySource": rejected_by_source,
        "validation": {
            "duplicateIds": 0,
            "unresolvedTags": 0,
            "unrelatedXphbRecords": 0,
        },
        "unresolvedSpellGrants": dict(sorted(UNRESOLVED_SPELL_REFS.items())),
    }

    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    bundle_art(sorted({entry["art"] for entry in runtime_races.values() if entry.get("art")}))
    OUT.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Baked {OUT} ({OUT.stat().st_size / 1048576:.1f} MiB)")
    print(json.dumps(counts, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
