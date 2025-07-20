import { Client, Wallet } from "xrpl";
import dotenv from "dotenv";
import { CredentialService } from "../services/credentialService";
import { getUserConfirmation } from "../utils/inputUtils";

// Load environment variables
dotenv.config();

// Environment variable definitions
const XRPL_NETWORK = process.env.XRPL_NETWORK || "wss://s.devnet.rippletest.net:51233/";
const XRPL_ACCOUNT_ADDRESS = process.env.XRPL_ACCOUNT_ADDRESS;
const XRPL_ACCOUNT_SECRET = process.env.XRPL_ACCOUNT_SECRET;
const CREDENTIAL_TYPE = process.env.CREDENTIAL_TYPE || "XRPLCommunityExamCertification";

if (!XRPL_NETWORK || !XRPL_ACCOUNT_ADDRESS || !XRPL_ACCOUNT_SECRET) {
  throw new Error("Required environment variables are not set");
}

/**
 * Credential revocation scenario
 *
 * 1. Display current credentials
 * 2. Confirm revocation with user
 * 3. Revoke the specified credential
 * 4. Display credentials after revocation
 */
async function runRevokeCredentialScenario() {
  // Initialize client
  const client = new Client(XRPL_NETWORK);
  await client.connect();

  try {
    console.log("Connected to XRPL network");

    // Issuer wallet
    if (!XRPL_ACCOUNT_SECRET) {
      throw new Error("Issuer account secret is not set");
    }
    const issuerWallet = Wallet.fromSeed(XRPL_ACCOUNT_SECRET);
    console.log(`Issuer address: ${issuerWallet.address}`);

    // Credential service
    const credentialService = new CredentialService(client, issuerWallet);

    // Step 1: Display current credentials
    console.log("\n1. Displaying current credentials...");
    const credentialsBefore = await credentialService.getCredentials();

    if (credentialsBefore.length === 0) {
      console.log("No credentials to revoke");
      return;
    }

    console.log(`Found ${credentialsBefore.length} credential(s):`);
    for (const cred of credentialsBefore) {
      console.log(`- Type: ${cred.credential}, Subject: ${cred.subject}`);
    }

    // Step 2: Confirm revocation
    console.log("\n2. About to revoke credential...");
    console.log(`Credential Type: ${CREDENTIAL_TYPE}`);
    console.log("This action cannot be undone.");

    const shouldProceed = await getUserConfirmation(
      "Do you want to proceed with credential revocation? (y/n): ",
    );

    if (!shouldProceed) {
      console.log("Credential revocation cancelled");
      return;
    }

    // Step 3: Revoke credential
    console.log("\n3. Revoking credential...");
    const txHash = await credentialService.revokeCredential(CREDENTIAL_TYPE);
    console.log(`Credential revocation successful. Transaction hash: ${txHash}`);

    // Step 4: Display credentials after revocation
    console.log("\n4. Displaying credentials after revocation...");
    const credentialsAfter = await credentialService.getCredentials();

    if (credentialsAfter.length === 0) {
      console.log("No credentials remaining");
    } else {
      console.log(`Remaining ${credentialsAfter.length} credential(s):`);
      for (const cred of credentialsAfter) {
        console.log(`- Type: ${cred.credential}, Subject: ${cred.subject}`);
      }
    }

    console.log("\n✅ Credential revocation completed successfully!");
  } catch (error) {
    console.error("❌ An error occurred:", error);
  } finally {
    await client.disconnect();
  }
}

runRevokeCredentialScenario();
