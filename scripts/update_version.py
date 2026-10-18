import json
import os
import re
import shutil
import stat
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import List, Optional, Sequence, Tuple


APP_NAME = "caretellia"
PROJECT_ROOT = Path(__file__).resolve().parents[1]
VERSION_FILES = (
    "package.json",
    "package-lock.json",
    "src-tauri/tauri.conf.json",
    "src-tauri/Cargo.toml",
    "src-tauri/Cargo.lock",
)
SEMVER = re.compile(
    r"^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)"
    r"(?:-(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)"
    r"(?:\.(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*))*)?"
    r"(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$"
)


def run_command(arguments: Sequence[str]) -> str:
    try:
        result = subprocess.run(
            list(arguments),
            cwd=str(PROJECT_ROOT),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            encoding="utf-8",
            errors="replace",
            check=False,
        )
    except OSError as error:
        raise RuntimeError(
            "Could not run {}: {}".format(" ".join(arguments), error)
        )
    if result.returncode != 0:
        detail = result.stderr.strip() or result.stdout.strip()
        raise RuntimeError(
            "{} failed{}".format(
                " ".join(arguments),
                ": {}".format(detail) if detail else ".",
            )
        )
    return result.stdout


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


def fetch_release_branches() -> None:
    run_command(
        [
            "git",
            "fetch",
            "origin",
            "+refs/heads/dev:refs/remotes/origin/dev",
            "+refs/heads/release:refs/remotes/origin/release",
        ]
    )


def ensure_dev_is_synchronized() -> None:
    branch = run_command(["git", "branch", "--show-current"]).strip()
    if branch != "dev":
        raise ValueError(
            "Current branch is {!r}; switch to dev before preparing a release."
            .format(branch or "(detached HEAD)")
        )

    fetch_release_branches()
    counts = run_command(
        [
            "git",
            "rev-list",
            "--left-right",
            "--count",
            "HEAD...refs/remotes/origin/dev",
        ]
    ).split()
    if counts != ["0", "0"]:
        raise ValueError(
            "Local dev and origin/dev are not synchronized "
            "(ahead {}, behind {}). Sync dev and retry."
            .format(counts[0], counts[1])
        )


def check_release_pr_available() -> None:
    if shutil.which("gh") is None:
        raise ValueError(
            "GitHub CLI (gh) is required. Install it and run 'gh auth login'."
        )
    run_command(["gh", "auth", "status"])
    pull_requests = json.loads(
        run_command(
            [
                "gh",
                "pr",
                "list",
                "--head",
                "dev",
                "--base",
                "release",
                "--state",
                "open",
                "--json",
                "url",
                "--limit",
                "1",
            ]
        )
    )
    if pull_requests:
        raise ValueError(
            "An open PR from dev to release already exists: {}."
            .format(pull_requests[0]["url"])
        )


def stage_version_files() -> None:
    run_command(["git", "add", "--", *VERSION_FILES])


def get_staged_diff() -> str:
    return run_command(["git", "diff", "--cached", "--no-ext-diff"])


def publish_staged_changes(
    version: str,
    commit_message: str,
    pull_request_title: str,
    pull_request_body: str,
) -> None:
    run_command(
        [
            "git",
            "commit",
            "-m",
            commit_message,
            "--trailer",
            "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>",
        ]
    )
    try:
        run_command(["git", "push", "origin", "dev"])
    except RuntimeError as error:
        raise RuntimeError(
            "Commit was created locally but could not be pushed to origin/dev. "
            "Resolve the push error and push the commit manually. {}".format(error)
        )

    try:
        pull_request_url = run_command(
            [
                "gh",
                "pr",
                "create",
                "--base",
                "release",
                "--head",
                "dev",
                "--title",
                pull_request_title,
                "--body",
                pull_request_body,
            ]
        ).strip()
    except RuntimeError as error:
        raise RuntimeError(
            "Version {} was pushed to origin/dev, but PR creation failed. "
            "Create a PR from dev to release manually with "
            "'gh pr create --base release --head dev'. {}".format(version, error)
        )

    print("Pull request created: {}".format(pull_request_url))


def main() -> int:
    try:
        if shutil.which("git") is None:
            raise ValueError("Git is required to publish a version.")
        ensure_dev_is_synchronized()
        check_release_pr_available()

        current_version = get_current_version()
        print("Current project version: {}".format(current_version))
        version = input("Enter the new project version (for example, 1.2.3): ").strip()
        update_project_version(version)
        stage_version_files()
        staged_diff = get_staged_diff()
        if not staged_diff:
            raise ValueError(
                "The staged changes are empty; there is nothing to commit."
            )

        default_commit_message = "chore: release app-v{}".format(version)
        commit_message = input(
            "Commit message [{}]: ".format(default_commit_message)
        ).strip() or default_commit_message
        pull_request_title = input(
            "PR title [{}]: ".format(commit_message)
        ).strip() or commit_message
        pull_request_body = input("PR description (optional): ").strip()

        print("\nAll staged changes to be committed and pushed:")
        print(staged_diff, end="" if staged_diff.endswith("\n") else "\n")
        print("Target branch: origin/dev")
        print("PR target: release")
        confirmation = input(
            "Type PUSH to commit all staged changes and push to dev: "
        ).strip()
        if confirmation != "PUSH":
            print(
                "Cancelled. No commit or push was made; version files remain updated and staged."
            )
            return 0

        ensure_dev_is_synchronized()
        publish_staged_changes(
            version,
            commit_message,
            pull_request_title,
            pull_request_body,
        )
    except EOFError:
        print(
            "Input ended. No commit or push was made; any version changes may remain staged.",
            file=sys.stderr,
        )
        return 1
    except (OSError, ValueError, RuntimeError, json.JSONDecodeError) as error:
        print("Version release failed: {}".format(error), file=sys.stderr)
        return 1

    print("Version {} pushed to dev; review and merge the PR into release.".format(version))
    return 0


if __name__ == "__main__":
    sys.exit(main())
