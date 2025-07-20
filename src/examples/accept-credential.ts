import {
  Client,
  Wallet,
  type SubmittableTransaction,
  type Transaction,
  convertStringToHex as stringToHex,
} from "xrpl";
import dotenv from "dotenv";

// CredentialAccept transaction type definition
interface CredentialAcceptTransaction extends Omit<Transaction, "TransactionType"> {
  TransactionType: "CredentialAccept";
  Account: string;
  Issuer: string;
  CredentialType: string;
}

// Load environment variables
dotenv.config();

// Environment variable definitions
const XRPL_NETWORK = process.env.XRPL_NETWORK || "wss://s.devnet.rippletest.net:51233/";
const XRPL_ACCOUNT_ADDRESS = process.env.XRPL_ACCOUNT_ADDRESS; // Credential issuer
const ALICE_ADDRESS = process.env.ALICE_ADDRESS; // Alice's account
const ALICE_SEED = process.env.ALICE_SEED;
const CREDENTIAL_TYPE = process.env.CREDENTIAL_TYPE || "XRPLCommunityExamCertification";

// Input validation
if (!XRPL_NETWORK || !XRPL_ACCOUNT_ADDRESS) {
  throw new Error("Environment variables are not set correctly");
}

if (!ALICE_ADDRESS || !ALICE_SEED) {
  throw new Error("Alice's account is not set in ENV");
}

/**
 * Credential acceptance scenario
 *
 * 1. Alice accepts the issued credential
 * 2. Display transaction result
 */
async function runCredentialAcceptScenario() {
  // Initialize client
  const client = new Client(XRPL_NETWORK);
  await client.connect();

  try {
    console.log("Connected to XRPL network");

    // Alice's wallet
    if (!ALICE_SEED) {
      throw new Error("Alice's seed is not set");
    }
    const aliceWallet = Wallet.fromSeed(ALICE_SEED);
    console.log(`Alice's address: ${aliceWallet.address}`);

    // Step 1: Alice accepts the credential
    console.log("\n1. Alice accepts the credential...");

    if (!XRPL_ACCOUNT_ADDRESS) {
      throw new Error("Issuer address is not set");
    }

    const credentialAcceptTx: CredentialAcceptTransaction = {
      TransactionType: "CredentialAccept",
      Account: aliceWallet.address,
      Issuer: XRPL_ACCOUNT_ADDRESS,
      CredentialType: stringToHex(CREDENTIAL_TYPE),
    };

    console.log("Transaction details:");
    console.log(`- Account: ${credentialAcceptTx.Account}`);
    console.log(`- Issuer: ${credentialAcceptTx.Issuer}`);
    console.log(`- Credential Type: ${CREDENTIAL_TYPE}`);

    // Send transaction
    const prepared = await client.autofill(credentialAcceptTx as unknown as SubmittableTransaction);
    const signed = aliceWallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    if (result.result.meta && typeof result.result.meta === "object") {
      console.log("\n✅ Credential acceptance successful!");
      console.log(`Transaction hash: ${result.result.hash}`);
      console.log(`Transaction result: ${result.result.meta.TransactionResult}`);

      if (result.result.validated) {
        console.log("Transaction validated on ledger");
      }
    } else {
      console.error("❌ Credential acceptance failed");
      console.error("Transaction meta is missing or invalid");
    }
  } catch (error) {
    console.error("❌ An error occurred:", error);
  } finally {
    await client.disconnect();
  }
}

runCredentialAcceptScenario();
