import json
import os
import re
import stat
import sys
import tempfile
from pathlib import Path
from typing import List, Optional, Tuple


APP_NAME = "caretellia"
PROJECT_ROOT = Path(__file__).resolve().parents[1]
SEMVER = re.compile(
    r"^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)"
    r"(?:-(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)"
    r"(?:\.(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*))*)?"
    r"(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$"
)


def read_text(path: Path) -> str:
    with path.open("r", encoding="utf-8", newline="") as file:
        return file.read()


def replace_json_version(text: str, version: str, indent: int) -> str:
    pattern = re.compile(
        r"(?m)^("
        + " " * indent
        + r'"version":\s*)"[^"]+"(,?)(\r?)$'
    )
    updated, count = pattern.subn(
        lambda match: '{}"{}"{}{}'.format(
            match.group(1), version, match.group(2), match.group(3)
        ),
        text,
    )
    if count != 1:
        raise ValueError(
            "Expected exactly one version field indented with {} spaces; found {}."
            .format(indent, count)
        )
    return updated


def replace_package_lock_versions(text: str, version: str) -> str:
    updated = replace_json_version(text, version, 2)
    root_package = re.search(
        r'(?ms)^    "": \{\r?\n.*?(?=^    "[^"]+": \{|^  \})',
        updated,
    )
    if root_package is None:
        raise ValueError("Could not find the root package in package-lock.json.")

    root_text = replace_json_version(root_package.group(0), version, 6)
    return updated[: root_package.start()] + root_text + updated[root_package.end() :]


def replace_cargo_manifest_version(text: str, version: str) -> str:
    package_sections = list(
        re.finditer(
            r"(?ms)^\[package\]\r?\n.*?(?=^\[|\Z)",
            text,
        )
    )
    if len(package_sections) != 1:
        raise ValueError("Expected exactly one [package] section in Cargo.toml.")

    section = package_sections[0].group(0)
    name = re.search(r'(?m)^name\s*=\s*"([^"]+)"\r?$', section)
    if name is None or name.group(1) != APP_NAME:
        raise ValueError("Cargo.toml package name is not {}.".format(APP_NAME))

    updated, count = re.subn(
        r'(?m)^(version\s*=\s*)"[^"]+"(\r?)$',
        lambda match: '{}"{}"{}'.format(
            match.group(1), version, match.group(2)
        ),
        section,
    )
    if count != 1:
        raise ValueError("Expected exactly one package version in Cargo.toml.")
    return text[: package_sections[0].start()] + updated + text[package_sections[0].end() :]


def replace_cargo_lock_version(text: str, version: str) -> str:
    package_starts = [
        match.start() for match in re.finditer(r"(?m)^\[\[package\]\]\r?$", text)
    ]
    matching_sections: List[Tuple[int, int]] = []

    for index, start in enumerate(package_starts):
        end = package_starts[index + 1] if index + 1 < len(package_starts) else len(text)
        section = text[start:end]
        name = re.search(r'(?m)^name\s*=\s*"([^"]+)"\r?$', section)
        if name is not None and name.group(1) == APP_NAME:
            matching_sections.append((start, end))

    if len(matching_sections) != 1:
        raise ValueError(
            "Expected exactly one {} package in Cargo.lock; found {}."
            .format(APP_NAME, len(matching_sections))
        )

    start, end = matching_sections[0]
    section = text[start:end]
    updated, count = re.subn(
        r'(?m)^(version\s*=\s*)"[^"]+"(\r?)$',
        lambda match: '{}"{}"{}'.format(
            match.group(1), version, match.group(2)
        ),
        section,
    )
    if count != 1:
        raise ValueError("Expected exactly one {} version in Cargo.lock.".format(APP_NAME))
    return text[:start] + updated + text[end:]


def write_atomically(path: Path, text: str) -> None:
    temporary_path: Optional[Path] = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            newline="",
            dir=str(path.parent),
            delete=False,
        ) as temporary_file:
            temporary_file.write(text)
            temporary_path = Path(temporary_file.name)
        os.chmod(temporary_path, stat.S_IMODE(path.stat().st_mode))
        os.replace(str(temporary_path), str(path))
    finally:
        if temporary_path is not None and temporary_path.exists():
            temporary_path.unlink()


def update_project_version(version: str) -> None:
    if SEMVER.fullmatch(version) is None:
        raise ValueError(
            "Invalid version. Enter a semantic version such as 1.2.3 "
            "or 1.2.3-beta.1."
        )

    paths = {
        "package.json": PROJECT_ROOT / "package.json",
        "package-lock.json": PROJECT_ROOT / "package-lock.json",
        "tauri.conf.json": PROJECT_ROOT / "src-tauri" / "tauri.conf.json",
        "Cargo.toml": PROJECT_ROOT / "src-tauri" / "Cargo.toml",
        "Cargo.lock": PROJECT_ROOT / "src-tauri" / "Cargo.lock",
    }
    source = {name: read_text(path) for name, path in paths.items()}

    package = json.loads(source["package.json"])
    if package.get("name") != APP_NAME:
        raise ValueError("package.json name is not {}.".format(APP_NAME))

    package_lock = json.loads(source["package-lock.json"])
    root_package = package_lock.get("packages", {}).get("")
    if (
        package_lock.get("name") != APP_NAME
        or not isinstance(root_package, dict)
        or root_package.get("name") != APP_NAME
    ):
        raise ValueError("package-lock.json does not describe the {} project.".format(APP_NAME))

    tauri = json.loads(source["tauri.conf.json"])
    if tauri.get("productName") != APP_NAME:
        raise ValueError("tauri.conf.json productName is not {}.".format(APP_NAME))

    version_fields = {
        "package.json": package.get("version"),
        "package-lock.json": package_lock.get("version"),
        "package-lock.json root package": root_package.get("version"),
        "tauri.conf.json": tauri.get("version"),
    }
    for name, current_version in version_fields.items():
        if (
            not isinstance(current_version, str)
            or SEMVER.fullmatch(current_version) is None
        ):
            raise ValueError("{} has an invalid project version.".format(name))

    updated = {
        "package.json": replace_json_version(source["package.json"], version, 2),
        "package-lock.json": replace_package_lock_versions(
            source["package-lock.json"], version
        ),
        "tauri.conf.json": replace_json_version(
            source["tauri.conf.json"], version, 2
        ),
        "Cargo.toml": replace_cargo_manifest_version(
            source["Cargo.toml"], version
        ),
        "Cargo.lock": replace_cargo_lock_version(source["Cargo.lock"], version),
    }

    for name, text in updated.items():
        write_atomically(paths[name], text)


def get_current_version() -> str:
    package_path = PROJECT_ROOT / "package.json"
    package = json.loads(read_text(package_path))
    version = package.get("version")
    if package.get("name") != APP_NAME:
        raise ValueError("package.json name is not {}.".format(APP_NAME))
    if not isinstance(version, str) or SEMVER.fullmatch(version) is None:
        raise ValueError("package.json has an invalid project version.")
    return version


def main() -> int:
    try:
        current_version = get_current_version()
        print("Current project version: {}".format(current_version))
        version = input("Enter the new project version (for example, 1.2.3): ").strip()
        update_project_version(version)
    except EOFError:
        print("No version was entered.", file=sys.stderr)
        return 1
    except (OSError, ValueError) as error:
        print("Version update failed: {}".format(error), file=sys.stderr)
        return 1

    print("Updated the project version to {} in all version files.".format(version))
    return 0


if __name__ == "__main__":
    sys.exit(main())
