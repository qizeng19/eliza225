 
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


 

const transferTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Example response:
\`\`\`json
{
    "requestType": "wallet_address",
    "queryContext": null
}
\`\`\`

{{recentMessages}}

Extract the following information about the wallet address request:
- Is the user asking about a wallet address, public key, or keypair? Set requestType to "wallet_address" if yes, null if no.
- Any specific context about the request (e.g., "main wallet", "token wallet", etc). Set as queryContext.

Common phrases that indicate a wallet address request:
- "What's your wallet address?"
- "Show me your public key"
- "What's your Solana address?"
- "Give me your wallet"
`;

export default {
    name: "WALLET_KEYPAIR",
    similes: [ "MY_WALLET", "MY_KEYPAIR", "MY_PUBLIC_KEY"],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        // Always return true for token transfers, letting the handler deal with specifics
        elizaLogger.log("Validating token transfer from user:", message.userId);
        return true;
    },
    description: "return a keypair for the agent's wallet",
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
            console.log("secretPath", secretPath);
            const subject = "wallet_address";
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

            return true;
        } catch (error) {
            elizaLogger.error("Error during wallet keypair:", error);
            if (callback) {
                callback({
                    text: `Issue with the wallet keypair: ${error.message}`,
                    content: { error: error.message },
                });
            }
            return false;
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
                    text: "Your Solana wallet address is 9jW8FPr6BSSsemWPV22UUCzSqkVdTp6HTyPqeqyuBbCa",
                    action: "WALLET_KEYPAIR",
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
                    text: "Your Solana wallet address is 9jW8FPr6BSSsemWPV22UUCzSqkVdTp6HTyPqeqyuBbCa",
                    action: "WALLET_KEYPAIR",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;