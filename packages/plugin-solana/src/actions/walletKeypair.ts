 
import { elizaLogger } from "@elizaos/core";
 
import {
    type ActionExample,
    type Content,
    type HandlerCallback,
    type IAgentRuntime,
    type Memory,
 
    type State,
    type Action,
} from "@elizaos/core";
 
import { deriveSolanaKeypair } from "../deriveSolanaKeyPair";

export default {
    name: "WALLET_ADDRESS",
    similes: [ "WALLET", "KEYPAIR", "PUBLIC_KEY"],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        // Always return true for token transfers, letting the handler deal with specifics
        elizaLogger.log("Validating token transfer from user:", message.userId);
        return true;
    },
    description: "when ask your wallet address or ask your publicKey ,return a publicKey for the agent's wallet",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<boolean> => {
        elizaLogger.log("Starting WALLET_KEYPAIR handler...");
        
        try {

            const secretPath = runtime.getSetting("WALLET_SECRET_SALT");
            if (!secretPath) {
                elizaLogger.error(
                    "Wallet secret salt is not configured in settings"
                );
                return false;
            }
            const subject = runtime.agentId;
            elizaLogger.info("params111::", secretPath, subject)
            const keypair = deriveSolanaKeypair(secretPath, subject);
            const publicKey = keypair.publicKey.toBase58();
             

            if (callback) {
                callback({
                    text: `Your Solana wallet address is ${publicKey}`,
                    content: {
                        success: true,
                        publicKey,
                    },
                });
            }

        } catch (error) {
            elizaLogger.error("Error during wallet keypair:", error);
            if (callback) {
                callback({
                    text: `Issue with the wallet keypair: ${error.message}`,
                    content: { error: error.message },
                });
            }
        }
    },

    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "What's your wallet address?",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Your Solana wallet address is ...",
                    action: "WALLET_ADDRESS",
                },
            },
            {
                user: "{{user1}}",
                content: {
                    text: "What's your public key?",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Your Solana wallet address is ...",
                    action: "WALLET_ADDRESS",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;