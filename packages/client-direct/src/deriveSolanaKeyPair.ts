import { Keypair } from "@solana/web3.js";
import crypto from "crypto";
/**
 * Derives a Solana keypair from a secret path and subject using SHA-256
 * @param secretPath - A secret value used as the base for key derivation
 * @param subject - Additional context for key derivation
 * @returns Solana Keypair
 */
export function deriveSolanaKeypair(
    secretPath: string,
    subject: string
): Keypair {
    if (!secretPath || !subject) {
        throw new Error(
            "Secret path and subject are required for key derivation"
        );
    }

    try {
        // Combine the secret path and subject to create the initial seed
        const combinedSeed = `${secretPath}:${subject}`;


        // Create a SHA-256 hash of the combined seed
        const hash = crypto.createHash("sha256");
        hash.update(Buffer.from(combinedSeed, "utf-8"));
        const hashedSeed = hash.digest();

        // Convert to Uint8Array and use first 32 bytes as seed
        const seedArray = new Uint8Array(hashedSeed);
        const keypair = Keypair.fromSeed(seedArray.slice(0, 32));

        return keypair;
    } catch (error) {
        throw error;
    }
}