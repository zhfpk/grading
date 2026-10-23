import base64
import json

from nacl.encoding import HexEncoder
from nacl.public import PrivateKey, SealedBox
from nacl.signing import SigningKey, VerifyKey
from nacl.utils import random
from nacl.secret import SecretBox


class SymmetricEncryptor:
    def __init__(self, key_bytes=None):
        self.key_bytes = key_bytes

        if self.key_bytes is None:
            self.key_bytes = random(SecretBox.KEY_SIZE)

        if len(self.key_bytes) != SecretBox.KEY_SIZE:
            raise ValueError("Invalid key size")

    def encrypt(self, plaintext):
        if plaintext is None:
            raise ValueError("Message cannot be None")

        if type(plaintext) is str:
            plaintext = plaintext.encode('utf-8')

        secret_box = SecretBox(self.key_bytes)
        ciphertext = secret_box.encrypt(plaintext)

        # todo: directly return the bytes and not the base64 representation to save storage requirements
        return base64.b64encode(ciphertext).decode('utf-8')

    def decrypt(self, ciphertext):
        secret_box = SecretBox(self.key_bytes)
        plaintext = secret_box.decrypt(ciphertext)
        return plaintext.decode('utf-8')

    def get_secret_key_hex(self):
        return self.key_bytes.hex()


class AsymmetricEncryptor:
    def __init__(self):
        self.private_key = PrivateKey.generate()

    def encrypt(self, plaintext):
        if plaintext is None:
            raise ValueError("Message cannot be None")

        if type(plaintext) is str:
            plaintext = plaintext.encode('utf-8')

        sealed_box = SealedBox(self.private_key.public_key)
        ciphertext = sealed_box.encrypt(plaintext)
        return base64.b64encode(ciphertext).decode('utf-8')

    def get_private_key_hex(self):
        return self.private_key.encode(encoder=HexEncoder).decode()

    def get_public_key_hex(self):
        return self.private_key.public_key.encode(encoder=HexEncoder).decode()


class Signer:
    def __init__(self, seed=None):
        if seed is None:
            self.signing_key = SigningKey.generate()
        else:
            self.signing_key = SigningKey(seed)

    def sign_base64_file(self, file_path, signature_file_name=None, prefix_bytes=None):
        if signature_file_name is None:
            signature_file_name = file_path.name + ".sig"

        signature_location = file_path.parent.joinpath(signature_file_name)
        with open(file_path, "r") as f:
            message = f.read()
        message_bytes = base64.b64decode(message)

        if prefix_bytes is not None:
            message_bytes = prefix_bytes + message_bytes

        signature_hex = self.sign_message(message_bytes)

        with open(signature_location, "w") as f:
            json.dump({
                "signature": signature_hex,
                "public_key": self.get_public_key_hex()
            }, f)

        return signature_hex

    def sign_message(self, message_bytes):
        signed_message = self.signing_key.sign(message_bytes)

        return signed_message.signature.hex()

    def get_private_key_hex(self):
        return self.signing_key.encode(encoder=HexEncoder).decode()

    def get_public_key_hex(self):
        return self.signing_key.verify_key.encode(encoder=HexEncoder).decode()


class SignatureVerifier:
    def __init__(self, public_key_hex):
        self.verify_key = VerifyKey(bytes.fromhex(public_key_hex))

    def is_signature_valid(self, message_bytes, signature_hex):
        signature = bytes.fromhex(signature_hex)
        try:
            self.verify_key.verify(message_bytes, signature)
            return True
        except Exception as e:
            return False