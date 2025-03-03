import { Keypair, PublicKey } from "@solana/web3.js";
import { DeriveKeyProvider, TEEMode } from "@elizaos-plugins/plugin-tee";
 
 

export interface KeypairResult {
    keypair?: Keypair;
    publicKey?: PublicKey;
}

/**
 * Gets either a keypair or public key based on TEE mode and runtime settings
 * @param runtime The agent runtime
 * @param requirePrivateKey Whether to return a full keypair (true) or just public key (false)
 * @returns KeypairResult containing either keypair or public key
 */
export async function getWalletKey(
    agentId: string,
    requirePrivateKey = true,
    walletSecretSalt: string
): Promise<KeypairResult> {

        if (!walletSecretSalt) {
            throw new Error(
                "WALLET_SECRET_SALT required when TEE_MODE is enabled"
            );
        }
        if(TEEMode.OFF) {
            return (requirePrivateKey
            ? { keypair: "test keypair" }
            : { publicKey: "test public key" }) as any;
        }
        const deriveKeyProvider = new DeriveKeyProvider(TEEMode.PRODUCTION || TEEMode.LOCAL);
        const deriveKeyResult = await deriveKeyProvider.deriveEd25519Keypair(
            walletSecretSalt,
            "solana",
            agentId
        );

        return requirePrivateKey
            ? { keypair: deriveKeyResult.keypair }
            : { publicKey: deriveKeyResult.keypair.publicKey };
}
