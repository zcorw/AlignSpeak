#!/usr/bin/env python3
from __future__ import annotations

import argparse
import getpass
import sys
from pathlib import Path


def _bootstrap_import_path() -> None:
    script_path = Path(__file__).resolve()
    api_root = script_path.parents[1]
    if str(api_root) not in sys.path:
        sys.path.insert(0, str(api_root))


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate an Argon2 password hash compatible with AlignSpeak auth."
    )
    parser.add_argument("password", nargs="?", help="Plain password. Omit to input securely.")
    parser.add_argument(
        "--verify",
        action="store_true",
        help="Verify generated hash with the same password and print check result.",
    )
    args = parser.parse_args()

    password = args.password
    if password is None:
        password = getpass.getpass("Password: ")

    if password is None:
        print("Password is required.", file=sys.stderr)
        return 1

    _bootstrap_import_path()
    from app.core.security import hash_password, verify_password  # pylint: disable=import-outside-toplevel

    hashed = hash_password(password)
    print(hashed)

    if args.verify:
        print(f"verify={verify_password(password, hashed)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
