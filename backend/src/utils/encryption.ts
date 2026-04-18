import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const IV_LENGTH = 16; // For AES, this is always 16

if (!ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_KEY environment variable is required');
}

if (ENCRYPTION_KEY.length !== 32) {
  throw new Error('ENCRYPTION_KEY must be exactly 32 characters for AES-256');
}

class Encryption {
  /**
   * Encrypt text
   * @param text - Text to encrypt
   * @returns Encrypted text
   */
  encrypt(text: string): string {
    if (!text) return '';

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      Buffer.from(ENCRYPTION_KEY as string),
      iv
    );

    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }

  /**
   * Decrypt text
   * @param text - Encrypted text
   * @returns Decrypted text
   */
  decrypt(text: string): string {
    if (!text) return '';

    try {
      const textParts = text.split(':');
      const iv = Buffer.from(textParts.shift()!, 'hex');
      const encryptedText = Buffer.from(textParts.join(':'), 'hex');

      const decipher = crypto.createDecipheriv(
        'aes-256-cbc',
        Buffer.from(ENCRYPTION_KEY as string),
        iv
      );

      let decrypted = decipher.update(encryptedText);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return decrypted.toString();
    } catch (error) {
      console.error('Decryption error:', error);
      return '';
    }
  }

  /**
   * Hash data (one-way, cannot be decrypted)
   * Used for health card numbers, etc.
   */
  hash(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
  }
}

export default new Encryption();