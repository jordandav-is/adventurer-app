/* Passphrase gate — only those who speak the words may enter.
   The passphrase itself is never stored here, only a salted SHA-256 hash.

   To change the passphrase, run in any shell:
     SALT=$(openssl rand -hex 8); printf '%s' "$SALT:your-new-passphrase" | openssl dgst -sha256
   then paste the new salt and hash below and push. Devices already unlocked
   stay unlocked until the hash changes (unlock tokens are checked against it). */
export const GATE_SALT = "0c50b4b93b3fa3d4";
export const GATE_HASH = "3f1fb663ea3fc56fcf7a01a8b74622b38045019932e4f4276fed5891b48482de";
