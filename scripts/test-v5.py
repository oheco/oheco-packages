#!/usr/bin/env python3
"""Offline schema-contract and generated-index checks; use oo-index for semantics.

No third-party modules or downloads. This checks the repository's explicit schema
contracts; it is not a replacement implementation of JSON Schema 2020-12.
"""
import argparse
import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument("--output", type=Path, default=root / "public")
args = parser.parse_args()


def load(path):
    return json.loads(path.read_text())


package_schema = load(root / "schema/package.schema.json")
index_schema = load(root / "schema/index.schema.json")
assert package_schema["properties"]["schema_version"]["enum"] == [1, 2, 3, 4, 5]
assert index_schema["properties"]["schema_version"]["const"] == 5
version_schema = package_schema["properties"]["versions"]["items"]
assert version_schema["properties"]["dependencies"]["type"] == "array"
assert version_schema["properties"]["dependencies"]["items"]["$ref"] == "#/$defs/dependency"
dependency_schema = package_schema["$defs"]["dependency"]
assert dependency_schema["required"] == ["name", "constraint"]
assert dependency_schema["additionalProperties"] is False
assert set(dependency_schema["properties"]) == {"name", "constraint", "version_basis", "platforms"}
assert dependency_schema["properties"]["version_basis"]["enum"] == ["package", "upstream"]
assert dependency_schema["properties"]["version_basis"]["default"] == "package"
assert dependency_schema["properties"]["platforms"]["uniqueItems"] is True
assert dependency_schema["properties"]["constraint"]["pattern"] == r"\S"

# Explicit schema gates: old protocols and language versions cannot carry the
# field; a present native declaration needs an artifact; bootstrap remains v1.
gates = package_schema["allOf"]
assert {
    "if": {"properties": {"schema_version": {"enum": [1, 2, 3, 4]}}},
    "then": {"properties": {"versions": {"items": {"not": {"required": ["dependencies"]}}}}},
} in gates
assert {
    "if": {"properties": {"package_manager": {"enum": ["pip", "npm"]}}, "required": ["package_manager"]},
    "then": {"properties": {"versions": {"items": {"not": {"required": ["dependencies"]}}}}},
} in gates
assert {
    "properties": {"versions": {"items": {"if": {"required": ["dependencies"]}, "then": {"required": ["artifacts"]}}}},
} in gates
assert {
    "if": {"properties": {"name": {"const": "oheco"}}},
    "then": {"properties": {"schema_version": {"const": 1}}},
} in gates

for schema in range(1, 5):
    package = load(root / f"schema/v{schema}/package.schema.json")
    index = load(root / f"schema/v{schema}/index.schema.json")
    assert index["properties"]["schema_version"]["const"] == schema
    assert index["properties"]["packages"]["items"]["$ref"] == "package.schema.json"
    assert package["$id"].endswith(f"/schema/v{schema}/package.schema.json")
    assert "dependencies" not in package["properties"]["versions"]["items"]["properties"]
frozen = load(root / "schema/v4/package.schema.json")
assert frozen["properties"]["schema_version"]["enum"] == [1, 2, 3, 4]
for key, value in frozen["$defs"].items():
    assert package_schema["$defs"][key] == value, f"historical {key} shape changed"

packages = [load(path) for path in sorted((root / "packages").glob("*.json"))]
by_name = {package["name"]: package for package in packages}
assert by_name["oheco"]["schema_version"] == 1
lfs = by_name["git-lfs"]
assert lfs["schema_version"] == 5
assert lfs["versions"][0]["dependencies"] == [{"name": "git", "constraint": "*"}]
assert by_name["git"].get("package_manager", "oheco") == "oheco"
for package in packages:
    for version in package["versions"]:
        if "dependencies" in version:
            assert package["schema_version"] == 5 and package.get("package_manager", "oheco") == "oheco"
            assert isinstance(version["dependencies"], list) and version.get("artifacts")

for schema in range(1, 6):
    generated = load(args.output / f"index/v{schema}/index.json")
    assert generated["schema_version"] == schema
    expected = {p["name"] for p in packages if p["schema_version"] <= schema}
    actual = {p["name"] for p in generated["packages"]}
    assert actual == expected, f"v{schema} must filter whole packages by schema"
    assert next(p for p in generated["packages"] if p["name"] == "oheco") == by_name["oheco"]
    assert ("git-lfs" in actual) == (schema == 5)
    if schema < 5:
        assert all("dependencies" not in v for p in generated["packages"] for v in p["versions"])
    schema_dir = "schema" if schema == 5 else f"schema/v{schema}"
    for filename in ("package.schema.json", "index.schema.json"):
        assert load(args.output / schema_dir / filename) == load(root / schema_dir / filename)
assert (args.output / "app.js").read_bytes() == (root / "site/app.js").read_bytes()
assert (args.output / "index.html").read_bytes() == (root / "site/index.html").read_bytes()
print(f"PASS v5 schema contracts and generated v1-v5 indexes ({len(packages)} packages); bootstrap unchanged")
print("Constraint/reference semantics are checked by the preceding Go oo-index build; no remote artifacts were fetched.")
