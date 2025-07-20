import { Client, Wallet } from "xrpl";
import dotenv from "dotenv";
import { CredentialService } from "../services/credentialService";

// Load environment variables
dotenv.config();

// Environment variable definitions
const XRPL_NETWORK = process.env.XRPL_NETWORK || "wss://s.devnet.rippletest.net:51233/";
const XRPL_ACCOUNT_ADDRESS = process.env.XRPL_ACCOUNT_ADDRESS;
const XRPL_ACCOUNT_SECRET = process.env.XRPL_ACCOUNT_SECRET;

if (!XRPL_NETWORK || !XRPL_ACCOUNT_ADDRESS || !XRPL_ACCOUNT_SECRET) {
  throw new Error("Required environment variables are not set");
}

/**
 * Credential viewing scenario
 *
 * 1. Display credentials issued by the issuer
 * 2. Display detailed information for each credential
 */
async function runViewCredentialScenario() {
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

    // Step 1: View all issued credentials
    console.log("\n1. Viewing all issued credentials...");
    const credentials = await credentialService.getCredentials();

    if (credentials.length > 0) {
      console.log(`Found ${credentials.length} credential(s):`);

      for (let i = 0; i < credentials.length; i++) {
        const cred = credentials[i];
        console.log(`\n--- Credential ${i + 1} ---`);
        console.log(`Credential Type: ${cred.credential}`);
        console.log(`Subject: ${cred.subject}`);
        console.log(`Expiration: ${cred.expiration || "None"}`);
        console.log(`URI: ${cred.uri || "None"}`);

        if (cred.memo) {
          console.log("Memo Information:");
          console.log(`  Type: ${cred.memo.type || "Not specified"}`);
          console.log(`  Format: ${cred.memo.format || "Not specified"}`);
          if (cred.memo.data) {
            try {
              const parsedData = JSON.parse(cred.memo.data);
              console.log("  Data:", JSON.stringify(parsedData, null, 4));
            } catch {
              console.log(`  Data: ${cred.memo.data}`);
            }
          }
        }
      }
    } else {
      console.log("No credentials found");
    }

    console.log("\n✅ Credential viewing completed successfully!");
  } catch (error) {
    console.error("❌ An error occurred:", error);
  } finally {
    await client.disconnect();
  }
}

runViewCredentialScenario();
