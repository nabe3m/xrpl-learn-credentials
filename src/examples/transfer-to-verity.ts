import { Client, Wallet, type Payment, type TransactionMetadata } from "xrpl";
import dotenv from "dotenv";
import { getUserConfirmation } from "../utils/inputUtils";

// Load environment variables
dotenv.config();

// Environment variable definitions
const XRPL_NETWORK = process.env.XRPL_NETWORK || "wss://s.devnet.rippletest.net:51233/";
// const ISSUER_ADDRESS = process.env.XRPL_ACCOUNT_ADDRESS; // Credential issuer (unused)
const VERITY_ADDRESS = process.env.VERITY_ADDRESS; // Payment destination (verifier)
const ALICE_ADDRESS = process.env.ALICE_ADDRESS; // Account with credentials
const ALICE_SEED = process.env.ALICE_SEED;
const BOB_ADDRESS = process.env.BOB_ADDRESS; // Account without credentials
const BOB_SEED = process.env.BOB_SEED;

// Input validation
if (!XRPL_NETWORK || !VERITY_ADDRESS) {
  throw new Error("Environment variables are not set correctly");
}

if (!ALICE_ADDRESS || !ALICE_SEED) {
  throw new Error("Alice's account is not set in ENV");
}

if (!BOB_ADDRESS || !BOB_SEED) {
  throw new Error("Bob's account is not set in ENV");
}

/**
 * Send XRP function
 * @param client XRPL client
 * @param sender Sender wallet
 * @param destination Destination address
 * @param amount Transfer amount (XRP)
 * @param credentialIDs Optional credential ID array
 * @returns Transaction hash or error message
 */
async function sendXRP(
  client: Client,
  sender: Wallet,
  destination: string,
  amount: string,
  credentialIDs?: string[],
): Promise<{
  success: boolean;
  from: string;
  to: string;
  amount: string;
  hash?: string;
  fee?: string;
  error?: string;
}> {
  try {
    // Payment transaction creation
    const payment: Payment = {
      TransactionType: "Payment",
      Account: sender.address,
      Destination: destination,
      Amount: (Number.parseFloat(amount) * 1000000).toString(), // XRP is converted to drops (1 XRP = 1,000,000 drops)
    };

    // If credential IDs are provided, add them to the transaction
    if (credentialIDs && credentialIDs.length > 0) {
      payment.CredentialIDs = credentialIDs;
    }

    // Prepare and submit the transaction
    const prepared = await client.autofill(payment);
    const signed = sender.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    // Check the result
    if (
      typeof result.result.meta === "object" &&
      result.result.meta &&
      (result.result.meta as TransactionMetadata).TransactionResult === "tesSUCCESS"
    ) {
      console.log(
        `Transfer successful: ${sender.address} -> ${destination}, Amount: ${amount} XRP`,
      );
      return {
        success: true,
        from: sender.address,
        to: destination,
        amount: amount,
        hash: result.result.hash,
        fee: prepared.Fee ? (Number.parseInt(prepared.Fee) / 1000000).toString() : "0",
      };
    }

    const errorCode =
      (result.result.meta as TransactionMetadata)?.TransactionResult || "Unknown error";
    return {
      success: false,
      from: sender.address,
      to: destination,
      amount: amount,
      error: errorCode,
      hash: result.result.hash,
      fee: prepared.Fee ? (Number.parseInt(prepared.Fee) / 1000000).toString() : "0",
    };
  } catch (err: unknown) {
    const error = err as Error;
    console.error("Transfer error:", error.message);
    return {
      success: false,
      from: sender.address,
      to: destination,
      amount: amount,
      error: error.message,
    };
  }
}

/**
 * Test transfers from an account to an Issuer
 */
async function testTransfersToIssuer() {
  // Initialize client
  const client = new Client(XRPL_NETWORK);
  await client.connect();

  try {
    console.log("Connected to XRPL network");
    console.log(`Verity (Recipient): ${VERITY_ADDRESS}`);

    // Alice's wallet (account with credentials)
    const aliceWallet = Wallet.fromSeed(ALICE_SEED as string);
    console.log(`\nAlice (Sender, Credentials): ${aliceWallet.address}`);

    // Bob's wallet (account without credentials)
    const bobWallet = Wallet.fromSeed(BOB_SEED as string);
    console.log(`Bob (Sender, No Credentials): ${bobWallet.address}`);

    // Transfer amount (XRP)
    const transferAmount = "1.0"; // 1 XRP

    // Test execution confirmation
    const confirmed = await getUserConfirmation(
      `\nExecute transfer test from Alice and Bob to ${VERITY_ADDRESS} for ${transferAmount} XRP? (y/n): `,
    );

    if (!confirmed) {
      console.log("Test cancelled");
      return;
    }

    // Get credential ID
    const credentialID = process.env.CREDENTIAL_ID || "";

    // 1. Alice's transfer test (with credentials)
    console.log(`\n1. Sending ${transferAmount} XRP from Alice to ${VERITY_ADDRESS as string}...`);
    console.log(`Including credential ID [${credentialID}]`);
    const aliceResult = await sendXRP(
      client,
      aliceWallet,
      VERITY_ADDRESS as string,
      transferAmount,
      [credentialID],
    );

    if (aliceResult.success) {
      console.log("Alice's transfer successful!");
      console.log(`Transaction hash: ${aliceResult.hash}`);
      console.log(`Fee: ${aliceResult.fee} XRP`);
    } else {
      console.log("Alice's transfer failed");
      console.log(`Error: ${aliceResult.error}`);
      if (aliceResult.hash) {
        console.log(`Transaction hash: ${aliceResult.hash}`);
      }
      if (aliceResult.fee) {
        console.log(`Fee: ${aliceResult.fee} XRP`);
      }
    }

    // 2. Bob's transfer test (without credentials)
    console.log(`\n2. Sending ${transferAmount} XRP from Bob to ${VERITY_ADDRESS as string}...`);
    const bobResult = await sendXRP(client, bobWallet, VERITY_ADDRESS as string, transferAmount);

    if (bobResult.success) {
      console.log("Bob's transfer successful!");
      console.log(`Transaction hash: ${bobResult.hash}`);
      console.log(`Fee: ${bobResult.fee} XRP`);
    } else {
      console.log("Bob's transfer failed");
      console.log(`Error: ${bobResult.error}`);
      if (bobResult.hash) {
        console.log(`Transaction hash: ${bobResult.hash}`);
      }
      if (bobResult.fee) {
        console.log(`Fee: ${bobResult.fee} XRP`);
      }
    }

    // 3. Result summary
    console.log("\n-------- Transfer Test Results --------");
    console.log(`Alice (Credentials) -> Verity: ${aliceResult.success ? "Success" : "Failed"}`);
    console.log(`Bob (No Credentials) -> Verity: ${bobResult.success ? "Success" : "Failed"}`);

    if (!aliceResult.success && aliceResult.error === "tecNO_PERMISSION") {
      console.log("\nNote: If Alice's transfer failed, please check:");
      console.log("1. 'DepositAuth' flag is enabled on the Verity account");
      console.log("2. Alice's account is approved in DepositPreauth settings");
    }

    if (!bobResult.success && bobResult.error === "tecNO_PERMISSION") {
      console.log("\nBob's transfer failure is normal:");
      console.log(
        "Transfers from accounts without credentials are rejected when DepositPreauth is set",
      );
      console.log(
        "The error code 'tecNO_PERMISSION' indicates that this setting is functioning correctly",
      );
    }
  } catch (error) {
    console.error("An error occurred:", error);
  } finally {
    await client.disconnect();
    console.log("\nDisconnected from XRPL network");
  }
}

// Script execution
testTransfersToIssuer();
