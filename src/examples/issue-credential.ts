import {
  Client,
  Wallet,
  type SubmittableTransaction,
  type Transaction,
  type TransactionMetadata,
  isoTimeToRippleTime,
  convertStringToHex as stringToHex,
  convertHexToString as hexToString,
} from "xrpl";
import dotenv from "dotenv";
import * as fs from "node:fs";
import * as path from "node:path";

// CredentialCreate transaction type definition
interface CredentialCreateTransaction extends Omit<Transaction, "TransactionType"> {
  TransactionType: "CredentialCreate";
  Account: string;
  Subject: string;
  CredentialType: string;
  Expiration?: number;
  URI?: string;
  Memos?: Array<{
    Memo: {
      MemoData?: string;
      MemoType?: string;
      MemoFormat?: string;
    };
  }>;
}

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
 * 2. Save the Credential ID to environment variables
 */
async function runIssueCredentialScenario() {
  const client = new Client(XRPL_NETWORK);

  try {
    console.log("Connected to XRPL network");
    await client.connect();

    // Create wallets
    if (!XRPL_ACCOUNT_SECRET) {
      throw new Error("Issuer secret is not set");
    }
    const issuerWallet = Wallet.fromSeed(XRPL_ACCOUNT_SECRET);

    if (!ALICE_SEED) {
      throw new Error("Alice seed is not set");
    }
    const aliceWallet = Wallet.fromSeed(ALICE_SEED);

    console.log(`Issuer address: ${issuerWallet.address}`);
    console.log(`Alice address: ${aliceWallet.address}`);

    // Step 1: Issue XRPL Community Exam certification
    console.log("\n1. Issuing XRPL Community Exam certification...");

    const expirationDate = new Date();
    expirationDate.setFullYear(expirationDate.getFullYear() + 1); // Valid for 1 year

    // Prepare CredentialCreate transaction
    const tx: CredentialCreateTransaction = {
      TransactionType: "CredentialCreate",
      Account: issuerWallet.address,
      Subject: aliceWallet.address,
      CredentialType: stringToHex("XRPLCommunityExamCertification"),
      Expiration: isoTimeToRippleTime(expirationDate.toISOString()),
      URI: stringToHex("https://example.com/xrpl-certification"),
    };

    // Add memo
    const memos = [
      {
        Memo: {
          MemoData: stringToHex(
            JSON.stringify({
              certificateId: "XRPL-2025-001",
              examDate: new Date().toISOString().split("T")[0],
              score: "95/100",
              issuer: "XRPL Community",
              level: "Advanced",
            }),
          ),
          MemoType: stringToHex("Certification"),
          MemoFormat: stringToHex("text/plain"),
        },
      },
    ];
    tx.Memos = memos;

    // Send transaction
    console.log("Preparing and sending CredentialCreate transaction...");
    const prepared = await client.autofill(tx as unknown as SubmittableTransaction);
    const signed = issuerWallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    // Check the result
    if (result.result.meta && typeof result.result.meta === "object") {
      const meta = result.result.meta as TransactionMetadata;
      if (meta.TransactionResult === "tesSUCCESS") {
        console.log("✅ Credential issuance successful!");
        console.log(`Transaction hash: ${result.result.hash}`);

        // Find the Credential ID
        let credentialId: string | undefined;
        if (meta.AffectedNodes && Array.isArray(meta.AffectedNodes)) {
          const credentialNode = meta.AffectedNodes.find((node) => {
            const nodeWithCreated = node as {
              CreatedNode?: { LedgerEntryType?: string; LedgerIndex?: string };
            };
            return (
              nodeWithCreated.CreatedNode &&
              nodeWithCreated.CreatedNode.LedgerEntryType === "Credential"
            );
          });

          if (credentialNode) {
            const nodeWithCreated = credentialNode as {
              CreatedNode?: { LedgerEntryType?: string; LedgerIndex?: string };
            };
            if (nodeWithCreated.CreatedNode?.LedgerIndex) {
              credentialId = nodeWithCreated.CreatedNode.LedgerIndex;
              console.log(`Issued Credential ID: ${credentialId}`);
            }
          }
        }

        // Save credential ID to .env file
        if (credentialId) {
          console.log("\n2. Saving Credential ID to .env file...");
          const envPath = path.join(process.cwd(), ".env");
          let envContent = fs.readFileSync(envPath, "utf-8");

          // Update or add CREDENTIAL_ID
          if (envContent.includes("CREDENTIAL_ID=")) {
            envContent = envContent.replace(/CREDENTIAL_ID=.*/, `CREDENTIAL_ID=${credentialId}`);
          } else {
            envContent += `\nCREDENTIAL_ID=${credentialId}`;
          }

          fs.writeFileSync(envPath, envContent);
          console.log(`✅ Credential ID saved to .env: ${credentialId}`);
        }

        // Step 3: Verify issued credential
        console.log("\n3. Verifying issued credential...");
        const ledgerRequest = await client.request({
          command: "account_objects",
          account: aliceWallet.address,
          type: "credential",
        });

        if (
          ledgerRequest.result.account_objects &&
          ledgerRequest.result.account_objects.length > 0
        ) {
          const credentials = ledgerRequest.result.account_objects.filter(
            (obj: unknown) =>
              (obj as { LedgerEntryType?: string }).LedgerEntryType === "Credential",
          );

          console.log(`Found ${credentials.length} credential(s) for Alice:`);
          for (const cred of credentials) {
            const credObj = cred as {
              Subject: string;
              CredentialType: string;
              Flags: number;
              Expiration?: number;
              URI?: string;
              Memos?: Array<{
                Memo: {
                  MemoData?: string;
                  MemoType?: string;
                  MemoFormat?: string;
                };
              }>;
            };
            console.log(`- Subject: ${credObj.Subject}`);
            console.log(`- Credential Type: ${hexToString(credObj.CredentialType)}`);
            console.log(`- Accepted: ${(credObj.Flags & 0x00010000) !== 0 ? "Yes" : "No"}`);
            if (credObj.Expiration) {
              const expiration = new Date((credObj.Expiration + 946684800) * 1000);
              console.log(`- Expiration: ${expiration.toISOString()}`);
            }
            if (credObj.URI) {
              console.log(`- URI: ${hexToString(credObj.URI)}`);
            }

            // Display memo information
            if (credObj.Memos && credObj.Memos.length > 0) {
              const memo = credObj.Memos[0].Memo;
              console.log("- Memo:");
              if (memo.MemoData) {
                const memoData = JSON.parse(hexToString(memo.MemoData));
                console.log(`  Certificate ID: ${memoData.certificateId}`);
                console.log(`  Exam Date: ${memoData.examDate}`);
                console.log(`  Score: ${memoData.score}`);
                console.log(`  Level: ${memoData.level}`);
              }
            }
            console.log("");
          }
        }
      } else {
        const errorCode = meta.TransactionResult || "Unknown error";
        throw new Error(`Transaction failed: ${errorCode}`);
      }
    } else {
      throw new Error("Transaction result is unknown");
    }
  } catch (error) {
    console.error("Error occurred:", error);
    throw error;
  } finally {
    await client.disconnect();
    console.log("Disconnected from XRPL network");
  }
}

// Execute the scenario
runIssueCredentialScenario().catch(console.error);
