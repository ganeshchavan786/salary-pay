import json
import base64
from typing import List
from cryptography.fernet import Fernet
from app.config import settings


def get_fernet() -> Fernet:
    key = settings.ENCRYPTION_KEY
    if len(key) < 32:
        key = key.ljust(32, '0')
    key = base64.urlsafe_b64encode(key[:32].encode())
    return Fernet(key)


def encrypt_descriptor(descriptor: List[float]) -> str:
    f = get_fernet()
    data = json.dumps(descriptor).encode()
    encrypted = f.encrypt(data)
    return encrypted.decode()


def decrypt_descriptor(encrypted: str) -> List[float]:
    f = get_fernet()
    decrypted = f.decrypt(encrypted.encode())
    return json.loads(decrypted.decode())
