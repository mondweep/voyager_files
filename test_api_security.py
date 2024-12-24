from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
import base64
import os
import json
import argparse

class SecurityAnalysis:
    def __init__(self):
        pass
    
    def generate_key(self, password: str, salt: bytes = None) -> tuple:
        if salt is None:
            salt = os.urandom(16)
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
            backend=default_backend()
        )
        key = kdf.derive(password.encode())
        return key, salt

    def encrypt_message(self, message: str, key: bytes) -> tuple:
        iv = os.urandom(16)
        cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
        encryptor = cipher.encryptor()
        padded_message = self._pad_message(message.encode('utf-8'))
        ciphertext = encryptor.update(padded_message) + encryptor.finalize()
        return base64.b64encode(ciphertext), iv

    def _pad_message(self, message: bytes) -> bytes:
        block_size = 16
        padding_length = block_size - (len(message) % block_size)
        padding = bytes([padding_length] * padding_length)
        return message + padding

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--mode', required=True)
    parser.add_argument('--data', required=True)
    parser.add_argument('--password', required=True)
    args = parser.parse_args()

    security = SecurityAnalysis()
    
    if args.mode == 'encrypt':
        try:
            # Generate key and salt
            key, salt = security.generate_key(args.password)
            
            # Encrypt the message
            encrypted, iv = security.encrypt_message(args.data, key)
            
            # Format the result as JSON
            result = {
                'encrypted': encrypted.decode('utf-8'),
                'iv': base64.b64encode(iv).decode('utf-8'),
                'salt': base64.b64encode(salt).decode('utf-8')
            }
            
            # Print the JSON result
            print(json.dumps(result))
        except Exception as e:
            print(json.dumps({'error': str(e)}))
