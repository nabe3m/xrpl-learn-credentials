import { Client, Wallet, convertStringToHex as stringToHex } from "xrpl";
import dotenv from "dotenv";
import {
  checkAndEnableDepositAuth,
  setupCredentialTypePreauth,
  getCredentialTypePreauths,
} from "../utils/depositPreauthUtils";

// Load environment variables
dotenv.config();

// Environment variable definitions
const XRPL_NETWORK = process.env.XRPL_NETWORK || "wss://s.devnet.rippletest.net:51233/";
const XRPL_ACCOUNT_ADDRESS = process.env.XRPL_ACCOUNT_ADDRESS; // Credential issuer
const VERITY_ADDRESS = process.env.VERITY_ADDRESS;
const VERITY_SEED = process.env.VERITY_SEED;
const CREDENTIAL_TYPE = process.env.CREDENTIAL_TYPE || "XRPLCommunityExamCertification";

// Input validation
if (!XRPL_NETWORK || !XRPL_ACCOUNT_ADDRESS || !VERITY_ADDRESS || !VERITY_SEED) {
  throw new Error("Environment variables are not set correctly");
}

/**
 * Credential pre-authorization scenario
 *
 * 1. Enable DepositAuth on Verity account
 * 2. Set up credential-based authorization
 * 3. Display current configuration status
 */
async function runCredentialPreauthScenario() {
  // Initialize client
  const client = new Client(XRPL_NETWORK);
  await client.connect();

  try {
    console.log("Connected to XRPL network");

    // Verity wallet (third-party verifier)
    if (!VERITY_SEED) {
      throw new Error("Verity seed is not set");
    }
    const verityWallet = Wallet.fromSeed(VERITY_SEED);
    console.log(`Verity address: ${verityWallet.address}`);
    console.log(`Issuer address: ${XRPL_ACCOUNT_ADDRESS}`);
    console.log(`Credential type: ${CREDENTIAL_TYPE}`);

    // Step 1: Check and enable DepositAuth
    console.log("\n1. Checking and enabling DepositAuth...");
    const depositAuthEnabled = await checkAndEnableDepositAuth(client, verityWallet);

    if (depositAuthEnabled) {
      console.log("DepositAuth setup completed");
    } else {
      console.log("DepositAuth is already enabled");
    }

    // Step 2: Set up credential-based authorization
    console.log("\n2. Setting up credential-based authorization...");
    console.log(`Authorizing credential type: ${CREDENTIAL_TYPE}`);

    // Convert credential type to hex
    const credentialTypeHex = stringToHex(CREDENTIAL_TYPE);
    console.log(`Credential type (hex): ${credentialTypeHex}`);

    if (!XRPL_ACCOUNT_ADDRESS) {
      throw new Error("Issuer account address is not set");
    }

    const result = await setupCredentialTypePreauth(
      client,
      verityWallet,
      XRPL_ACCOUNT_ADDRESS,
      credentialTypeHex,
    );

    console.log(`Setup result: ${result.status === "tesSUCCESS" ? "Success" : "Failed"}`);
    console.log(`Transaction hash: ${result.hash}`);

    // Step 3: Display current configuration status
    console.log("\n3. Displaying current configuration...");

    const authorizedCredentials = await getCredentialTypePreauths(client, verityWallet.address);

    if (authorizedCredentials.length > 0) {
      console.log("Current Credential-based DepositPreauth settings for Verity account:");
      authorizedCredentials.forEach((cred, index) => {
        console.log(`${index + 1}. Issuer: ${cred.issuer}`);
        console.log(`   Credential Type: ${cred.credentialType}`);
      });
    } else {
      console.log("No Credential-based DepositPreauth settings found for Verity account");
    }

    console.log("\n✅ Credential pre-authorization setup completed successfully!");
  } catch (error) {
    console.error("❌ An error occurred:", error);
  } finally {
    await client.disconnect();
  }
}

runCredentialPreauthScenario();
