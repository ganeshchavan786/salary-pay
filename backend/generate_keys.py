#!/usr/bin/env python3
"""
Generate secure keys for production deployment.
Run this script and copy the output to your .env file.
"""

import secrets
import base64
from cryptography.fernet import Fernet


def generate_secret_key(length: int = 64) -> str:
    """Generate a secure random secret key for JWT."""
    return secrets.token_urlsafe(length)


def generate_encryption_key() -> str:
    """Generate a Fernet encryption key for face descriptors."""
    return Fernet.generate_key().decode()


def main():
    print("=" * 60)
    print("PRODUCTION KEYS GENERATOR")
    print("=" * 60)
    print()
    print("Copy these values to your .env file:")
    print()
    print("-" * 60)
    print()
    print(f"SECRET_KEY={generate_secret_key()}")
    print()
    print(f"ENCRYPTION_KEY={generate_encryption_key()}")
    print()
    print("-" * 60)
    print()
    print("IMPORTANT:")
    print("   1. Keep these keys SECRET - never commit to git")
    print("   2. Use different keys for each environment")
    print("   3. Backup keys securely - losing ENCRYPTION_KEY")
    print("      means losing access to encrypted face data")
    print()
    print("=" * 60)


if __name__ == "__main__":
    main()
