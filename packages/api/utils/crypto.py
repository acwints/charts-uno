"""Fernet symmetric encryption for SQL connection credentials.

Requires SQL_ENCRYPTION_KEY env var (generate with:
  python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
)

Supports key rotation via SQL_ENCRYPTION_KEY_PREVIOUS for graceful migration.
"""
import os
import logging

from cryptography.fernet import Fernet, InvalidToken

logger = logging.getLogger(__name__)

_KEY = os.environ.get("SQL_ENCRYPTION_KEY", "")
_KEY_PREVIOUS = os.environ.get("SQL_ENCRYPTION_KEY_PREVIOUS", "")


def _get_fernet() -> Fernet:
    if not _KEY:
        raise RuntimeError("SQL_ENCRYPTION_KEY environment variable is not set")
    return Fernet(_KEY.encode())


def _get_fernet_previous() -> Fernet | None:
    if not _KEY_PREVIOUS:
        return None
    return Fernet(_KEY_PREVIOUS.encode())


def encrypt_credential(plaintext: str) -> str:
    """Encrypt a credential string. Returns base64-encoded ciphertext."""
    return _get_fernet().encrypt(plaintext.encode()).decode()


def decrypt_credential(ciphertext: str) -> str:
    """Decrypt a credential string. Falls back to previous key if current fails."""
    try:
        return _get_fernet().decrypt(ciphertext.encode()).decode()
    except InvalidToken:
        prev = _get_fernet_previous()
        if prev is None:
            raise
        logger.info("Decrypting with previous key (key rotation in progress)")
        return prev.decrypt(ciphertext.encode()).decode()
