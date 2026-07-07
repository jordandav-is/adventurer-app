/* Passphrase gate — only those who speak the words may enter.
   The passphrase itself is never stored anywhere; only a PBKDF2-SHA256 hash
   (600,000 iterations) is committed. These values do ship in the public JS
   bundle, so the iteration count + a high-entropy passphrase are what make
   offline brute-forcing impractical.

   To change the passphrase, run:
     node -e "const c=require('crypto');const s=c.randomBytes(16).toString('hex');console.log('salt',s,'hash',c.pbkdf2Sync(process.argv[1],s,600000,32,'sha256').toString('hex'))" 'your-new-passphrase'
   then paste the new salt and hash below and push. Changing the hash
   re-locks every device. */
export const GATE_SALT = "edffce3ce9712cbd6f997900359f6dd9";
export const GATE_HASH = "faf79b899def21c5e3f3cdce3ac6813f2ac2c01c8b4f9c6cce222cf84ad4aed1";
export const GATE_ITERATIONS = 600000;
