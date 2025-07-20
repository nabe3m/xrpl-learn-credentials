import {
  Client,
  Wallet,
  type SubmittableTransaction,
  type Transaction,
  type TransactionMetadata,
  rippleTimeToISOTime,
  convertStringToHex as stringToHex,
  convertHexToString as hexToString,
} from "xrpl";
import dotenv from "dotenv";
import { getUserConfirmation } from "../utils/inputUtils";

// CredentialDelete transaction type definition
interface CredentialDeleteTransaction extends Omit<Transaction, "TransactionType"> {
  TransactionType: "CredentialDelete";
  Account: string;
  Subject: string;
  CredentialType: string;
}

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
 * 1. Display currently issued credentials
 * 2. Revoke a specific credential
 * 3. Display credentials after revocation
 */
async function runRevokeCredentialScenario() {
  const client = new Client(XRPL_NETWORK);

  try {
    console.log("Connected to XRPL network");
    await client.connect();

    // Create issuer wallet
    if (!XRPL_ACCOUNT_SECRET) {
      throw new Error("Issuer secret is not set");
    }
    const issuerWallet = Wallet.fromSeed(XRPL_ACCOUNT_SECRET);
    console.log(`Issuer address: ${issuerWallet.address}`);

    // Step 1: Display current credentials
    console.log("\n1. Displaying current credentials...");
    const credentialsBefore = await getCredentials(client, issuerWallet.address);

    if (credentialsBefore.length === 0) {
      console.log("No credentials found to revoke");
      return;
    }

    console.log(`Found ${credentialsBefore.length} credential(s):`);
    for (let i = 0; i < credentialsBefore.length; i++) {
      const cred = credentialsBefore[i];
      console.log(`${i + 1}. Type: ${cred.credentialType}, Subject: ${cred.subject}`);
    }

    // Step 2: Confirm revocation
    console.log("\n2. About to revoke credential...");
    console.log(`Credential Type: ${CREDENTIAL_TYPE}`);
    console.log("This action cannot be undone.");

    const confirmed = await getUserConfirmation("Do you want to continue with revocation? (y/N): ");
    if (!confirmed) {
      console.log("Revocation cancelled");
      return;
    }

    // Find the credential to revoke
    const targetCredential = credentialsBefore.find(
      (cred) => cred.credentialType === CREDENTIAL_TYPE,
    );
    if (!targetCredential) {
      console.log(`Credential with type "${CREDENTIAL_TYPE}" not found`);
      return;
    }

    // Step 3: Execute revocation
    console.log("\n3. Executing credential revocation...");

    const tx: CredentialDeleteTransaction = {
      TransactionType: "CredentialDelete",
      Account: issuerWallet.address,
      Subject: targetCredential.subject,
      CredentialType: stringToHex(CREDENTIAL_TYPE),
    };

    // Send transaction
    console.log("Preparing and sending CredentialDelete transaction...");
    const prepared = await client.autofill(tx as unknown as SubmittableTransaction);
    const signed = issuerWallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    // Check the result
    if (result.result.meta && typeof result.result.meta === "object") {
      const meta = result.result.meta as TransactionMetadata;
      if (meta.TransactionResult === "tesSUCCESS") {
        console.log("✅ Credential revocation successful!");
        console.log(`Transaction hash: ${result.result.hash}`);
      } else {
        const errorCode = meta.TransactionResult || "Unknown error";
        throw new Error(`Transaction failed: ${errorCode}`);
      }
    } else {
      throw new Error("Transaction result is unknown");
    }

    // Step 4: Display credentials after revocation
    console.log("\n4. Displaying credentials after revocation...");
    const credentialsAfter = await getCredentials(client, issuerWallet.address);

    if (credentialsAfter.length === 0) {
      console.log("No credentials remain");
    } else {
      console.log(`Found ${credentialsAfter.length} credential(s):`);
      for (let i = 0; i < credentialsAfter.length; i++) {
        const cred = credentialsAfter[i];
        console.log(`${i + 1}. Type: ${cred.credentialType}, Subject: ${cred.subject}`);
      }
    }

    console.log("\n✅ Credential revocation scenario completed successfully!");
  } catch (error) {
    console.error("Error occurred:", error);
    throw error;
  } finally {
    await client.disconnect();
    console.log("Disconnected from XRPL network");
  }
}

/**
 * Get credentials from the ledger
 */
async function getCredentials(client: Client, accountAddress: string) {
  const request = await client.request({
    command: "account_objects",
    account: accountAddress,
    type: "credential",
  });

  const credentials: Array<{
    subject: string;
    credentialType: string;
    accepted: boolean;
    expiration?: string;
    uri?: string;
  }> = [];

  if (request.result.account_objects && request.result.account_objects.length > 0) {
    const credObjs = request.result.account_objects.filter(
      (obj: unknown) => (obj as { LedgerEntryType?: string }).LedgerEntryType === "Credential",
    );

    for (const credObj of credObjs) {
      const cred = credObj as {
        Subject: string;
        CredentialType: string;
        Flags: number;
        Expiration?: number;
        URI?: string;
      };
      credentials.push({
        subject: cred.Subject,
        credentialType: hexToString(cred.CredentialType),
        accepted: (cred.Flags & 0x00010000) !== 0,
        ...(cred.Expiration && {
          expiration: rippleTimeToISOTime(cred.Expiration),
        }),
        ...(cred.URI && { uri: hexToString(cred.URI) }),
      });
    }
  }

  return credentials;
}

// Execute the scenario
runRevokeCredentialScenario().catch(console.error);
