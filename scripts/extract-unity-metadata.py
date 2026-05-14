#!/usr/bin/env python3
"""Safe Unity/Mono metadata extractor for local wiki notes.

This intentionally emits compact names, counts, fields, enum labels, and small
ScriptableObject summaries only. It does not decompile methods, dump source, or
export proprietary assets.
"""

from __future__ import annotations

import collections
import json
import math
import pathlib
import re
import struct
import sys
from typing import Any


INTERESTING_ENUM_RE = re.compile(
    r"(artifact|character|frog|visual|location|enemy|skill|feature|upgrade|quest|rarity|damage|"
    r"effect|unlock|difficulty|map|item|resource|companion|attack|tool|biome|snow|heat|warm|"
    r"game|mode|tutorial|notification|collectible|chest|reward|spawner|stat|combat)",
    re.I,
)
IMPORTANT_TYPE_RE = re.compile(
    r"(AchievementDataSO|LocationDataSO|CharacterDataSO|ArtifactDataSO|QuestDataSO|"
    r"GameModeDataSO|DifficultyLevelDataSO|MetaUpgradeSO|SkillData|EnemyPresetData|"
    r"AchievementsManager|LocationManager|CharacterManager|SkillsManager|ArtifactsManager|"
    r"QuestsManager|EnemyArenaManager|FroggyController|FroggyDiggerController|"
    r"MetaProgression|Unlock|Upgrade|Companion|Enemy|Boss|Artifact|Quest|Skill|"
    r"LevelObject|Spawner|Arena|Generation|Reward|Completion|GameSettings|StatsModifier)",
    re.I,
)
MAX_ENUM_VALUES = 140
MAX_TYPE_NAMES = 800
MAX_FIELDS = 60
MAX_SERIALIZED_ROWS = 80
MAX_STRIPPED_SCRIPT_ROWS = 260
MAX_RAW_PARSE_ERRORS = 80

CORE_STRIPPED_SCRIPTS = [
    "AchievementDataSO",
    "ArtifactDataSO",
    "CardRarityDataSO",
    "CharacterDataSO",
    "DifficultyLevelDataSO",
    "GameModeDataSO",
    "EnemySpawnerArenaData",
    "LocationDataSO",
    "LevelObjectPresetData",
    "LevelObjectSpawnerData",
    "QuestDataSO",
    "StatsModifiersDataSO",
    "StatusEffectUpgrade",
    "TerrainHeightData",
    "TerrainTextureData",
    "EnemySpawnerWavesData",
]

ENEMY_COMPONENT_SCRIPTS = {
    "Damageable",
    "Enemy",
    "EnemyArena",
    "EnemyAttackModule",
    "EnemyAttackModuleBomb",
    "EnemyAttackModuleBoss",
    "EnemyAttackModuleDash",
    "EnemyAttackModuleEffectCasting",
    "EnemyAttackModuleFlying",
    "EnemyAttackModuleFlyingDash",
    "EnemyAttackModuleFlyingShooting",
    "EnemyAttackModuleJumping",
    "EnemyAttackModuleJustAnim",
    "EnemyAttackModuleShooting",
    "EnemyAttackModuleShootingCharged",
    "EnemyAttackModuleTouch",
    "EnemyBaseModule",
    "EnemyBaseModuleBomb",
    "EnemyBaseModuleBoss",
    "EnemyBaseModuleFlying",
    "EnemyCollectingModule",
    "EnemyCollectingModuleFlying",
    "EnemyDangerEvadingModule",
    "EnemyMovementModule",
    "EnemyMovementModuleFlying",
    "EnemyMovementModuleWandering",
    "EnemyStateController",
    "EnemyTotem",
    "EnemyUpgradeModule",
}

QUEST_LINE_RE = re.compile(
    r"^(Clear|Open|Survive|Complete|Find|Collect|Defeat|Kill|Upgrade|Reach|Deal|Receive|Avoid|Revive|Unlock|Use)\b"
)
ACHIEVEMENT_RE = re.compile(r"^'(?P<title>[^']+)'\s+(?P<condition>.*?)\s+\[questID:\s*(?P<quest_id>\d+)\]$")
UNLOCK_CONDITION_RE = re.compile(r"^(?P<condition>.+?)\s+\[questID:\s*(?P<quest_id>\d+)\]$")
VALUE_RANGE_RE = re.compile(
    r"^(?:\[(?P<scaling>[ xX])\]\s*)?(?P<label>[A-Za-z][A-Za-z0-9 %/()._-]*?)\s+"
    r"(?P<start>-?\d+(?:\.\d+)?)\s*->\s*(?P<end>-?\d+(?:\.\d+)?)$"
)
CHARACTER_BONUS_RE = re.compile(r"^#(?P<slot>\d+)\s+(?P<stat_key>[A-Za-z0-9_]+)\s+\[(?P<value>-?\d+(?:\.\d+)?)\]$")
CHARACTER_SKILL_ROW_RE = re.compile(r"^(?P<unlock_step>\d+)\s+\|\s+(?P<label>[^|]+?)\s+\|\s+(?P<asset>.+)$")
ARENA_WAVE_RE = re.compile(r"^Arena #(?P<arena>\d+)[\s-]+(?P<size>\w+)[\s-]+waves\s+\[(?P<wave_count>\d+)\][\s-]*(?P<spawns>.*)$")
WAVE_SPAWN_RE = re.compile(r"^Wave #(?P<wave>\d+)\s+spawns\s+\[(?P<spawn_count>\d+)\]\s*(?P<spawns>.*)$")
SPAWN_TOKEN_RE = re.compile(r"(?P<enemy>[A-Za-z][A-Za-z0-9_ -]*?)\s+x(?P<count>\d+)(?=\s+[A-Za-z][A-Za-z0-9_ -]*?\s+x\d+|$)")
LEVEL_OBJECT_SECTION_RE = re.compile(
    r"^\[(?P<index>\d+)\](?P<enabled>\*)?\s+-+\s+(?P<name>.+?)\s+\[(?P<min>-?\d+)\s*-\s*(?P<max>-?\d+)\]\s+-+$"
)
LEVEL_OBJECT_ENTRY_RE = re.compile(r"^(?P<category>[A-Za-z]+)\s+\|\s+(?P<object>.+?)\s+x(?P<count>\d+)$")
COLLECTIBLE_PRESET_RE = re.compile(r"^(?P<name>.+?)\s+\((?P<resource>[A-Za-z0-9_]+)\s+x(?P<count>\d+)\)\s+\[obj\]$")
BOSS_ATTACK_ID_RE = re.compile(r"^\[ID:\s*(?P<id>\d+)\]\s+(?P<name>.+)$")
BOSS_PHASE_ORDER_RE = re.compile(r"^(?P<label>.+?)\s+\[ID:\s*(?P<ids>\d+(?:\s*\+\s*\d+)*)\]\s+x(?P<repeat>\d+)$")


def heap_text(value: Any) -> str:
    return str(value or "")


def coded_row(value: Any) -> Any | None:
    return getattr(value, "row", None)


def constant_value(row: Any) -> Any | None:
    data = getattr(getattr(row, "Value", None), "__data__", b"")
    type_code = int(getattr(row, "Type", 0) or 0)
    # dnfile's blob payload includes a one-byte blob-length prefix for these
    # constants. Decode from the tail so enum values are not shifted by it.
    try:
        if type_code == 2 and len(data) >= 1:
            return bool(struct.unpack("<B", data[-1:])[0])
        if type_code == 4 and len(data) >= 1:
            return struct.unpack("<b", data[-1:])[0]
        if type_code == 5 and len(data) >= 1:
            return struct.unpack("<B", data[-1:])[0]
        if type_code == 6 and len(data) >= 2:
            return struct.unpack("<h", data[-2:])[0]
        if type_code == 7 and len(data) >= 2:
            return struct.unpack("<H", data[-2:])[0]
        if type_code == 8 and len(data) >= 4:
            return struct.unpack("<i", data[-4:])[0]
        if type_code == 9 and len(data) >= 4:
            return struct.unpack("<I", data[-4:])[0]
        if type_code == 10 and len(data) >= 8:
            return struct.unpack("<q", data[-8:])[0]
        if type_code == 11 and len(data) >= 8:
            return struct.unpack("<Q", data[-8:])[0]
        if type_code == 12 and len(data) >= 4:
            return round(struct.unpack("<f", data[-4:])[0], 6)
        if type_code == 13 and len(data) >= 8:
            return round(struct.unpack("<d", data[-8:])[0], 6)
    except Exception:
        return None
    return None


def extract_managed(game_root: pathlib.Path) -> dict[str, Any]:
    result: dict[str, Any] = {
        "dnfile_available": False,
        "source_path": "FROGGY HATES SNOW_Data/Managed/Assembly-CSharp.dll",
        "enums": [],
        "scriptable_object_types": [],
        "important_type_fields": [],
        "important_type_names": [],
        "errors": [],
    }
    assembly = game_root / "FROGGY HATES SNOW_Data" / "Managed" / "Assembly-CSharp.dll"
    if not assembly.exists():
        result["errors"].append("Assembly-CSharp.dll not found.")
        return result

    try:
        import dnfile  # type: ignore
    except Exception as exc:  # pragma: no cover - depends on local extractor env
        result["errors"].append(f"dnfile unavailable: {exc}")
        return result

    result["dnfile_available"] = True
    try:
        dn = dnfile.dnPE(str(assembly))
    except Exception as exc:
        result["errors"].append(f"dnfile failed to parse assembly: {exc}")
        return result

    enum_rows: list[dict[str, Any]] = []
    scriptable_rows: list[dict[str, Any]] = []
    important_type_rows: list[dict[str, Any]] = []
    important_names: list[str] = []
    nested_owner_by_row: dict[Any, str] = {}
    constant_by_parent: dict[Any, Any] = {}

    for constant in getattr(getattr(dn.net.mdtables, "Constant", None), "rows", []):
        try:
            constant_by_parent[constant.Parent.row] = constant
        except Exception:
            continue

    for nested in getattr(getattr(dn.net.mdtables, "NestedClass", None), "rows", []):
        try:
            nested_row = nested.NestedClass.row
            owner_row = nested.EnclosingClass.row
            nested_owner_by_row[nested_row] = heap_text(getattr(owner_row, "TypeName", ""))
        except Exception:
            continue

    for row in getattr(dn.net.mdtables.TypeDef, "rows", []):
        name = heap_text(getattr(row, "TypeName", ""))
        namespace = heap_text(getattr(row, "TypeNamespace", ""))
        owner = nested_owner_by_row.get(row, "")
        display_name = f"{owner}.{name}" if owner else name
        full_name = ".".join(part for part in [namespace, owner, name] if part)
        extends = coded_row(getattr(row, "Extends", None))
        extends_name = heap_text(getattr(extends, "TypeName", ""))
        extends_namespace = heap_text(getattr(extends, "TypeNamespace", ""))
        fields = [heap_text(idx.row.Name) for idx in getattr(row, "FieldList", []) if heap_text(idx.row.Name)]

        if IMPORTANT_TYPE_RE.search(full_name):
            important_names.append(full_name)
            important_type_rows.append(
                {
                    "name": name,
                    "owner": owner or None,
                    "display_name": display_name,
                    "namespace": namespace,
                    "extends": f"{extends_namespace}.{extends_name}".strip("."),
                    "fields": fields[:MAX_FIELDS],
                    "field_count": len(fields),
                    "truncated": len(fields) > MAX_FIELDS,
                }
            )

        if extends_name == "Enum" and (INTERESTING_ENUM_RE.search(name) or any(INTERESTING_ENUM_RE.search(heap_text(idx.row.Name)) for idx in getattr(row, "FieldList", []))):
            values = [
                heap_text(idx.row.Name)
                for idx in getattr(row, "FieldList", [])
                if heap_text(idx.row.Name) != "value__"
            ]
            value_map = [
                {"name": heap_text(idx.row.Name), "value": constant_value(constant_by_parent.get(idx.row))}
                for idx in getattr(row, "FieldList", [])
                if heap_text(idx.row.Name) != "value__"
            ]
            enum_rows.append(
                {
                    "name": name,
                    "owner": owner or None,
                    "display_name": display_name,
                    "namespace": namespace,
                    "value_count": len(values),
                    "values": values[:MAX_ENUM_VALUES],
                    "value_map": value_map[:MAX_ENUM_VALUES],
                    "truncated": len(values) > MAX_ENUM_VALUES,
                }
            )

        if extends_name == "ScriptableObject" or name.endswith("DataSO"):
            if fields or IMPORTANT_TYPE_RE.search(name):
                scriptable_rows.append(
                    {
                        "name": name,
                        "owner": owner or None,
                        "display_name": display_name,
                        "namespace": namespace,
                        "extends": f"{extends_namespace}.{extends_name}".strip("."),
                        "fields": fields[:MAX_FIELDS],
                        "field_count": len(fields),
                        "truncated": len(fields) > MAX_FIELDS,
                    }
                )

    enum_rows.sort(key=lambda item: item["name"].lower())
    scriptable_rows.sort(key=lambda item: item["name"].lower())
    important_type_rows.sort(key=lambda item: heap_text(item.get("display_name")).lower())
    result["enums"] = enum_rows
    result["scriptable_object_types"] = scriptable_rows[:120]
    result["important_type_fields"] = important_type_rows[:MAX_TYPE_NAMES]
    result["important_type_names"] = sorted(set(important_names), key=str.lower)[:MAX_TYPE_NAMES]
    result["type_counts"] = {
        "typedef_rows": len(getattr(dn.net.mdtables.TypeDef, "rows", [])),
        "field_rows": len(getattr(dn.net.mdtables.Field, "rows", [])),
        "method_rows": len(getattr(dn.net.mdtables.MethodDef, "rows", [])),
    }
    return result


def safe_short(value: Any, limit: int = 120) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    return text[: limit - 1].rstrip() + "..." if len(text) > limit else text


def compact_number(value: Any) -> Any:
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return round(value, 4)
    return value


def compact_range(value: Any) -> str | None:
    if not isinstance(value, dict):
        return None
    x = value.get("x")
    y = value.get("y")
    if x is None or y is None:
        return None
    return f"{compact_number(x)}-{compact_number(y)}"


def enum_name_map(enums: list[dict[str, Any]], owner: str, name: str = "Type") -> dict[int, str]:
    for enum in enums:
        if enum.get("owner") == owner and enum.get("name") == name:
            value_map = enum.get("value_map") or []
            mapped = {
                int(item.get("value")): heap_text(item.get("name"))
                for item in value_map
                if isinstance(item, dict) and isinstance(item.get("value"), int)
            }
            if mapped:
                return mapped
            values = enum.get("values") or []
            return {index: heap_text(value) for index, value in enumerate(values)}
    return {}


def enum_value_labels(enums: list[dict[str, Any]], name: str, owner: str | None = None) -> dict[int, str]:
    for enum in enums:
        if enum.get("name") != name:
            continue
        if owner is not None and enum.get("owner") != owner:
            continue
        value_map = enum.get("value_map") or []
        mapped = {
            int(item.get("value")): heap_text(item.get("name"))
            for item in value_map
            if isinstance(item, dict) and isinstance(item.get("value"), int)
        }
        if mapped:
            return mapped
        values = enum.get("values") or []
        return {index: heap_text(value) for index, value in enumerate(values)}
    return {}


def enum_label(value: Any, labels: dict[int, str]) -> str | None:
    return labels.get(value) if isinstance(value, int) else None


def add_aggregate(bucket: dict[str, dict[str, Any]], config: dict[str, Any], example: str) -> None:
    key = json.dumps(config, sort_keys=True, ensure_ascii=False)
    row = bucket.setdefault(key, {**config, "occurrences": 0, "examples": []})
    row["occurrences"] += 1
    if example and example not in row["examples"] and len(row["examples"]) < 8:
        row["examples"].append(example)


def sorted_aggregates(bucket: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(bucket.values(), key=lambda item: (-int(item.get("occurrences", 0)), json.dumps(item, sort_keys=True)))[:MAX_SERIALIZED_ROWS]


def unity_candidate_files(game_root: pathlib.Path) -> list[pathlib.Path]:
    candidate_files = list((game_root / "FROGGY HATES SNOW_Data" / "StreamingAssets" / "aa" / "StandaloneWindows64").glob("*defaultlocalgroup*.bundle"))
    candidate_files += [
        game_root / "FROGGY HATES SNOW_Data" / "level0",
        game_root / "FROGGY HATES SNOW_Data" / "level1",
        game_root / "FROGGY HATES SNOW_Data" / "resources.assets",
        game_root / "FROGGY HATES SNOW_Data" / "sharedassets0.assets",
        game_root / "FROGGY HATES SNOW_Data" / "sharedassets1.assets",
        game_root / "FROGGY HATES SNOW_Data" / "globalgamemanagers.assets",
    ]
    return [asset_path for asset_path in candidate_files if asset_path.exists()]


def align4(offset: int) -> int:
    return (offset + 3) & ~3


def read_i32(data: bytes, offset: int, label: str = "int") -> tuple[int, int]:
    if offset + 4 > len(data):
        raise ValueError(f"missing {label} at offset {offset}")
    return struct.unpack_from("<i", data, offset)[0], offset + 4


def read_i64(data: bytes, offset: int, label: str = "long") -> tuple[int, int]:
    if offset + 8 > len(data):
        raise ValueError(f"missing {label} at offset {offset}")
    return struct.unpack_from("<q", data, offset)[0], offset + 8


def read_f32(data: bytes, offset: int, label: str = "float") -> tuple[float, int]:
    if offset + 4 > len(data):
        raise ValueError(f"missing {label} at offset {offset}")
    return round(struct.unpack_from("<f", data, offset)[0], 4), offset + 4


def read_string(data: bytes, offset: int, label: str = "string", max_len: int = 10000) -> tuple[str, int]:
    length, offset = read_i32(data, offset, f"{label} length")
    if length < 0 or length > max_len or offset + length > len(data):
        raise ValueError(f"invalid {label} length {length} at offset {offset - 4}")
    return data[offset : offset + length].decode("utf-8", "replace"), align4(offset + length)


def read_pptr(data: bytes, offset: int, label: str = "pptr") -> tuple[dict[str, int], int]:
    file_id, offset = read_i32(data, offset, f"{label} file_id")
    path_id, offset = read_i64(data, offset, f"{label} path_id")
    return {"file_id": file_id, "path_id": path_id}, offset


def read_color(data: bytes, offset: int, label: str = "color") -> tuple[dict[str, float], int]:
    red, offset = read_f32(data, offset, f"{label}.r")
    green, offset = read_f32(data, offset, f"{label}.g")
    blue, offset = read_f32(data, offset, f"{label}.b")
    alpha, offset = read_f32(data, offset, f"{label}.a")
    return {"r": red, "g": green, "b": blue, "a": alpha}, offset


def require_count(value: int, label: str, limit: int = 1000) -> int:
    if value < 0 or value > limit:
        raise ValueError(f"invalid {label} count {value}")
    return value


def compact_serialized_float(value: float) -> int | float:
    rounded = round(value, 4)
    return int(rounded) if float(rounded).is_integer() else rounded


def pptr_path_id(ref: dict[str, Any]) -> int | None:
    path_id = ref.get("path_id") if isinstance(ref, dict) else None
    return int(path_id) if isinstance(path_id, int) and path_id != 0 else None


def asset_file_name(assets_file: Any) -> str:
    name = getattr(assets_file, "name", None) or getattr(assets_file, "path", None) or ""
    return pathlib.PurePosixPath(str(name).replace("\\", "/")).name or str(name)


def build_script_map(env: Any) -> dict[int, str]:
    scripts: dict[int, str] = {}
    for obj in env.objects:
        if str(obj.type.name) != "MonoScript":
            continue
        try:
            data = obj.read()
            class_name = getattr(data, "m_ClassName", "") or getattr(data, "m_Name", "") or ""
            if class_name:
                scripts[int(obj.path_id)] = heap_text(class_name)
        except Exception:
            continue
    return scripts


def build_game_object_map(env: Any) -> dict[int, str]:
    game_objects: dict[int, str] = {}
    for obj in env.objects:
        if str(obj.type.name) != "GameObject":
            continue
        try:
            data = obj.read()
            name = getattr(data, "m_Name", "") or ""
            if name:
                game_objects[int(obj.path_id)] = safe_short(name, 180)
        except Exception:
            continue
    return game_objects


def parse_mono_header(obj: Any, scripts_by_id: dict[int, str], game_objects_by_id: dict[int, str] | None = None) -> dict[str, Any]:
    raw = obj.get_raw_data()
    if len(raw) < 32:
        raise ValueError("MonoBehaviour raw payload too short")
    game_object, _ = read_pptr(raw, 0, "m_GameObject")
    script_ref, _ = read_pptr(raw, 16, "m_Script")
    object_name, payload_offset = read_string(raw, 28, "m_Name", max_len=1000)
    if not object_name and game_objects_by_id:
        object_name = game_objects_by_id.get(int(game_object.get("path_id", 0)), "")
    script_path_id = int(script_ref.get("path_id", 0))
    return {
        "object_path_id": int(obj.path_id),
        "source_asset": asset_file_name(obj.assets_file),
        "game_object_ref": game_object,
        "script_ref": script_ref,
        "script_path_id": script_path_id,
        "script_name": scripts_by_id.get(script_path_id, ""),
        "object_name": safe_short(object_name, 180),
        "payload_offset": payload_offset,
        "payload": raw[payload_offset:],
        "raw_len": len(raw),
        "payload_len": len(raw) - payload_offset,
    }


def scan_payload_strings(data: bytes, max_items: int = 80, min_len: int = 2, max_len: int = 220) -> list[dict[str, Any]]:
    strings: list[dict[str, Any]] = []
    seen: set[str] = set()
    offset = 0
    while offset <= len(data) - 4 and len(strings) < max_items:
        try:
            length = struct.unpack_from("<i", data, offset)[0]
        except Exception:
            break
        if min_len <= length <= max_len and offset + 4 + length <= len(data):
            raw = data[offset + 4 : offset + 4 + length]
            try:
                text = raw.decode("utf-8")
            except UnicodeDecodeError:
                offset += 4
                continue
            stripped = re.sub(r"\s+", " ", text).strip()
            if any(ord(char) < 32 and char not in "\n\t" for char in text):
                offset += 4
                continue
            printable_count = sum(1 for char in text if char == "\n" or char == "\t" or 31 < ord(char) < 127)
            printable_ratio = printable_count / max(len(text), 1)
            if stripped and printable_ratio >= 0.85 and re.search(r"[A-Za-z0-9%*]", stripped):
                clean = safe_short(stripped, 180)
                if clean not in seen:
                    strings.append({"offset": offset, "text": clean})
                    seen.add(clean)
                offset = max(offset + 4, align4(offset + 4 + length))
                continue
        offset += 4
    return strings


def parse_progression_value(data: bytes, offset: int, label: str = "progression") -> tuple[dict[str, Any], int]:
    value_count, offset = read_i32(data, offset, f"{label}.valueCount")
    curve_key_count, offset = read_i32(data, offset, f"{label}.valueCurve key count")
    require_count(curve_key_count, f"{label}.valueCurve", 200)
    first_curve_key: dict[str, Any] | None = None
    last_curve_key: dict[str, Any] | None = None
    for index in range(curve_key_count):
        time, offset = read_f32(data, offset, f"{label}.curve[{index}].time")
        value, offset = read_f32(data, offset, f"{label}.curve[{index}].value")
        in_slope, offset = read_f32(data, offset, f"{label}.curve[{index}].inSlope")
        out_slope, offset = read_f32(data, offset, f"{label}.curve[{index}].outSlope")
        weighted_mode, offset = read_i32(data, offset, f"{label}.curve[{index}].weightedMode")
        in_weight, offset = read_f32(data, offset, f"{label}.curve[{index}].inWeight")
        out_weight, offset = read_f32(data, offset, f"{label}.curve[{index}].outWeight")
        curve_key = {
            "time": compact_serialized_float(time),
            "value": compact_serialized_float(value),
            "in_slope": compact_serialized_float(in_slope),
            "out_slope": compact_serialized_float(out_slope),
            "weighted_mode": weighted_mode,
            "in_weight": compact_serialized_float(in_weight),
            "out_weight": compact_serialized_float(out_weight),
        }
        if index == 0:
            first_curve_key = curve_key
        last_curve_key = curve_key

    pre_wrap_mode, offset = read_i32(data, offset, f"{label}.preWrapMode")
    post_wrap_mode, offset = read_i32(data, offset, f"{label}.postWrapMode")
    rotation_order, offset = read_i32(data, offset, f"{label}.rotationOrder")
    round_to_value, offset = read_f32(data, offset, f"{label}.roundToValue")
    start_value, offset = read_f32(data, offset, f"{label}.startValue")
    end_value, offset = read_f32(data, offset, f"{label}.endValue")
    is_auto_update, offset = read_i32(data, offset, f"{label}.isAutoUpdate")
    values_count, offset = read_i32(data, offset, f"{label}.values count")
    require_count(values_count, f"{label}.values", 500)
    values: list[int | float] = []
    for index in range(values_count):
        value, offset = read_f32(data, offset, f"{label}.values[{index}]")
        values.append(compact_serialized_float(value))

    row: dict[str, Any] = {
        "value_count": value_count,
        "curve_key_count": curve_key_count,
        "pre_wrap_mode": pre_wrap_mode,
        "post_wrap_mode": post_wrap_mode,
        "rotation_order": rotation_order,
        "round_to_value": compact_serialized_float(round_to_value),
        "start": compact_serialized_float(start_value),
        "end": compact_serialized_float(end_value),
        "is_auto_update": bool(is_auto_update),
        "values": values,
    }
    if first_curve_key:
        row["first_curve_key"] = first_curve_key
    if last_curve_key and last_curve_key != first_curve_key:
        row["last_curve_key"] = last_curve_key
    return row, offset


def parse_stat_visuals(data: bytes, offset: int, label: str = "statDataVisuals") -> tuple[dict[str, Any], int]:
    debug_string, offset = read_string(data, offset, f"{label}.debugString")
    override_text, offset = read_i32(data, offset, f"{label}.overrideText")
    text, offset = read_string(data, offset, f"{label}.text")
    override_delta_value_text, offset = read_i32(data, offset, f"{label}.overrideDeltaValueText")
    delta_value_text, offset = read_string(data, offset, f"{label}.deltaValueText")
    icon, offset = read_pptr(data, offset, f"{label}.icon")
    visual_type, offset = read_i32(data, offset, f"{label}.type")
    return {
        "debug_string": safe_short(debug_string, 160),
        "override_text": bool(override_text),
        "text": text,
        "override_delta_value_text": bool(override_delta_value_text),
        "delta_value_text": delta_value_text,
        "icon_ref": icon,
        "type_id": visual_type,
    }, offset


def parse_compact_quest_rows(data: bytes, offset: int, count: int, label: str = "quest") -> tuple[list[dict[str, Any]], int]:
    require_count(count, label, 100)
    rows: list[dict[str, Any]] = []
    for index in range(count):
        text, offset = read_string(data, offset, f"{label}[{index}].text")
        if offset + 52 > len(data):
            raise ValueError(f"missing compact {label}[{index}] fields at offset {offset}")
        fields = [struct.unpack_from("<i", data, offset + 4 * field_index)[0] for field_index in range(13)]
        target_value = struct.unpack_from("<f", data, offset + 24)[0]
        rows.append(
            {
                "index": fields[0],
                "logic_id": fields[1],
                "text": text,
                "condition_ref_id": fields[5],
                "target_value": compact_serialized_float(target_value),
                "icon_ref": {
                    "file_id": fields[8],
                    "path_id": fields[9] + (fields[10] << 32),
                },
            }
        )
        offset += 52
    return rows, offset


def parse_character_payload_structured(
    data: bytes,
    offset: int,
    level_count: int,
    stat_labels: dict[int, str],
    visual_labels: dict[int, str],
) -> dict[str, Any]:
    def parse_stat_and_skill_lists(candidate_offset: int) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], int]:
        stat_count, current_offset = read_i32(data, candidate_offset, "statsList count")
        require_count(stat_count, "statsList", 80)
        if stat_count <= 0:
            raise ValueError("empty statsList")
        stats: list[dict[str, Any]] = []
        bonuses: list[dict[str, Any]] = []
        for index in range(stat_count):
            stat_name, current_offset = read_string(data, current_offset, f"stat[{index}].name")
            if index == 0 and not stat_name.startswith("#1"):
                raise ValueError(f"statsList candidate at {candidate_offset} does not start with #1")
            stat_item_name, current_offset = read_string(data, current_offset, f"stat[{index}].statItem.name")
            stat_id, current_offset = read_i32(data, current_offset, f"stat[{index}].statItem.id")
            value, current_offset = read_f32(data, current_offset, f"stat[{index}].statItem.value")
            visuals, current_offset = parse_stat_visuals(data, current_offset, f"stat[{index}].visuals")
            row = {
                "slot": index + 1,
                "source_label": safe_short(stat_name, 160),
                "stat_item_name": safe_short(stat_item_name, 120),
                "stat_id": stat_id,
                "stat": enum_label(stat_id, stat_labels),
                "value": compact_serialized_float(value),
                "display_label": visuals.get("text") or enum_label(stat_id, stat_labels),
                "display_delta": visuals.get("delta_value_text") or "",
                "visuals": visuals,
            }
            bonus_match = CHARACTER_BONUS_RE.match(stat_name)
            if bonus_match:
                row["stat_key"] = bonus_match.group("stat_key")
            stats.append(row)
            bonuses.append(
                {
                    "slot": row["slot"],
                    "stat_id": stat_id,
                    "stat": row["stat"],
                    "stat_key": row.get("stat_key") or row["stat"],
                    "value": row["value"],
                    "display_label": row["display_label"],
                    "display_delta": row["display_delta"],
                }
            )

        group_count, current_offset = read_i32(data, current_offset, "skillList count")
        require_count(group_count, "skillList", 120)
        if group_count <= 0:
            raise ValueError("empty skillList")
        skills: list[dict[str, Any]] = []
        for group_index in range(group_count):
            group_label, current_offset = read_string(data, current_offset, f"skillGroup[{group_index}].name")
            if group_index == 0 and not group_label.startswith("#1"):
                raise ValueError(f"skillList candidate at {candidate_offset} does not start with #1")
            feature_count, current_offset = read_i32(data, current_offset, f"skillGroup[{group_index}].features count")
            require_count(feature_count, f"skillGroup[{group_index}].features", 40)
            group_match = re.match(r"^#(?P<group>\d+)\s+\|", group_label)
            group_number = int(group_match.group("group")) if group_match else group_index + 1
            for feature_index in range(feature_count):
                feature_label, current_offset = read_string(data, current_offset, f"skillGroup[{group_index}].feature[{feature_index}].name")
                unlock_level, current_offset = read_i32(data, current_offset, f"skillGroup[{group_index}].feature[{feature_index}].unlockLevel")
                feature_ref, current_offset = read_pptr(data, current_offset, f"skillGroup[{group_index}].feature[{feature_index}].upgradeFeature")
                skill_match = CHARACTER_SKILL_ROW_RE.match(feature_label)
                label = safe_short(skill_match.group("label"), 120) if skill_match else safe_short(feature_label, 120)
                asset = safe_short(skill_match.group("asset"), 120) if skill_match else safe_short(feature_label, 120)
                skills.append(
                    {
                        "group": group_number,
                        "group_label": safe_short(group_label, 160),
                        "unlock_step": unlock_level,
                        "label": label,
                        "asset": asset,
                        "feature_ref": feature_ref,
                        "feature_path_id": pptr_path_id(feature_ref),
                        "empty_slot": label.lower() == "none" or asset.lower() == "empty",
                    }
                )
        return bonuses, stats, skills, current_offset

    level_upgrade_experience, offset = parse_progression_value(data, offset, "levelUpgradeExperience")
    visual_id, offset = read_i32(data, offset, "characterVisualID")
    quest_count, offset = read_i32(data, offset, "character quests count")
    require_count(quest_count, "character quests", 40)

    quest_search_start = offset
    quest_strings = scan_payload_strings(data[quest_search_start:], max_items=quest_count * 3 + 12)
    quests: list[dict[str, Any]] = []
    for item in quest_strings:
        unlock_match = UNLOCK_CONDITION_RE.match(item["text"])
        if unlock_match:
            quests.append(
                {
                    "index": len(quests),
                    "text": item["text"],
                    "condition": unlock_match.group("condition"),
                    "quest_id": int(unlock_match.group("quest_id")),
                    "source_offset": quest_search_start + int(item["offset"]),
                }
            )
        if len(quests) >= quest_count:
            break

    best_parse: tuple[int, list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], int] | None = None
    search_end = min(len(data) - 4, offset + 700)
    for candidate_offset in range(offset, search_end + 1, 4):
        try:
            candidate_bonuses, candidate_stats, candidate_skills, parsed_offset = parse_stat_and_skill_lists(candidate_offset)
        except Exception:
            continue
        score = (1 if parsed_offset == len(data) else 0, len(candidate_stats), len(candidate_skills), candidate_offset)
        if best_parse is None or score > (1 if best_parse[4] == len(data) else 0, len(best_parse[2]), len(best_parse[3]), best_parse[0]):
            best_parse = (candidate_offset, candidate_bonuses, candidate_stats, candidate_skills, parsed_offset)
        if parsed_offset == len(data):
            break

    if best_parse is None:
        raise ValueError(f"could not find statsList after character quests at offset {offset}")

    stat_list_offset, bonuses, stats, skills, parsed_offset = best_parse
    stat_count, _ = read_i32(data, stat_list_offset, "statsList count")
    # Restore the final offset from the successful candidate parse; the read
    # above is only kept as a cheap sanity check that the chosen offset still
    # points at the expected stats count.
    if stat_count != len(stats):
        raise ValueError(f"chosen statsList offset {stat_list_offset} changed during parse")
    offset = parsed_offset

    return {
        "level_upgrade_experience": level_upgrade_experience,
        "visual_id": visual_id,
        "visual": enum_label(visual_id, visual_labels),
        "character_quest_count": quest_count,
        "character_quests": quests,
        "character_bonuses": bonuses,
        "character_stats": stats,
        "skill_progression": skills,
        "stats_list_offset": stat_list_offset,
        "structured_payload_bytes_read": offset,
        "structured_payload_complete": offset == len(data),
        "level_count_matches_xp_values": level_count == len(level_upgrade_experience.get("values", [])),
    }


def parse_character_data(
    header: dict[str, Any],
    stat_labels: dict[int, str] | None = None,
    visual_labels: dict[int, str] | None = None,
) -> dict[str, Any]:
    data = header["payload"]
    offset = 0
    character_id, offset = read_i32(data, offset, "characterID")
    character_name, offset = read_string(data, offset, "characterName")
    specialty, offset = read_string(data, offset, "characterSpecialty")
    _icon, offset = read_pptr(data, offset, "characterIcon")
    _image, offset = read_pptr(data, offset, "characterImage")
    unlock_cost, offset = read_i32(data, offset, "unlockCost")
    level_count, offset = read_i32(data, offset, "levelCount")
    strings = [item["text"] for item in scan_payload_strings(data[offset:], max_items=120)]
    row = {
        "object_path_id": header["object_path_id"],
        "id": character_id,
        "name": character_name,
        "specialty": specialty,
        "unlock_cost": unlock_cost,
        "level_count": level_count,
        "object_name": header["object_name"],
        "source_asset": header["source_asset"],
        "payload_len": header["payload_len"],
        "debug_or_test_asset": bool(re.search(r"debug|test", header["object_name"], re.I)),
        "embedded_progression_strings": strings,
    }
    row.update(parse_structured_strings(strings))
    row.update(parse_character_progression(strings))
    try:
        row.update(parse_character_payload_structured(data, offset, level_count, stat_labels or {}, visual_labels or {}))
    except Exception as exc:
        row["structured_parse_error"] = str(exc)
    return row


def parse_location_data(header: dict[str, Any]) -> dict[str, Any]:
    data = header["payload"]
    offset = 0
    location_id, offset = read_i32(data, offset, "locationID")
    location_name, offset = read_string(data, offset, "locationName")
    _image, offset = read_pptr(data, offset, "locationImage")
    unlock_cost, offset = read_i32(data, offset, "unlockCost")
    quest_count, offset = read_i32(data, offset, "quests count")
    parsed_quests: list[dict[str, Any]] = []
    quest_offset = offset
    try:
        parsed_quests, quest_offset = parse_compact_quest_rows(data, offset, quest_count, "locationQuest")
    except Exception:
        quest_offset = offset
    strings = scan_payload_strings(data[offset:], max_items=100)
    all_strings = [item["text"] for item in strings]
    quest_lines = [item["text"] for item in strings if QUEST_LINE_RE.search(item["text"])]
    completion_reward_strings = [text for text in all_strings if re.match(r"^(?:Res\d+|Key)\s+x-?\d+", text)]
    row = {
        "object_path_id": header["object_path_id"],
        "id": location_id,
        "name": location_name,
        "unlock_cost": unlock_cost,
        "quest_count": quest_count,
        "parsed_quests": parsed_quests,
        "quest_lines": quest_lines[:quest_count] if quest_count > 0 else quest_lines[:8],
        "completion_reward_strings": completion_reward_strings[:12],
        "post_quest_payload_offset": quest_offset,
        "object_name": header["object_name"],
        "source_asset": header["source_asset"],
        "payload_len": header["payload_len"],
    }
    try:
        row.update(parse_location_generation_and_settings(data, quest_offset))
    except Exception as exc:
        row["structured_location_parse_error"] = str(exc)
    return row


def parse_simple_progression_params(data: bytes, offset: int, label: str) -> tuple[dict[str, Any], int]:
    value_count, offset = read_i32(data, offset, f"{label}.valueCount")
    start_value, offset = read_f32(data, offset, f"{label}.startValue")
    end_value, offset = read_f32(data, offset, f"{label}.endValue")
    round_to_value, offset = read_f32(data, offset, f"{label}.roundToValue")
    return {
        "value_count": value_count,
        "start": compact_serialized_float(start_value),
        "end": compact_serialized_float(end_value),
        "round_to_value": compact_serialized_float(round_to_value),
    }, offset


def parse_location_generation_and_settings(data: bytes, offset: int) -> dict[str, Any]:
    height_data, offset = read_pptr(data, offset, "levelGenerationData.heightData")
    texture_data, offset = read_pptr(data, offset, "levelGenerationData.textureData")
    main_spawner, offset = read_pptr(data, offset, "levelGenerationData.mainLevelObjectSpawnerData")
    secondary_spawner, offset = read_pptr(data, offset, "levelGenerationData.secondaryLevelObjectSpawnerData")
    ring_count, offset = read_i32(data, offset, "levelGenerationData.pitHintsData.rings count")
    require_count(ring_count, "pitHintsData.rings", 20)
    pit_hint_rings: list[dict[str, Any]] = []
    for ring_index in range(ring_count):
        ring_id, offset = read_i32(data, offset, f"pitHintRing[{ring_index}].ring")
        hint_count, offset = read_i32(data, offset, f"pitHintRing[{ring_index}].hints count")
        require_count(hint_count, f"pitHintRing[{ring_index}].hints", 40)
        hints: list[dict[str, Any]] = []
        for hint_index in range(hint_count):
            hint_type, offset = read_i32(data, offset, f"pitHintRing[{ring_index}].hint[{hint_index}].type")
            chance, offset = read_f32(data, offset, f"pitHintRing[{ring_index}].hint[{hint_index}].chance")
            hints.append({"type_id": hint_type, "chance": compact_serialized_float(chance)})
        pit_hint_rings.append({"ring": ring_id, "hints": hints})
    enemy_spawner, offset = read_pptr(data, offset, "levelGenerationData.enemySpawnerData")

    is_player_immortal, offset = read_i32(data, offset, "gameSettingsData.isPlayerImmortal")
    resource_count, offset = read_i32(data, offset, "gameSettingsData.startResources count")
    require_count(resource_count, "startResources", 40)
    start_resources: list[dict[str, Any]] = []
    for resource_index in range(resource_count):
        label, offset = read_string(data, offset, f"startResource[{resource_index}].name")
        resource_id, offset = read_i32(data, offset, f"startResource[{resource_index}].resourceID")
        count, offset = read_i32(data, offset, f"startResource[{resource_index}].count")
        start_resources.append({"label": label, "resource_id": resource_id, "count": count})

    start_feature_count, offset = read_i32(data, offset, "gameSettingsData.startUpgradeFeatures count")
    require_count(start_feature_count, "startUpgradeFeatures", 80)
    start_upgrade_features: list[dict[str, int]] = []
    for feature_index in range(start_feature_count):
        feature, offset = read_pptr(data, offset, f"startUpgradeFeature[{feature_index}]")
        start_upgrade_features.append(feature)
    start_upgrade_level_percent, offset = read_f32(data, offset, "gameSettingsData.startUpgradeLevelPercent")
    upgrade_card_spawn_count, offset = read_i32(data, offset, "gameSettingsData.upgradeCardSpawnCountOnArenaEnd")
    enemy_upgrade_level_params, offset = parse_simple_progression_params(data, offset, "gameSettingsData.enemyUpgradeLevelParams")
    arena_spawn_time_params, offset = parse_simple_progression_params(data, offset, "gameSettingsData.arenaSpawnTimeParams")

    # A four-byte zero separates these stripped fields in the current build.
    alignment_padding, offset = read_i32(data, offset, "location.trailingAlignment")
    completion_reward, offset = read_pptr(data, offset, "completionReward")
    unlock_runs_target, offset = read_i32(data, offset, "unlockLocationRunsCompletedTargetCount")
    tree_scale, offset = read_f32(data, offset, "treeScale")
    enabled_tree_percent, offset = read_f32(data, offset, "enabledTreePercent")

    return {
        "level_generation": {
            "height_data_ref": height_data,
            "texture_data_ref": texture_data,
            "main_level_object_spawner_ref": main_spawner,
            "secondary_level_object_spawner_ref": secondary_spawner,
            "pit_hint_rings": pit_hint_rings,
            "enemy_spawner_ref": enemy_spawner,
        },
        "game_settings": {
            "is_player_immortal": bool(is_player_immortal),
            "start_resources": start_resources,
            "start_upgrade_features": start_upgrade_features,
            "start_upgrade_level_percent": compact_serialized_float(start_upgrade_level_percent),
            "upgrade_card_spawn_count_on_arena_end": upgrade_card_spawn_count,
            "enemy_upgrade_level_params": enemy_upgrade_level_params,
            "arena_spawn_time_params": arena_spawn_time_params,
        },
        "location_reward": {
            "alignment_padding": alignment_padding,
            "completion_reward_ref": completion_reward,
            "unlock_location_runs_completed_target_count": unlock_runs_target,
            "tree_scale": compact_serialized_float(tree_scale),
            "enabled_tree_percent": compact_serialized_float(enabled_tree_percent),
        },
        "structured_location_payload_bytes_read": offset,
        "structured_location_payload_complete": offset == len(data),
    }


def parse_artifact_upgradable_stats(
    data: bytes,
    offset: int,
    count: int,
    stat_labels: dict[int, str],
) -> tuple[list[dict[str, Any]], int]:
    require_count(count, "upgradableStats", 120)
    rows: list[dict[str, Any]] = []
    for stat_index in range(count):
        source_label, offset = read_string(data, offset, f"artifactStat[{stat_index}].name")
        level_count, offset = read_i32(data, offset, f"artifactStat[{stat_index}].levelCount")
        stat_id, offset = read_i32(data, offset, f"artifactStat[{stat_index}].statID")
        parameter_count, offset = read_i32(data, offset, f"artifactStat[{stat_index}].parameterValues count")
        require_count(parameter_count, f"artifactStat[{stat_index}].parameterValues", 120)
        parameter_values: list[dict[str, Any]] = []
        for value_index in range(parameter_count):
            editor_name, offset = read_string(data, offset, f"artifactStat[{stat_index}].parameter[{value_index}].editorName")
            title, offset = read_string(data, offset, f"artifactStat[{stat_index}].parameter[{value_index}].title")
            progression_value, offset = parse_progression_value(data, offset, f"artifactStat[{stat_index}].parameter[{value_index}].progressionValue")
            display_on_ui, offset = read_i32(data, offset, f"artifactStat[{stat_index}].parameter[{value_index}].displayOnUI")
            display_decimal_count, offset = read_i32(data, offset, f"artifactStat[{stat_index}].parameter[{value_index}].displayDecimalCount")
            display_suffix, offset = read_string(data, offset, f"artifactStat[{stat_index}].parameter[{value_index}].displaySuffix")
            parameter_values.append(
                {
                    "editor_name": safe_short(editor_name, 160),
                    "title": safe_short(title, 160),
                    "progression_value": progression_value,
                    "display_on_ui": bool(display_on_ui),
                    "display_decimal_count": display_decimal_count,
                    "display_suffix": display_suffix,
                }
            )
        display_stat_on_ui, offset = read_i32(data, offset, f"artifactStat[{stat_index}].displayStatOnUI")
        visuals, offset = parse_stat_visuals(data, offset, f"artifactStat[{stat_index}].visuals")
        rows.append(
            {
                "source_label": safe_short(source_label, 160),
                "level_count": level_count,
                "stat_id": stat_id,
                "stat": enum_label(stat_id, stat_labels),
                "parameter_values": parameter_values,
                "display_stat_on_ui": bool(display_stat_on_ui),
                "visuals": visuals,
            }
        )
    return rows, offset


def parse_artifact_data(
    header: dict[str, Any],
    rarity_labels: dict[int, str],
    stat_labels: dict[int, str] | None = None,
) -> dict[str, Any]:
    data = header["payload"]
    offset = 0
    artifact_id, offset = read_i32(data, offset, "artifactID")
    rarity_id, offset = read_i32(data, offset, "artifactRarity")
    artifact_name, offset = read_string(data, offset, "artifactName")
    _image, offset = read_pptr(data, offset, "artifactImage")
    glow, offset = read_color(data, offset, "iconGlowColor")
    _flat_icon, offset = read_pptr(data, offset, "artifactFlatIcon")
    weight, offset = read_i32(data, offset, "weight")
    level_count, offset = read_i32(data, offset, "levelCount")
    stat_count, stat_offset = read_i32(data, offset, "upgradableStats count")
    strings = [item["text"] for item in scan_payload_strings(data[stat_offset:], max_items=50)]
    stat_strings = [
        value
        for value in strings
        if value != artifact_name and value.lower() not in {"param", "value"} and (("->" in value) or ("%" in value) or value.startswith("#") or len(value) > 10)
    ]
    row = {
        "object_path_id": header["object_path_id"],
        "id": artifact_id,
        "name": artifact_name,
        "rarity_id": rarity_id,
        "rarity": enum_label(rarity_id, rarity_labels),
        "weight": weight,
        "level_count": level_count,
        "upgradable_stat_count": stat_count,
        "icon_glow_color": glow,
        "object_name": header["object_name"],
        "source_asset": header["source_asset"],
        "payload_len": header["payload_len"],
        "embedded_stat_strings": stat_strings[:18],
    }
    row.update(parse_structured_strings(stat_strings))
    attach_value_sequences(row, data)
    try:
        upgradable_stats, parsed_offset = parse_artifact_upgradable_stats(data, stat_offset, stat_count, stat_labels or {})
        row["upgradable_stats"] = upgradable_stats
        row["structured_payload_bytes_read"] = parsed_offset
        row["structured_payload_complete"] = parsed_offset == len(data)
    except Exception as exc:
        row["structured_stat_parse_error"] = str(exc)
    return row


def parse_quest_data(header: dict[str, Any]) -> list[dict[str, Any]]:
    data = header["payload"]
    offset = 0
    count, offset = read_i32(data, offset, "questsDataList count")
    rows: list[dict[str, Any]] = []
    for index in range(count):
        debug_string, offset = read_string(data, offset, f"quest[{index}].debugString")
        logic_id, offset = read_i32(data, offset, f"quest[{index}].questLogicsID")
        text, offset = read_string(data, offset, f"quest[{index}].text")
        _icon, offset = read_pptr(data, offset, f"quest[{index}].icon")
        rows.append({"index": index, "logic_id": logic_id, "debug_label": debug_string, "text": text})
    return rows


def parse_stats_modifiers(header: dict[str, Any]) -> dict[str, Any]:
    data = header["payload"]
    offset = 0
    count, offset = read_i32(data, offset, "data count")
    rows: list[dict[str, Any]] = []
    for index in range(count):
        label, offset = read_string(data, offset, f"modifier[{index}].name")
        stat_id, offset = read_i32(data, offset, f"modifier[{index}].statID")
        value, offset = read_f32(data, offset, f"modifier[{index}].value")
        rows.append({"label": safe_short(label, 120), "stat_id": stat_id, "value_percent": value})
    return {
        "name": header["object_name"],
        "source_asset": header["source_asset"],
        "modifier_count": count,
        "modifiers": rows,
    }


def parse_mode_or_difficulty(header: dict[str, Any], id_label: str, labels: dict[int, str]) -> dict[str, Any]:
    data = header["payload"]
    offset = 0
    mode_id, offset = read_i32(data, offset, id_label)
    mode_name, offset = read_string(data, offset, "modeName")
    _icon, offset = read_pptr(data, offset, "icon")
    main_color, offset = read_color(data, offset, "mainColor")
    glow_color, offset = read_color(data, offset, "glowColor")
    return {
        "id": mode_id,
        "enum_label": enum_label(mode_id, labels),
        "localization_key": mode_name,
        "object_name": header["object_name"],
        "source_asset": header["source_asset"],
        "main_color": main_color,
        "glow_color": glow_color,
    }


def parse_card_rarity(header: dict[str, Any], rarity_labels: dict[int, str]) -> dict[str, Any]:
    data = header["payload"]
    offset = 0
    name, offset = read_string(data, offset, "name")
    rarity_id, offset = read_i32(data, offset, "rarity")
    localization_key, offset = read_string(data, offset, "localizationKey")
    upgrade_chance, offset = read_f32(data, offset, "upgradeChance")
    use_exact_count, offset = read_i32(data, offset, "useExactCount")
    upgrade_count, offset = read_i32(data, offset, "upgradeCount")
    upgrade_count_percent, offset = read_f32(data, offset, "upgradeCountPercent")
    actual_upgrade_count, offset = read_f32(data, offset, "actualUpgradeCount")
    title_color, offset = read_color(data, offset, "titleColor")
    bg_color, offset = read_color(data, offset, "upgradableParamBGColor")
    highlight_color, offset = read_color(data, offset, "upgradableParamHighlightColor")
    return {
        "name": name,
        "rarity_id": rarity_id,
        "rarity": enum_label(rarity_id, rarity_labels),
        "localization_key": localization_key,
        "upgrade_chance_percent": round(upgrade_chance * 100, 4),
        "use_exact_count": bool(use_exact_count),
        "upgrade_count": upgrade_count,
        "upgrade_count_percent": round(upgrade_count_percent * 100, 4),
        "actual_upgrade_count": actual_upgrade_count,
        "object_name": header["object_name"],
        "source_asset": header["source_asset"],
        "title_color": title_color,
        "upgradable_param_bg_color": bg_color,
        "upgradable_param_highlight_color": highlight_color,
    }


def parse_achievement_conditions(header: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for item in scan_payload_strings(header["payload"], max_items=120):
        match = ACHIEVEMENT_RE.match(item["text"])
        if not match:
            continue
        rows.append(
            {
                "title": match.group("title"),
                "condition": match.group("condition"),
                "quest_id": int(match.group("quest_id")),
                "source_offset": item["offset"],
            }
        )
    rows.sort(key=lambda item: item["quest_id"])
    return rows


def parse_number_text(value: str) -> int | float:
    number = float(value)
    return int(number) if number.is_integer() else number


def parse_structured_strings(strings: list[str]) -> dict[str, Any]:
    value_ranges: list[dict[str, Any]] = []
    unlock_conditions: list[dict[str, Any]] = []
    for text in strings:
        unlock_match = UNLOCK_CONDITION_RE.match(text)
        if unlock_match:
            unlock_conditions.append(
                {
                    "condition": unlock_match.group("condition"),
                    "quest_id": int(unlock_match.group("quest_id")),
                }
            )
            continue
        range_match = VALUE_RANGE_RE.match(text)
        if not range_match:
            continue
        scaling = (range_match.group("scaling") or "").strip().lower()
        value_ranges.append(
            {
                "label": range_match.group("label").strip(),
                "start": parse_number_text(range_match.group("start")),
                "end": parse_number_text(range_match.group("end")),
                "scales_with_level": scaling == "x",
            }
        )
    result: dict[str, Any] = {}
    if value_ranges:
        result["value_ranges"] = value_ranges
    if unlock_conditions:
        result["unlock_conditions"] = unlock_conditions
    return result


def values_match(left: int | float, right: int | float) -> bool:
    return abs(float(left) - float(right)) <= max(0.001, abs(float(right)) * 0.001)


def compact_float(value: float) -> int | float:
    rounded = round(value, 4)
    return int(rounded) if float(rounded).is_integer() else rounded


def find_float_sequence(data: bytes, start: int | float, end: int | float) -> dict[str, Any] | None:
    if values_match(start, end):
        return None
    for offset in range(0, len(data) - 12, 4):
        try:
            count = struct.unpack_from("<i", data, offset)[0]
        except Exception:
            continue
        if count < 2 or count > 80 or offset + 4 + count * 4 > len(data):
            continue
        try:
            values = [struct.unpack_from("<f", data, offset + 4 + index * 4)[0] for index in range(count)]
        except Exception:
            continue
        if not values or not all(math.isfinite(value) and -100000 <= value <= 100000 for value in values):
            continue
        if values_match(values[0], start) and values_match(values[-1], end):
            return {"offset": offset, "values": [compact_float(value) for value in values]}
    return None


def attach_value_sequences(row: dict[str, Any], payload: bytes) -> None:
    ranges = row.get("value_ranges")
    if not isinstance(ranges, list):
        return
    for value_range in ranges:
        if not isinstance(value_range, dict):
            continue
        start = value_range.get("start")
        end = value_range.get("end")
        if not isinstance(start, (int, float)) or not isinstance(end, (int, float)):
            continue
        sequence = find_float_sequence(payload, start, end)
        if sequence:
            value_range["values"] = sequence["values"]
            value_range["values_source_offset"] = sequence["offset"]


def parse_character_progression(strings: list[str]) -> dict[str, Any]:
    bonuses: list[dict[str, Any]] = []
    skill_rows: list[dict[str, Any]] = []
    current_group: int | None = None
    for index, text in enumerate(strings):
        bonus_match = CHARACTER_BONUS_RE.match(text)
        if bonus_match:
            display_label = ""
            display_delta = ""
            if index + 1 < len(strings) and not strings[index + 1].startswith("#") and "|" not in strings[index + 1]:
                display_label = strings[index + 1]
            if index + 2 < len(strings) and re.match(r"^[+-]?\d+(?:\.\d+)?%$", strings[index + 2]):
                display_delta = strings[index + 2]
            bonuses.append(
                {
                    "slot": int(bonus_match.group("slot")),
                    "stat_key": bonus_match.group("stat_key"),
                    "value": parse_number_text(bonus_match.group("value")),
                    "display_label": display_label,
                    "display_delta": display_delta,
                }
            )
            continue

        if text.startswith("#") and "|" in text:
            group_match = re.match(r"^#(?P<group>\d+)\s+\|", text)
            current_group = int(group_match.group("group")) if group_match else None
            continue

        skill_match = CHARACTER_SKILL_ROW_RE.match(text)
        if skill_match:
            label = safe_short(skill_match.group("label"), 120)
            asset = safe_short(skill_match.group("asset"), 120)
            skill_rows.append(
                {
                    "group": current_group,
                    "unlock_step": int(skill_match.group("unlock_step")),
                    "label": label,
                    "asset": asset,
                    "empty_slot": label.lower() == "none" or asset.lower() == "empty",
                }
            )

    result: dict[str, Any] = {}
    if bonuses:
        result["character_bonuses"] = bonuses
    if skill_rows:
        result["skill_progression"] = skill_rows
    return result


def raw_asset_summary(header: dict[str, Any], max_strings: int = 12) -> dict[str, Any]:
    strings = [item["text"] for item in scan_payload_strings(header["payload"], max_items=max_strings)]
    row = {
        "object_path_id": header["object_path_id"],
        "class": header["script_name"],
        "name": header["object_name"],
        "source_asset": header["source_asset"],
        "payload_len": header["payload_len"],
        "embedded_strings": strings,
    }
    row.update(parse_structured_strings(strings))
    attach_value_sequences(row, header["payload"])
    return row


def parse_upgrade_asset_summary(
    header: dict[str, Any],
    feature_labels: dict[int, str],
    rarity_labels: dict[int, str],
    max_strings: int = 40,
) -> dict[str, Any]:
    row = raw_asset_summary(header, max_strings=max_strings)
    data = header["payload"]
    try:
        offset = 0
        feature_id, offset = read_i32(data, offset, "featureID")
        feature_name, offset = read_string(data, offset, "featureName")
        _feature_icon, offset = read_pptr(data, offset, "featureIcon")
        feature_description, offset = read_string(data, offset, "featureDescription")
        rarity_id, offset = read_i32(data, offset, "rarity")
        row.update(
            {
                "feature_id": feature_id,
                "feature": enum_label(feature_id, feature_labels),
                "feature_name": feature_name,
                "feature_description": feature_description,
                "rarity_id": rarity_id,
                "rarity": enum_label(rarity_id, rarity_labels),
            }
        )
    except Exception as exc:
        row["feature_header_parse_error"] = str(exc)
    return row


def parse_status_effect_upgrade_summary(
    header: dict[str, Any],
    feature_labels: dict[int, str],
    rarity_labels: dict[int, str],
    effect_labels: dict[int, str],
) -> dict[str, Any]:
    row = parse_upgrade_asset_summary(header, feature_labels, rarity_labels, max_strings=8)
    data = header["payload"]
    if len(data) >= 4:
        effect_type = struct.unpack_from("<i", data, len(data) - 4)[0]
        row["damageable_effect_type_id"] = effect_type
        row["damageable_effect_type"] = enum_label(effect_type, effect_labels)
    return row


def parse_spawn_list(text: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for match in SPAWN_TOKEN_RE.finditer(text.strip()):
        rows.append({"enemy": safe_short(match.group("enemy").strip(), 120), "count": int(match.group("count"))})
    return rows


def parse_enemy_wave_data(header: dict[str, Any]) -> dict[str, Any]:
    row = raw_asset_summary(header, max_strings=240)
    arenas: list[dict[str, Any]] = []
    current_arena: dict[str, Any] | None = None
    for text in row.get("embedded_strings", []):
        if not isinstance(text, str):
            continue
        arena_match = ARENA_WAVE_RE.match(text)
        if arena_match:
            current_arena = {
                "arena": int(arena_match.group("arena")),
                "size": arena_match.group("size"),
                "wave_count": int(arena_match.group("wave_count")),
                "total_spawns": parse_spawn_list(arena_match.group("spawns")),
                "waves": [],
            }
            arenas.append(current_arena)
            continue
        wave_match = WAVE_SPAWN_RE.match(text)
        if wave_match and current_arena is not None:
            wave_number = int(wave_match.group("wave"))
            if wave_number == 1 and current_arena.get("waves"):
                current_arena = {
                    "arena": int(current_arena.get("arena", len(arenas))) + 1,
                    "size": current_arena.get("size"),
                    "wave_count": None,
                    "total_spawns": [],
                    "waves": [],
                    "implicit_header": True,
                }
                arenas.append(current_arena)
            current_arena["waves"].append(
                {
                    "wave": wave_number,
                    "spawn_count": int(wave_match.group("spawn_count")),
                    "spawns": parse_spawn_list(wave_match.group("spawns")),
                }
            )
    if arenas:
        row["arenas"] = arenas
        row["arena_count"] = len(arenas)
        row["wave_count"] = sum(len(arena.get("waves", [])) for arena in arenas)
    return row


def parse_level_object_spawner_data(header: dict[str, Any]) -> dict[str, Any]:
    row = raw_asset_summary(header, max_strings=160)
    sections: list[dict[str, Any]] = []
    current_section: dict[str, Any] | None = None
    for text in row.get("embedded_strings", []):
        if not isinstance(text, str):
            continue
        section_match = LEVEL_OBJECT_SECTION_RE.match(text)
        if section_match:
            current_section = {
                "index": int(section_match.group("index")),
                "enabled_by_default": bool(section_match.group("enabled")),
                "name": section_match.group("name").strip(),
                "radius_min": int(section_match.group("min")),
                "radius_max": int(section_match.group("max")),
                "entries": [],
            }
            sections.append(current_section)
            continue
        entry_match = LEVEL_OBJECT_ENTRY_RE.match(text)
        if entry_match and current_section is not None:
            current_section["entries"].append(
                {
                    "category": entry_match.group("category"),
                    "object": entry_match.group("object"),
                    "count": int(entry_match.group("count")),
                }
            )
    if sections:
        row["sections"] = sections
        row["section_count"] = len(sections)
        row["object_rule_count"] = sum(len(section.get("entries", [])) for section in sections)
    return row


def parse_level_object_preset_data(header: dict[str, Any]) -> dict[str, Any]:
    row = raw_asset_summary(header, max_strings=160)
    collectible_presets: list[dict[str, Any]] = []
    for text in row.get("embedded_strings", []):
        if not isinstance(text, str):
            continue
        match = COLLECTIBLE_PRESET_RE.match(text)
        if match:
            collectible_presets.append(
                {
                    "name": match.group("name"),
                    "resource": match.group("resource"),
                    "count": int(match.group("count")),
                }
            )
    if collectible_presets:
        row["collectible_presets"] = collectible_presets
    return row


def parse_boss_attack_strings(strings: list[str]) -> dict[str, Any]:
    attack_ids: list[dict[str, Any]] = []
    id_to_name: dict[int, str] = {}
    for text in strings:
        match = BOSS_ATTACK_ID_RE.match(text)
        if not match:
            continue
        attack_id = int(match.group("id"))
        name = safe_short(match.group("name"), 120)
        if attack_id not in id_to_name:
            id_to_name[attack_id] = name
            attack_ids.append({"id": attack_id, "name": name})

    phase_orders: list[dict[str, Any]] = []
    for text in strings:
        if text.startswith("[ID:"):
            continue
        match = BOSS_PHASE_ORDER_RE.match(text)
        if not match:
            continue
        ids = [int(part.strip()) for part in match.group("ids").split("+") if part.strip().isdigit()]
        phase_orders.append(
            {
                "label": safe_short(match.group("label"), 160),
                "attack_ids": ids,
                "attacks": [{"id": attack_id, "name": id_to_name.get(attack_id)} for attack_id in ids],
                "repeat_count": int(match.group("repeat")),
            }
        )

    result: dict[str, Any] = {}
    if attack_ids:
        result["boss_attack_ids"] = sorted(attack_ids, key=lambda item: int(item.get("id", 0)))
    if phase_orders:
        result["boss_phase_orders"] = phase_orders
    return result


def resolve_character_skill_refs(characters: list[dict[str, Any]], upgrade_assets: list[dict[str, Any]]) -> None:
    upgrades_by_path = {
        int(item["object_path_id"]): item
        for item in upgrade_assets
        if isinstance(item.get("object_path_id"), int)
    }
    for character in characters:
        skill_rows = character.get("skill_progression")
        if not isinstance(skill_rows, list):
            continue
        for skill in skill_rows:
            if not isinstance(skill, dict):
                continue
            feature_path_id = skill.get("feature_path_id")
            if not isinstance(feature_path_id, int):
                continue
            upgrade = upgrades_by_path.get(feature_path_id)
            if not upgrade:
                continue
            skill["resolved_upgrade_class"] = upgrade.get("class")
            skill["resolved_upgrade_name"] = upgrade.get("name")
            if isinstance(upgrade.get("feature_id"), int):
                skill["feature_id"] = upgrade.get("feature_id")
            if upgrade.get("feature"):
                skill["feature"] = upgrade.get("feature")
            if upgrade.get("rarity"):
                skill["rarity"] = upgrade.get("rarity")


def annotate_ref(row: dict[str, Any], key: str, lookup: dict[int, dict[str, Any]], prefix: str) -> None:
    ref = row.get(key)
    path_id = pptr_path_id(ref) if isinstance(ref, dict) else None
    if path_id is None:
        return
    target = lookup.get(path_id)
    if not target:
        return
    row[f"{prefix}_path_id"] = path_id
    row[f"{prefix}_name"] = target.get("name")
    if target.get("class"):
        row[f"{prefix}_class"] = target.get("class")


def resolve_location_refs(
    locations: list[dict[str, Any]],
    upgrade_assets: list[dict[str, Any]],
    enemy_wave_data: list[dict[str, Any]],
    level_object_spawner_data: list[dict[str, Any]],
    terrain_height_data: list[dict[str, Any]],
    terrain_texture_data: list[dict[str, Any]],
) -> None:
    upgrade_lookup = {int(item["object_path_id"]): item for item in upgrade_assets if isinstance(item.get("object_path_id"), int)}
    wave_lookup = {int(item["object_path_id"]): item for item in enemy_wave_data if isinstance(item.get("object_path_id"), int)}
    spawner_lookup = {int(item["object_path_id"]): item for item in level_object_spawner_data if isinstance(item.get("object_path_id"), int)}
    height_lookup = {int(item["object_path_id"]): item for item in terrain_height_data if isinstance(item.get("object_path_id"), int)}
    texture_lookup = {int(item["object_path_id"]): item for item in terrain_texture_data if isinstance(item.get("object_path_id"), int)}
    for location in locations:
        level_generation = location.get("level_generation")
        if isinstance(level_generation, dict):
            annotate_ref(level_generation, "height_data_ref", height_lookup, "height_data")
            annotate_ref(level_generation, "texture_data_ref", texture_lookup, "texture_data")
            annotate_ref(level_generation, "main_level_object_spawner_ref", spawner_lookup, "main_level_object_spawner")
            annotate_ref(level_generation, "secondary_level_object_spawner_ref", spawner_lookup, "secondary_level_object_spawner")
            annotate_ref(level_generation, "enemy_spawner_ref", wave_lookup, "enemy_spawner")
        location_reward = location.get("location_reward")
        if isinstance(location_reward, dict):
            annotate_ref(location_reward, "completion_reward_ref", upgrade_lookup, "completion_reward")


def extract_stripped_mono_behaviours(game_root: pathlib.Path, candidate_files: list[pathlib.Path], managed_enums: list[dict[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {
        "summary": {
            "combined_files": len(candidate_files),
            "objects": 0,
            "mono_behaviours": 0,
            "typetree_failures": 0,
            "unknown_script_failures": 0,
        },
        "script_counts": [],
        "core_counts": {},
        "characters": [],
        "locations": [],
        "artifacts": [],
        "quest_templates": [],
        "achievement_conditions": [],
        "game_modes": [],
        "difficulty_levels": [],
        "stat_modifiers": [],
        "rarity_tables": [],
        "upgrade_assets": [],
        "status_effect_upgrades": [],
        "enemy_component_payloads": [],
        "enemy_wave_data": [],
        "enemy_arena_spawner_data": [],
        "level_object_spawner_data": [],
        "level_object_preset_data": [],
        "terrain_height_data": [],
        "terrain_texture_data": [],
        "raw_parse_warnings": [
            "These rows are parsed from stripped Unity MonoBehaviour payloads. Scalar fields, embedded strings, and supported nested progression arrays are decoded; unresolved Unity object references are kept as path IDs or omitted from Markdown.",
            "Pointer-only or intentionally empty upgrade assets can have no numeric ranges even when their unlock/header metadata is decoded.",
        ],
        "parse_errors": [],
    }
    if not candidate_files:
        return result

    import UnityPy  # type: ignore

    env = UnityPy.load(*[str(path) for path in candidate_files])
    result["summary"]["objects"] = len(env.objects)
    scripts_by_id = build_script_map(env)
    game_objects_by_id = build_game_object_map(env)
    rarity_labels = enum_value_labels(managed_enums, "CardRarity")
    stat_labels = enum_value_labels(managed_enums, "ID", "StatsData")
    feature_labels = enum_value_labels(managed_enums, "FeatureID", "UpgradeFeature")
    effect_labels = enum_value_labels(managed_enums, "Type", "DamageableEffectData")
    visual_labels = enum_value_labels(managed_enums, "VisualsID", "CharacterVisualsController")
    game_mode_labels = enum_value_labels(managed_enums, "GameMode", "GameManager")
    difficulty_labels = enum_value_labels(managed_enums, "DifficultyLevel", "GameManager")

    script_counts: collections.Counter[str] = collections.Counter()
    parse_errors: list[str] = []
    upgrade_assets: list[dict[str, Any]] = []
    status_effect_upgrades: list[dict[str, Any]] = []
    enemy_component_payloads: list[dict[str, Any]] = []
    enemy_wave_data: list[dict[str, Any]] = []
    terrain_height_data: list[dict[str, Any]] = []
    terrain_texture_data: list[dict[str, Any]] = []

    for obj in env.objects:
        if str(obj.type.name) != "MonoBehaviour":
            continue
        result["summary"]["mono_behaviours"] += 1
        try:
            obj.read_typetree()
            continue
        except Exception:
            result["summary"]["typetree_failures"] += 1

        try:
            header = parse_mono_header(obj, scripts_by_id, game_objects_by_id)
        except Exception as exc:
            if len(parse_errors) < MAX_RAW_PARSE_ERRORS:
                parse_errors.append(f"{asset_file_name(obj.assets_file)}:{getattr(obj, 'path_id', '?')}: header parse failed: {exc}")
            continue

        script_name = header["script_name"] or "__unknown__"
        script_counts[script_name] += 1
        if not header["script_name"]:
            result["summary"]["unknown_script_failures"] += 1
            continue

        try:
            if script_name == "CharacterDataSO":
                result["characters"].append(parse_character_data(header, stat_labels, visual_labels))
            elif script_name == "LocationDataSO":
                result["locations"].append(parse_location_data(header))
            elif script_name == "ArtifactDataSO":
                result["artifacts"].append(parse_artifact_data(header, rarity_labels, stat_labels))
            elif script_name == "QuestDataSO":
                result["quest_templates"] = parse_quest_data(header)
            elif script_name == "AchievementDataSO":
                result["achievement_conditions"] = parse_achievement_conditions(header)
            elif script_name == "GameModeDataSO":
                result["game_modes"].append(parse_mode_or_difficulty(header, "gameMode", game_mode_labels))
            elif script_name == "DifficultyLevelDataSO":
                result["difficulty_levels"].append(parse_mode_or_difficulty(header, "difficultyLevel", difficulty_labels))
            elif script_name == "StatsModifiersDataSO":
                result["stat_modifiers"].append(parse_stats_modifiers(header))
            elif script_name == "CardRarityDataSO":
                result["rarity_tables"].append(parse_card_rarity(header, rarity_labels))
            elif script_name == "StatusEffectUpgrade":
                status_effect_upgrades.append(parse_status_effect_upgrade_summary(header, feature_labels, rarity_labels, effect_labels))
            elif script_name == "EnemySpawnerWavesData":
                enemy_wave_data.append(parse_enemy_wave_data(header))
            elif script_name == "EnemySpawnerArenaData":
                result["enemy_arena_spawner_data"].append(raw_asset_summary(header, max_strings=160))
            elif script_name == "LevelObjectSpawnerData":
                result["level_object_spawner_data"].append(parse_level_object_spawner_data(header))
            elif script_name == "LevelObjectPresetData":
                result["level_object_preset_data"].append(parse_level_object_preset_data(header))
            elif script_name == "TerrainHeightData":
                terrain_height_data.append(raw_asset_summary(header, max_strings=80))
            elif script_name == "TerrainTextureData":
                terrain_texture_data.append(raw_asset_summary(header, max_strings=80))
            elif script_name in ENEMY_COMPONENT_SCRIPTS:
                row = raw_asset_summary(header, max_strings=40)
                if script_name == "EnemyAttackModuleBoss":
                    row.update(parse_boss_attack_strings([str(item) for item in row.get("embedded_strings", [])]))
                enemy_component_payloads.append(row)
            elif script_name.endswith("Upgrade") and not re.search(r"(UI|Manager|ChangedValue|Resizer)", script_name):
                upgrade_assets.append(parse_upgrade_asset_summary(header, feature_labels, rarity_labels, max_strings=40))
        except Exception as exc:
            if len(parse_errors) < MAX_RAW_PARSE_ERRORS:
                parse_errors.append(f"{script_name}:{header['object_name']}:{header['source_asset']} parse failed: {exc}")

    result["script_counts"] = [
        {"script": script, "count": count}
        for script, count in sorted(script_counts.items(), key=lambda item: (-item[1], item[0].lower()))[:MAX_STRIPPED_SCRIPT_ROWS]
    ]
    result["core_counts"] = {script: int(script_counts.get(script, 0)) for script in CORE_STRIPPED_SCRIPTS if script_counts.get(script, 0) > 0}
    result["characters"].sort(key=lambda item: (bool(item.get("debug_or_test_asset")), int(item.get("id", 0)), str(item.get("name", ""))))
    result["locations"].sort(key=lambda item: int(item.get("id", 0)))
    result["artifacts"].sort(key=lambda item: int(item.get("id", 0)))
    result["game_modes"].sort(key=lambda item: int(item.get("id", 0)))
    result["difficulty_levels"].sort(key=lambda item: int(item.get("id", 0)))
    result["stat_modifiers"].sort(key=lambda item: str(item.get("name", "")))
    result["rarity_tables"].sort(key=lambda item: int(item.get("rarity_id", 0)))
    resolve_character_skill_refs(result["characters"], upgrade_assets)
    enemy_wave_data = sorted(enemy_wave_data, key=lambda item: str(item.get("name", "")))[:60]
    terrain_height_data = sorted(terrain_height_data, key=lambda item: str(item.get("name", "")))[:80]
    terrain_texture_data = sorted(terrain_texture_data, key=lambda item: str(item.get("name", "")))[:80]
    resolve_location_refs(
        result["locations"],
        upgrade_assets,
        enemy_wave_data,
        result["level_object_spawner_data"],
        terrain_height_data,
        terrain_texture_data,
    )
    result["upgrade_assets"] = sorted(upgrade_assets, key=lambda item: (str(item.get("class", "")), str(item.get("name", ""))))[:320]
    result["status_effect_upgrades"] = sorted(status_effect_upgrades, key=lambda item: str(item.get("name", "")))[:120]
    result["enemy_component_payloads"] = sorted(enemy_component_payloads, key=lambda item: (str(item.get("name", "")), str(item.get("class", ""))))[:360]
    result["enemy_wave_data"] = enemy_wave_data
    result["enemy_arena_spawner_data"].sort(key=lambda item: str(item.get("name", "")))
    result["level_object_spawner_data"].sort(key=lambda item: str(item.get("name", "")))
    result["level_object_preset_data"].sort(key=lambda item: str(item.get("name", "")))
    result["terrain_height_data"] = terrain_height_data
    result["terrain_texture_data"] = terrain_texture_data
    result["parse_errors"] = parse_errors
    return result


def extract_unity_serialized(game_root: pathlib.Path, managed_enums: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    result: dict[str, Any] = {
        "unitypy_available": False,
        "object_counts": [],
        "collectible_lists": [],
        "gameplay_component_summaries": {
            "component_counts": {},
            "chest_controllers": [],
            "collectible_heaps": [],
            "collectible_challenges": [],
            "collectible_pits": [],
            "quick_collectible_spawners": [],
            "tree_spawn_point_roots": [],
            "heap_spawners": [],
            "spawn_slot_configs": [],
            "status_effect_bar_types": [],
        },
        "stripped_mono_behaviours": {},
        "errors": [],
    }
    try:
        import UnityPy  # type: ignore
    except Exception as exc:  # pragma: no cover - depends on local extractor env
        result["errors"].append(f"UnityPy unavailable: {exc}")
        return result

    result["unitypy_available"] = True
    managed_enums = managed_enums or []
    collectible_types = enum_name_map(managed_enums, "Collectible")
    chest_types = enum_name_map(managed_enums, "ChestController")
    candidate_files = unity_candidate_files(game_root)
    component_counts: collections.Counter[str] = collections.Counter()
    chest_bucket: dict[str, dict[str, Any]] = {}
    heap_bucket: dict[str, dict[str, Any]] = {}
    challenge_bucket: dict[str, dict[str, Any]] = {}
    pit_bucket: dict[str, dict[str, Any]] = {}
    quick_bucket: dict[str, dict[str, Any]] = {}
    tree_spawn_bucket: dict[str, dict[str, Any]] = {}
    heap_spawner_bucket: dict[str, dict[str, Any]] = {}
    slots_bucket: dict[str, dict[str, Any]] = {}
    status_bar_types: dict[str, dict[str, Any]] = {}

    for asset_path in candidate_files:
        if not asset_path.exists():
            continue
        rel_path = asset_path.relative_to(game_root).as_posix()
        try:
            env = UnityPy.load(str(asset_path))
        except Exception as exc:
            result["errors"].append(f"{rel_path}: {exc}")
            continue

        counts = collections.Counter(str(obj.type.name) for obj in env.objects)
        object_summary = {
            "path": rel_path,
            "objects": len(env.objects),
            "mono_behaviours": counts.get("MonoBehaviour", 0),
            "mono_behaviour_typetree_failures": 0,
            "top_types": [{"type": key, "count": value} for key, value in counts.most_common(12)],
        }
        result["object_counts"].append(object_summary)

        scripts: dict[int, str] = {}
        game_objects: dict[int, str] = {}
        for obj in env.objects:
            try:
                if str(obj.type.name) == "MonoScript":
                    data = obj.read()
                    scripts[obj.path_id] = getattr(data, "m_ClassName", "") or getattr(data, "m_Name", "") or ""
                elif str(obj.type.name) == "GameObject":
                    data = obj.read()
                    game_objects[obj.path_id] = getattr(data, "m_Name", "") or ""
            except Exception:
                continue

        for obj in env.objects:
            if str(obj.type.name) != "MonoBehaviour":
                continue
            try:
                tree = obj.read_typetree()
            except Exception:
                object_summary["mono_behaviour_typetree_failures"] += 1
                continue
            ref = tree.get("m_Script") or {}
            script_id = ref.get("m_PathID") if isinstance(ref, dict) else None
            script_name = scripts.get(script_id, "")
            game_object_ref = tree.get("m_GameObject") or {}
            game_object_id = game_object_ref.get("m_PathID") if isinstance(game_object_ref, dict) else None
            game_object_name = safe_short(game_objects.get(game_object_id, "") or tree.get("m_Name") or script_name)
            if script_name:
                component_counts[script_name] += 1

            if script_name != "CollectibleListSO":
                if script_name == "ChestController":
                    chest_type = tree.get("chestType")
                    add_aggregate(
                        chest_bucket,
                        {
                            "source_path": rel_path,
                            "key_count_to_open": tree.get("keyCountToOpen"),
                            "chest_type_id": chest_type,
                            "chest_type": enum_label(chest_type, chest_types),
                        },
                        game_object_name,
                    )
                elif script_name == "CollectibleHeap":
                    heap_type = tree.get("type")
                    add_aggregate(
                        heap_bucket,
                        {
                            "source_path": rel_path,
                            "type_id": heap_type,
                            "type": enum_label(heap_type, collectible_types),
                            "default_count": tree.get("count"),
                            "min_active_collectibles": tree.get("minActiveCollectibleCount"),
                            "max_active_collectibles": tree.get("maxActiveCollectibleCount"),
                            "max_radius": compact_number(tree.get("maxRadius")),
                        },
                        game_object_name,
                    )
                elif script_name == "CollectibleChallenge":
                    add_aggregate(
                        challenge_bucket,
                        {
                            "source_path": rel_path,
                            "target_activated_count": tree.get("targetActivatedCount"),
                            "update_type": tree.get("updateType"),
                            "on_complete_delay": compact_number(tree.get("onCompleteDelay")),
                        },
                        game_object_name,
                    )
                elif script_name == "CollectiblePit":
                    pit_type = tree.get("type")
                    add_aggregate(
                        pit_bucket,
                        {
                            "source_path": rel_path,
                            "type_id": pit_type,
                            "type_note": "raw CollectiblePit type id; use heap rows and prefab examples for collectible labels",
                            "debug_draw_enabled": tree.get("isDebugDrawEnabled"),
                        },
                        game_object_name,
                    )
                elif script_name == "QuickCollectibleSpawner":
                    quick_type = tree.get("type")
                    spawn_cooldown = tree.get("spawnCooldown") if isinstance(tree.get("spawnCooldown"), dict) else {}
                    add_aggregate(
                        quick_bucket,
                        {
                            "source_path": rel_path,
                            "type_id": quick_type,
                            "type": enum_label(quick_type, collectible_types),
                            "count": tree.get("count"),
                            "show_duration": compact_number(tree.get("showDuration")),
                            "spawn_cooldown": compact_number(spawn_cooldown.get("timeValue")),
                            "max_collectible_count": tree.get("maxCollectibleCount"),
                            "distance_range": compact_range(tree.get("distanceRange")),
                            "distance_from_player": compact_range(tree.get("distanceFromPlayer")),
                        },
                        game_object_name,
                    )
                elif script_name == "TreeSpawnPointRoot":
                    add_aggregate(
                        tree_spawn_bucket,
                        {
                            "source_path": rel_path,
                            "min_percent": compact_number(tree.get("minPercent")),
                            "max_percent": compact_number(tree.get("maxPercent")),
                            "min_count": tree.get("minCount"),
                            "max_count": tree.get("maxCount"),
                        },
                        game_object_name,
                    )
                elif script_name == "HeapSpawner":
                    add_aggregate(
                        heap_spawner_bucket,
                        {
                            "source_path": rel_path,
                            "min_radius": compact_number(tree.get("minRadius")),
                            "max_radius": compact_number(tree.get("maxRadius")),
                            "radius_step": compact_number(tree.get("radiusStep")),
                            "count_range": compact_range(tree.get("countRange")),
                            "min_y": compact_number(tree.get("minY")),
                            "max_y": compact_number(tree.get("maxY")),
                            "enabled_count": tree.get("enabledCount"),
                            "inside_count": tree.get("insideCount"),
                            "outside_count": tree.get("outsideCount"),
                            "slot_count": len(tree.get("slots") or []),
                            "layer_count": len(tree.get("layerCounts") or []),
                        },
                        game_object_name,
                    )
                elif script_name in {"SpawnSlotsManager", "SimpleSpawnSlotManager"}:
                    slots = [slot for slot in (tree.get("slots") or []) if isinstance(slot, dict)]
                    slot_type_counts = collections.Counter(str(slot.get("slotType")) for slot in slots if "slotType" in slot)
                    add_aggregate(
                        slots_bucket,
                        {
                            "source_path": rel_path,
                            "component": script_name,
                            "slot_count": len(slots),
                            "chest_priority": compact_number(tree.get("chestPriority")),
                            "slot_type_counts": dict(sorted(slot_type_counts.items())),
                        },
                        game_object_name,
                    )
                elif script_name == "StatusEffectBarsController":
                    type_ids = [item.get("type") for item in (tree.get("barDataList") or []) if isinstance(item, dict)]
                    add_aggregate(
                        status_bar_types,
                        {
                            "source_path": rel_path,
                            "type_ids": type_ids,
                        },
                        game_object_name,
                    )
                continue

            items = []
            for item in tree.get("dataList", []) or []:
                if not isinstance(item, dict):
                    continue
                collectible_type = item.get("type")
                items.append(
                    {
                        "name": safe_short(item.get("name")),
                        "type_id": collectible_type,
                        "type": enum_label(collectible_type, collectible_types),
                        "count": item.get("count"),
                    }
                )
            result["collectible_lists"].append(
                {
                    "name": safe_short(tree.get("m_Name")),
                    "source_path": rel_path,
                    "items": items[:24],
                    "item_count": len(items),
                }
            )

    selected_component_names = [
        "ChestController",
        "CollectibleHeap",
        "CollectibleChallenge",
        "CollectiblePit",
        "QuickCollectibleSpawner",
        "TreeSpawnPointRoot",
        "HeapSpawner",
        "SpawnSlotsManager",
        "SimpleSpawnSlotManager",
        "StatusEffectBarsController",
        "CollectibleListSO",
    ]
    result["gameplay_component_summaries"] = {
        "component_counts": {name: component_counts.get(name, 0) for name in selected_component_names if component_counts.get(name, 0) > 0},
        "chest_controllers": sorted_aggregates(chest_bucket),
        "collectible_heaps": sorted_aggregates(heap_bucket),
        "collectible_challenges": sorted_aggregates(challenge_bucket),
        "collectible_pits": sorted_aggregates(pit_bucket),
        "quick_collectible_spawners": sorted_aggregates(quick_bucket),
        "tree_spawn_point_roots": sorted_aggregates(tree_spawn_bucket),
        "heap_spawners": sorted_aggregates(heap_spawner_bucket),
        "spawn_slot_configs": sorted_aggregates(slots_bucket),
        "status_effect_bar_types": sorted_aggregates(status_bar_types),
    }
    try:
        result["stripped_mono_behaviours"] = extract_stripped_mono_behaviours(game_root, candidate_files, managed_enums)
    except Exception as exc:
        result["errors"].append(f"stripped MonoBehaviour extraction failed: {exc}")

    return result


def main() -> int:
    if len(sys.argv) != 2:
        print(json.dumps({"error": "usage: extract-unity-metadata.py <game-files-dir>"}))
        return 2
    game_root = pathlib.Path(sys.argv[1]).resolve()
    managed_code = extract_managed(game_root)
    serialized_assets = extract_unity_serialized(game_root, managed_code.get("enums") if isinstance(managed_code.get("enums"), list) else [])
    print(json.dumps({"managed_code": managed_code, "serialized_assets": serialized_assets}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
