import { Client, Wallet } from "xrpl";
import dotenv from "dotenv";
import { CredentialService } from "../services/credentialService";
import * as fs from "node:fs";
import * as path from "node:path";

// Load environment variables
dotenv.config();

// Environment variable definitions
const XRPL_NETWORK = process.env.XRPL_NETWORK || "wss://s.devnet.rippletest.net:51233/";
const XRPL_ACCOUNT_ADDRESS = process.env.XRPL_ACCOUNT_ADDRESS;
const XRPL_ACCOUNT_SECRET = process.env.XRPL_ACCOUNT_SECRET;
const ALICE_ADDRESS = process.env.ALICE_ADDRESS;
const ALICE_SEED = process.env.ALICE_SEED;

if (!XRPL_NETWORK || !XRPL_ACCOUNT_ADDRESS || !XRPL_ACCOUNT_SECRET) {
  throw new Error("Required environment variables are not set");
}

if (!ALICE_ADDRESS || !ALICE_SEED) {
  throw new Error(
    "Alice's environment variables are not set. Please set ALICE_ADDRESS and ALICE_SEED",
  );
}

/**
 * XRPL Community Exam Scenario
 *
 * 1. Certification authority issues XRPL Community Exam as a Credential
 * 2. Alice receives the credential
 * 3. Display Alice's credential information
 */
async function runXRPLCommunityExamScenario() {
  // Initialize client
  const client = new Client(XRPL_NETWORK);
  await client.connect();

  try {
    console.log("Connected to XRPL network");

    // Certification authority wallet (issuer)
    if (!XRPL_ACCOUNT_SECRET) {
      throw new Error("Issuer account secret is not set");
    }

    const issuerWallet = Wallet.fromSeed(XRPL_ACCOUNT_SECRET);
    console.log(`Certification authority address: ${issuerWallet.address}`);

    // Alice's wallet
    if (!ALICE_SEED) {
      throw new Error("Alice's seed is not set");
    }
    const aliceWallet = Wallet.fromSeed(ALICE_SEED);
    console.log(`Alice's address: ${aliceWallet.address}`);

    // Credential service
    const credentialService = new CredentialService(client, issuerWallet);

    // Step 1: Issue XRPL Community Exam certification
    console.log("\n1. Issuing XRPL Community Exam certification...");

    const expirationDate = new Date();
    expirationDate.setFullYear(expirationDate.getFullYear() + 1); // Valid for 1 year

    const credentialRequest = {
      subject: aliceWallet.address,
      credential: "XRPLCommunityExamCertification",
      expiration: expirationDate.toISOString(),
      uri: "https://example.com/xrpl-certification",
      memo: {
        type: "Certification",
        format: "text/plain",
        data: JSON.stringify({
          examId: "XRPL-EXAM-2024-001",
          score: 95,
          passingScore: 80,
          examDate: new Date().toISOString(),
          institution: "XRPL Community",
          certificateLevel: "Advanced",
        }),
      },
    };

    const credentialId = await credentialService.issueCredential(credentialRequest);
    console.log(`Credential issued: ${credentialId}`);

    // Update .env file with Credential ID
    updateEnvWithCredentialId(credentialId);

    // Step 2: Display Alice's credential information
    console.log("\n2. Displaying Alice's credential information...");
    const credentials = await credentialService.getCredentials(aliceWallet.address);

    if (credentials.length > 0) {
      console.log("Credentials found:");
      for (const cred of credentials) {
        console.log(`- Credential Type: ${cred.credential}`);
        console.log(`  Subject: ${cred.subject}`);
        console.log(`  Expiration: ${cred.expiration || "None"}`);
        console.log(`  URI: ${cred.uri || "None"}`);
        if (cred.memo) {
          console.log(`  Memo: ${JSON.stringify(cred.memo, null, 2)}`);
        }
      }
    } else {
      console.log("No credentials found for Alice");
    }

    console.log("\n✅ XRPL Community Exam certification scenario completed successfully!");
  } catch (error) {
    console.error("An error occurred:", error);
  } finally {
    await client.disconnect();
  }
}

/**
 * Update .env file with Credential ID
 */
function updateEnvWithCredentialId(credentialId: string) {
  try {
    const envPath = path.resolve(process.cwd(), ".env");

    if (fs.existsSync(envPath)) {
      let content = fs.readFileSync(envPath, "utf8");

      // Update CREDENTIAL_ID value
      const regex = /^CREDENTIAL_ID=.*$/m;
      if (regex.test(content)) {
        content = content.replace(regex, `CREDENTIAL_ID="${credentialId}"`);
      } else {
        // Add CREDENTIAL_ID if it doesn't exist
        content += `\nCREDENTIAL_ID="${credentialId}"`;
      }

      fs.writeFileSync(envPath, content, "utf8");
      console.log(`Credential ID saved to .env file: ${credentialId}`);
    } else {
      console.warn(".env file not found, could not save Credential ID");
    }
  } catch (error) {
    console.error("Error updating .env file:", error);
  }
}

runXRPLCommunityExamScenario();
