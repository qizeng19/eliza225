import { generateImage, elizaLogger } from "@elizaos/core";
import { clusterApiUrl, Connection, Keypair, LAMPORTS_PER_SOL, type PublicKey } from "@solana/web3.js";
import { VersionedTransaction } from "@solana/web3.js";
import { Fomo, type PurchaseCurrency } from "fomo-sdk-solana";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PumpFunSDK } from "./pumpfunsdk/index.ts";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import bs58 from "bs58";
import { z } from "zod";
import {
    settings,
    type ActionExample,
    type Content,
    type HandlerCallback,
    type IAgentRuntime,
    type Memory,
    ModelClass,
    type State,
    generateObject,
    composeContext,
    type Action,
} from "@elizaos/core";

import { walletProvider } from "../providers/wallet.ts";
import { getWalletKey } from "../keypairUtils.ts";

interface CreateTokenMetadata {
    name: string;
    symbol: string;
    uri: string;

}
export interface CreateAndBuyContent extends Content {
    tokenMetadata: {
        name: string;
        symbol: string;
        description: string;
        image_description: string;
    };
    buyAmountSol: string | number;
    requiredLiquidity: string | number;
}

export function isCreateAndBuyContentForFomo(
    content: any
): content is CreateAndBuyContent {
    elizaLogger.log("Content for create & buy", content.object);
    return (
        typeof content.tokenMetadata === "object" &&
        content.tokenMetadata !== null &&
        typeof content.tokenMetadata.name === "string" &&
        typeof content.tokenMetadata.symbol === "string" &&
        typeof content.tokenMetadata.description === "string" &&
        typeof content.tokenMetadata.image_description === "string" &&
        (typeof content.buyAmountSol === "string" ||
            typeof content.buyAmountSol === "number") &&
        typeof content.requiredLiquidity === "number"
    );
}
const createAndBuyToken = async (sdk, deployerKeypair, mint, tokenMetadata, buyAmountSol, callback, runtime) => {
    const SLIPPAGE_BASIS_POINTS = 500n;
    // const tokenMetadata = {
    //     name: "TST-7",
    //     symbol: "TST-7",
    //     description: "TST-7: This is a test token",
    //     filePath: "example/basic/random.png",
    // };

    const result = await sdk.createAndBuy(
        deployerKeypair,
        mint,
        tokenMetadata,
        BigInt(buyAmountSol * LAMPORTS_PER_SOL),
        SLIPPAGE_BASIS_POINTS,
        {
            unitLimit: 250000,
            unitPrice: 250000,
        }
    );

    if (callback) {
        if (result.success) {
            callback({
                text: `Token ${tokenMetadata.name} (${tokenMetadata.symbol}) created successfully!\nURL: https://pump.fun/coin/${mint.publicKey.toBase58()}\n`,
                content: {
                    tokenInfo: {
                        symbol: tokenMetadata.symbol,
                        address: mint.publicKey.toBase58(),
                        creator: result.creator,
                        name: tokenMetadata.name,
                        description: tokenMetadata.description,
                        timestamp: Date.now(),
                    },
                },
            });
            fetch("https://dapp.haive.club/api/token", {
                method: "POST",
                body: JSON.stringify({
                //   agentId: runtime.agentId,
                  agentId:"4e355329-acdc-0793-855e-d8898c822dbd",
                //   mintAddress: mint.publicKey.toBase58(),
                  mintAddress:"AQiE2ghyFbBsbsfHiTEbKWcCLTDgyGzceKEPWftZpump"
                }),
              })
                .then((response) => response.json())
                .then((data) => {
                  console.log("  @response:", data);
                })
                .catch((error) => {
                  console.error("  @error:", error);
                });
        } else {
            callback({
                text: `Failed to create token: ${result.error}\nAttempted mint address: ${result.ca}`,
                content: {
                    error: result.error,
                    mintAddress: result.ca,
                },
            });
            
        }
    }

};
export const createAndBuyToken2 = async ({
    deployer,
    mint,
    tokenMetadata,
    buyAmountSol,
    priorityFee,
    requiredLiquidity = 85,
    allowOffCurve,
    commitment = "confirmed",
    fomo,
    connection,
}: {
    deployer: Keypair;
    mint: Keypair;
    tokenMetadata: CreateTokenMetadata;
    buyAmountSol: bigint;
    priorityFee: number;
    requiredLiquidity: number;
    allowOffCurve: boolean;
    commitment?:
    | "processed"
    | "confirmed"
    | "finalized"
    | "recent"
    | "single"
    | "singleGossip"
    | "root"
    | "max";
    fomo: Fomo;
    connection: Connection;
    slippage: string;
}) => {
    const { transaction: versionedTx } = await fomo.createToken(
        deployer.publicKey,
        tokenMetadata.name,
        tokenMetadata.symbol,
        tokenMetadata.uri,
        priorityFee,
        bs58.encode(mint.secretKey),
        requiredLiquidity,
        Number(buyAmountSol) / 10 ** 9
    );

    const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();
    versionedTx.message.recentBlockhash = blockhash;
    versionedTx.sign([mint]);

    const serializedTransaction = versionedTx.serialize();
    const serializedTransactionBase64 = Buffer.from(
        serializedTransaction
    ).toString("base64");

    const deserializedTx = VersionedTransaction.deserialize(
        Buffer.from(serializedTransactionBase64, "base64")
    );

    const txid = await connection.sendTransaction(deserializedTx, {
        skipPreflight: false,
        maxRetries: 3,
        preflightCommitment: "confirmed",
    });

    elizaLogger.log("Transaction sent:", txid);

    // Confirm transaction using the blockhash
    const confirmation = await connection.confirmTransaction(
        {
            signature: txid,
            blockhash: blockhash,
            lastValidBlockHeight: lastValidBlockHeight,
        },
        commitment
    );

    if (!confirmation.value.err) {
        elizaLogger.log(
            "Success:",
            `https://fomo.fund/token/${mint.publicKey.toBase58()}`
        );
        const ata = getAssociatedTokenAddressSync(
            mint.publicKey,
            deployer.publicKey,
            allowOffCurve
        );
        const balance = await connection.getTokenAccountBalance(
            ata,
            "processed"
        );
        const amount = balance.value.uiAmount;
        if (amount === null) {
            elizaLogger.log(
                `${deployer.publicKey.toBase58()}:`,
                "No Account Found"
            );
        } else {
            elizaLogger.log(`${deployer.publicKey.toBase58()}:`, amount);
        }

        return {
            success: true,
            ca: mint.publicKey.toBase58(),
            creator: deployer.publicKey.toBase58(),
        };
    } else {
        elizaLogger.log("Create and Buy failed");
        return {
            success: false,
            ca: mint.publicKey.toBase58(),
            error: confirmation.value.err || "Transaction failed",
        };
    }
};

export const buyToken = async ({
    fomo,
    buyer,
    mint,
    amount,
    priorityFee,
    allowOffCurve,
    slippage,
    connection,
    currency = "sol",
    commitment = "confirmed",
}: {
    fomo: Fomo;
    buyer: Keypair;
    mint: PublicKey;
    amount: number;
    priorityFee: number;
    allowOffCurve: boolean;
    slippage: number;
    connection: Connection;
    currency: PurchaseCurrency;
    commitment?:
    | "processed"
    | "confirmed"
    | "finalized"
    | "recent"
    | "single"
    | "singleGossip"
    | "root"
    | "max";
}) => {
    const buyVersionedTx = await fomo.buyToken(
        buyer.publicKey,
        mint,
        amount,
        slippage,
        priorityFee,
        currency || "sol"
    );

    const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();
    buyVersionedTx.message.recentBlockhash = blockhash;

    const serializedTransaction = buyVersionedTx.serialize();
    const serializedTransactionBase64 = Buffer.from(
        serializedTransaction
    ).toString("base64");

    const deserializedTx = VersionedTransaction.deserialize(
        Buffer.from(serializedTransactionBase64, "base64")
    );

    const txid = await connection.sendTransaction(deserializedTx, {
        skipPreflight: false,
        maxRetries: 3,
        preflightCommitment: "confirmed",
    });

    elizaLogger.log("Transaction sent:", txid);

    // Confirm transaction using the blockhash
    const confirmation = await connection.confirmTransaction(
        {
            signature: txid,
            blockhash: blockhash,
            lastValidBlockHeight: lastValidBlockHeight,
        },
        commitment
    );

    if (!confirmation.value.err) {
        elizaLogger.log(
            "Success:",
            `https://fomo.fund/token/${mint.toBase58()}`
        );
        const ata = getAssociatedTokenAddressSync(
            mint,
            buyer.publicKey,
            allowOffCurve
        );
        const balance = await connection.getTokenAccountBalance(
            ata,
            "processed"
        );
        const amount = balance.value.uiAmount;
        if (amount === null) {
            elizaLogger.log(
                `${buyer.publicKey.toBase58()}:`,
                "No Account Found"
            );
        } else {
            elizaLogger.log(`${buyer.publicKey.toBase58()}:`, amount);
        }
    } else {
        elizaLogger.log("Buy failed");
    }
};

export const sellToken = async ({
    fomo,
    seller,
    mint,
    amount,
    priorityFee,
    allowOffCurve,
    slippage,
    connection,
    currency = "token",
    commitment = "confirmed",
}: {
    fomo: Fomo;
    seller: Keypair;
    mint: PublicKey;
    amount: number;
    priorityFee: number;
    allowOffCurve: boolean;
    slippage: number;
    connection: Connection;
    currency: PurchaseCurrency;
    commitment?:
    | "processed"
    | "confirmed"
    | "finalized"
    | "recent"
    | "single"
    | "singleGossip"
    | "root"
    | "max";
}) => {
    const sellVersionedTx = await fomo.sellToken(
        seller.publicKey,
        mint,
        amount,
        slippage,
        priorityFee,
        currency || "token"
    );

    const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();
    sellVersionedTx.message.recentBlockhash = blockhash;

    const serializedTransaction = sellVersionedTx.serialize();
    const serializedTransactionBase64 = Buffer.from(
        serializedTransaction
    ).toString("base64");

    const deserializedTx = VersionedTransaction.deserialize(
        Buffer.from(serializedTransactionBase64, "base64")
    );

    const txid = await connection.sendTransaction(deserializedTx, {
        skipPreflight: false,
        maxRetries: 3,
        preflightCommitment: "confirmed",
    });

    elizaLogger.log("Transaction sent:", txid);

    // Confirm transaction using the blockhash
    const confirmation = await connection.confirmTransaction(
        {
            signature: txid,
            blockhash: blockhash,
            lastValidBlockHeight: lastValidBlockHeight,
        },
        commitment
    );

    if (!confirmation.value.err) {
        elizaLogger.log(
            "Success:",
            `https://fomo.fund/token/${mint.toBase58()}`
        );
        const ata = getAssociatedTokenAddressSync(
            mint,
            seller.publicKey,
            allowOffCurve
        );
        const balance = await connection.getTokenAccountBalance(
            ata,
            "processed"
        );
        const amount = balance.value.uiAmount;
        if (amount === null) {
            elizaLogger.log(
                `${seller.publicKey.toBase58()}:`,
                "No Account Found"
            );
        } else {
            elizaLogger.log(`${seller.publicKey.toBase58()}:`, amount);
        }
    } else {
        elizaLogger.log("Sell failed");
    }
};

const promptConfirmation = async (): Promise<boolean> => {
    return true;
};

const fomoTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Example response:
\`\`\`json
{
    "tokenMetadata": {
        "name": "Test Token",
        "symbol": "TEST",
        "description": "A test token",
        "image_description": "create an image of a rabbit"
    },
    "buyAmountSol": "0.00069",
    "requiredLiquidity": "85"
}
\`\`\`

{{recentMessages}}

Given the recent messages, extract or generate (come up with if not included) the following information about the requested token creation:
- Token name
- Token symbol
- Token description
- Token image description
- Amount of SOL to buy

Respond with a JSON markdown block containing only the extracted values.`;

export default {
    name: "CREATE_AND_BUY_TOKEN",
    similes: ["CREATE_AND_PURCHASE_TOKEN", "DEPLOY_AND_BUY_TOKEN"],
    validate: async (_runtime: IAgentRuntime, _message: Memory) => {
        return true; //return isCreateAndBuyContent(runtime, message.content);
    },
    description:
        "Create a new token and buy a specified amount using SOL. Requires deployer private key, token metadata, buy amount in SOL, priority fee, and allowOffCurve flag.",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<boolean> => {
        elizaLogger.info("Starting CREATE_AND_BUY_TOKEN handler...");

        // Compose state if not provided
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        // Get wallet info for context
        const walletInfo = await walletProvider.get(runtime, message, state);
        state.walletInfo = walletInfo;

        // Generate structured content from natural language
        const pumpContext = composeContext({
            state,
            template: fomoTemplate,
        });
        // 直接定义期望的对象结构
        const schema = z.object({
            tokenMetadata: z.object({
                name: z.string().describe("代币名称"),
                symbol: z.string()
                    .min(1)
                    .max(10)
                    .describe("代币符号，通常是大写字母"),
                description: z.string()
                    .min(1)
                    .describe("代币的简短描述"),
                image_description: z.string()
                    .min(1)
                    .describe("用于生成代币图片的描述文本")
            }).strict(), // 使用 strict() 确保没有额外的字段
            buyAmountSol: z.number()
                .min(0)
                .max(1000)
                .describe("SOL 数量，浮点数"),
            requiredLiquidity: z.number()
                .int()
                .min(0)
                .max(1000000)
                .default(0)
                .describe("所需流动性，整数，默认值为0")
        }).strict(); // 顶层也使用 strict()

        let content = await generateObject({
            runtime,
            context: pumpContext,
            modelClass: ModelClass.LARGE,
            schema: schema
        });
        content = content.object as any
        // Validate the generated content
        if (!isCreateAndBuyContentForFomo(content)) {
            elizaLogger.error(
                "Invalid content for CREATE_AND_BUY_TOKEN action."
            );
            return false;
        }

        const { tokenMetadata, buyAmountSol, requiredLiquidity } = content;
        /*
            // Generate image if tokenMetadata.file is empty or invalid
            if (!tokenMetadata.file || tokenMetadata.file.length < 100) {  // Basic validation
                try {
                    const imageResult = await generateImage({
                        prompt: `logo for ${tokenMetadata.name} (${tokenMetadata.symbol}) token - ${tokenMetadata.description}`,
                        width: 512,
                        height: 512,
                        count: 1
                    }, runtime);

                    if (imageResult.success && imageResult.data && imageResult.data.length > 0) {
                        // Remove the "data:image/png;base64," prefix if present
                        tokenMetadata.file = imageResult.data[0].replace(/^data:image\/[a-z]+;base64,/, '');
                    } else {
                        elizaLogger.error("Failed to generate image:", imageResult.error);
                        return false;
                    }
                } catch (error) {
                    elizaLogger.error("Error generating image:", error);
                    return false;
                }
            } */

        const imageResult = await generateImage(
            {
                prompt: `logo for ${tokenMetadata.name} (${tokenMetadata.symbol}) token - ${tokenMetadata.description}`,
                width: 256,
                height: 256,
                count: 1,
            },
            runtime
        );
        const imageBuffer = Buffer.from(imageResult.data[0], "base64");
        const formData = new FormData();
        const blob = new Blob([imageBuffer], { type: "image/png" });
        formData.append("file", blob, `${tokenMetadata.name}.png`);
        formData.append("name", tokenMetadata.name);
        formData.append("symbol", tokenMetadata.symbol);
        formData.append("description", tokenMetadata.description);

        // FIXME: does fomo.fund have an ipfs call?
        // const metadataResponse = await fetch("https://pump.fun/api/ipfs", {
        //     method: "POST",
        //     body: formData,
        // });
        // const metadataResponseJSON = (await metadataResponse.json()) as {
        //     name: string;
        //     symbol: string;
        //     metadataUri: string;
        // };
        // Add the default decimals and convert file to Blob
        const fullTokenMetadata = {
            name: tokenMetadata.name,
            symbol: tokenMetadata.symbol,
            description: tokenMetadata.description,
            file: blob,
        };

        // Default priority fee for high network load
        const priorityFee = {
            unitLimit: 100_000_000,
            unitPrice: 100_000,
        };
        const slippage = "2000";
        try {
            const { keypair: deployerKeypair } = await getWalletKey(runtime, true);
            // Get private key from settings and create deployer keypair
            // const privateKeyString =
            //     runtime.getSetting("SOLANA_PRIVATE_KEY") ??
            //     runtime.getSetting("WALLET_PRIVATE_KEY");
            // const secretKey = bs58.decode(privateKeyString);
            // const deployerKeypair = Keypair.fromSecretKey(secretKey) as any;

            // Generate new mint keypair
            const mintKeypair = Keypair.generate() as any;
          
            elizaLogger.log("1Executing create and buy transaction...", settings.SOLANA_RPC_URL);
            // Setup connection and SDK
            const connection = new Connection(process.env.SOLANA_RPC_URL || clusterApiUrl("devnet"));

            // 查询当前账户的余额
            const solbalance = await connection.getBalance(deployerKeypair.publicKey);
            elizaLogger.info("solbalance", solbalance);
            const wallet = (deployerKeypair  );
            // const wallet = new NodeWallet(deployerKeypair as any);
            const provider = new AnchorProvider(connection as any, new Wallet(wallet as any), AnchorProvider.defaultOptions());
            const sdk = new PumpFunSDK(provider);
            elizaLogger.info("wallet.publicKey", wallet.publicKey.toBase58());
            const currentSolBalance = await connection.getBalance(wallet.publicKey);
            
            if (currentSolBalance === 0) {
                console.log("Please send some SOL to the test-account:", wallet.publicKey.toBase58());
                return;
            }
            let bondingCurveAccount = await sdk.getBondingCurveAccount(mintKeypair.publicKey);
            elizaLogger.info("fullTokenMetadata", fullTokenMetadata);
            if (!bondingCurveAccount) {
                // const lamports = Math.floor(Number(buyAmountSol) * 1_000_000_000);
                elizaLogger.info("mintKeypair.publicKey", mintKeypair.publicKey.toBase58());
                await createAndBuyToken(sdk, deployerKeypair, mintKeypair, fullTokenMetadata, buyAmountSol, callback, runtime);
                bondingCurveAccount = await sdk.getBondingCurveAccount(mintKeypair.publicKey);
            }

             

            // Convert SOL to lamports (1 SOL = 1_000_000_000 lamports)
            // const lamports = Math.floor(Number(buyAmountSol) * 1_000_000_000);



            // if (callback) {
            //     if (result.success) {
            //         callback({
            //             text: `Token ${tokenMetadata.name} (${tokenMetadata.symbol}) created successfully!\nURL: https://fomo.fund/token/${result.ca}\nCreator: ${result.creator}\nView at: https://fomo.fund/token/${result.ca}`,
            //             content: {
            //                 tokenInfo: {
            //                     symbol: tokenMetadata.symbol,
            //                     address: result.ca,
            //                     creator: result.creator,
            //                     name: tokenMetadata.name,
            //                     description: tokenMetadata.description,
            //                     timestamp: Date.now(),
            //                 },
            //             },
            //         });
            //     } else {
            //         callback({
            //             text: `Failed to create token: ${result.error}\nAttempted mint address: ${result.ca}`,
            //             content: {
            //                 error: result.error,
            //                 mintAddress: result.ca,
            //             },
            //         });
            //     }
            // }
            //await trustScoreDb.addToken(tokenInfo);
            /*
                // Update runtime state
                await runtime.updateState({
                    ...state,
                    lastCreatedToken: tokenInfo
                });
                */
            // Log success message with token view URL
            // const successMessage = `Token created and purchased successfully! View at: https://fomo.fund/token/${mintKeypair.publicKey.toBase58()}`;
            // elizaLogger.log(successMessage);
            // return result.success;
        } catch (error) {
            elizaLogger.info("@Error during token creation:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
            elizaLogger.info("Stack trace:", error.stack);
            if (callback) {
                callback({
                    text: `Error during token creation: ${error.message}`,
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
                    text: "Create a new token called GLITCHIZA with symbol GLITCHIZA and generate a description about it on fomo.fund. Also come up with a description for it to use for image generation .buy 0.00069 SOL worth.",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Token GLITCHIZA (GLITCHIZA) created successfully on fomo.fund!\nURL: https://fomo.fund/token/673247855e8012181f941f84\nCreator: Anonymous\nView at: https://fomo.fund/token/673247855e8012181f941f84",
                    action: "CREATE_AND_BUY_TOKEN",
                    content: {
                        tokenInfo: {
                            symbol: "GLITCHIZA",
                            address:
                                "EugPwuZ8oUMWsYHeBGERWvELfLGFmA1taDtmY8uMeX6r",
                            creator:
                                "9jW8FPr6BSSsemWPV22UUCzSqkVdTp6HTyPqeqyuBbCa",
                            name: "GLITCHIZA",
                            description: "A GLITCHIZA token",
                        },
                    },
                },
            },
        ],
    ] as ActionExample[][],
} as Action;