#!/usr/bin/env python3
"""Offline schema-contract and generated-index checks; use oo-index for semantics.

No third-party modules or downloads. This checks the repository's explicit schema
contracts; it is not a replacement implementation of JSON Schema 2020-12.
"""
import argparse
import json
from pathlib import Path
from urllib.parse import urljoin

root = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument("--output", type=Path, default=root / "public")
args = parser.parse_args()


def load(path):
    return json.loads(path.read_text())


def check_schema_urls(index, package, base):
    assert index["$id"] == base + "index.schema.json"
    assert package["$id"] == base + "package.schema.json"
    ref = index["properties"]["packages"]["items"]["$ref"]
    assert ref == "package.schema.json", "schema references must stay relative"
    assert urljoin(index["$id"], ref) == package["$id"]


package_schema = load(root / "schema/package.schema.json")
index_schema = load(root / "schema/index.schema.json")
check_schema_urls(index_schema, package_schema, "https://oheco.org/schema/")
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
    # Historical IDs identify frozen protocols, not the current website URL.
    check_schema_urls(index, package, f"https://oheco.github.io/oheco-packages/schema/v{schema}/")
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
        assert (args.output / schema_dir / filename).read_bytes() == (root / schema_dir / filename).read_bytes()
# oo-index copies all regular site files recursively; CNAME must reach the output
# without a special-case copier or a manual edit to public/.
for source in sorted((root / "site").rglob("*")):
    if source.is_file():
        relative = source.relative_to(root / "site")
        assert (args.output / relative).read_bytes() == source.read_bytes(), f"site file not copied: {relative}"
assert (args.output / "CNAME").read_bytes() == b"oheco.org\n"
html = (args.output / "index.html").read_text()
assert '<link rel="canonical" href="https://oheco.org/">' in html
assert '<code id="install-command">curl -fsSL https://oheco.org/install.sh | zsh</code>' in html
assert "https://oheco.github.io/oheco-packages/" not in html
for relative in ("./style.css", "./app.js", "./index/v5/index.json"):
    assert f'"{relative}' in html
    assert (args.output / relative).is_file(), f"relative site resource missing: {relative}"
assert (args.output / "install.sh").is_file()
print(f"PASS v5 schema contracts and generated v1-v5 indexes ({len(packages)} packages); bootstrap unchanged")
print("PASS current schema IDs, frozen historical IDs and relative refs, generated install URL/canonical/CNAME and relative assets")
print("Constraint/reference semantics are checked by the preceding Go oo-index build; no remote artifacts were fetched.")
