import { Client, Wallet, rippleTimeToISOTime, convertHexToString as hexToString } from "xrpl";
import dotenv from "dotenv";

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
 * 2. Show detailed information for each credential
 */
async function runViewCredentialScenario() {
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

    // Step 1: Get all credentials on the ledger
    console.log("\n1. Retrieving all credentials...");

    // Get account objects for the issuer (credentials they issued)
    const issuerRequest = await client.request({
      command: "account_objects",
      account: issuerWallet.address,
      type: "credential",
    });

    const allCredentials: unknown[] = [];

    if (issuerRequest.result.account_objects && issuerRequest.result.account_objects.length > 0) {
      const issuerCredentials = issuerRequest.result.account_objects.filter(
        (obj: unknown) => (obj as { LedgerEntryType?: string }).LedgerEntryType === "Credential",
      );
      allCredentials.push(...issuerCredentials);
    }

    // Note: We primarily rely on account_objects for credential lookup
    // as it provides the most reliable way to get credentials for a specific account

    // Step 2: Display credentials
    if (allCredentials.length > 0) {
      console.log(`\nFound ${allCredentials.length} credential(s):`);
      console.log("=".repeat(60));

      for (let i = 0; i < allCredentials.length; i++) {
        const cred = allCredentials[i] as {
          LedgerIndex?: string;
          Account: string;
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
        console.log(`\nCredential ${i + 1}:`);
        console.log(`- Ledger Index: ${cred.LedgerIndex || "Unknown"}`);
        console.log(`- Account (Issuer): ${cred.Account}`);
        console.log(`- Subject: ${cred.Subject}`);
        console.log(`- Credential Type: ${hexToString(cred.CredentialType)}`);
        console.log(`- Accepted: ${(cred.Flags & 0x00010000) !== 0 ? "Yes" : "No"}`);

        if (cred.Expiration) {
          const expiration = rippleTimeToISOTime(cred.Expiration);
          console.log(`- Expiration: ${expiration}`);
        } else {
          console.log("- Expiration: No expiration set");
        }

        if (cred.URI) {
          console.log(`- URI: ${hexToString(cred.URI)}`);
        }

        // Display memo information
        if (cred.Memos && cred.Memos.length > 0) {
          console.log("- Memo Information:");
          const memo = cred.Memos[0].Memo;

          if (memo.MemoType) {
            console.log(`  Type: ${hexToString(memo.MemoType)}`);
          }
          if (memo.MemoFormat) {
            console.log(`  Format: ${hexToString(memo.MemoFormat)}`);
          }
          if (memo.MemoData) {
            try {
              const memoData = JSON.parse(hexToString(memo.MemoData));
              console.log("  Data:");
              Object.entries(memoData).forEach(([key, value]) => {
                console.log(`    ${key}: ${value}`);
              });
            } catch (_e) {
              console.log(`  Data: ${hexToString(memo.MemoData)}`);
            }
          }
        }

        console.log("-".repeat(40));
      }
    } else {
      console.log("No credentials found");
    }

    console.log("\n✅ Credential viewing completed successfully!");
  } catch (error) {
    console.error("Error occurred:", error);
    throw error;
  } finally {
    await client.disconnect();
    console.log("Disconnected from XRPL network");
  }
}

// Execute the scenario
runViewCredentialScenario().catch(console.error);
