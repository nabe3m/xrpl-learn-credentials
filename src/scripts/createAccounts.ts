import * as fs from "node:fs";
import * as path from "node:path";
import { Client, type Wallet, dropsToXrp } from "xrpl";

const TESTNET_URL = "wss://s.devnet.rippletest.net:51233/";

async function main() {
  console.log("Creating XRPL Devnet accounts...");

  // Initialize client
  const client = new Client(TESTNET_URL);
  await client.connect();

  try {
    // 1. Create issuer wallet
    console.log("\n1. Creating issuer account...");
    const issuerWallet = await generateFundedWallet(client);

    // Display wallet information
    console.log("Issuer account created:");
    console.log(`Address: ${issuerWallet.address}`);
    console.log(`Secret: ${issuerWallet.seed}`);

    // Check balance
    const issuerBalance = await client.getXrpBalance(issuerWallet.address);
    console.log(`Balance: ${issuerBalance} XRP`);

    // 2. Create Alice's wallet
    console.log("\n2. Creating Alice account...");
    const aliceWallet = await generateFundedWallet(client);

    // Display wallet information
    console.log("Alice account created:");
    console.log(`Address: ${aliceWallet.address}`);
    console.log(`Secret: ${aliceWallet.seed}`);

    // Check balance
    const aliceBalance = await client.getXrpBalance(aliceWallet.address);
    console.log(`Balance: ${aliceBalance} XRP`);

    // 3. Create Verity third-party verifier account
    console.log("\n3. Creating Verity (third-party verifier) account...");
    const verityWallet = await generateFundedWallet(client);

    // Display wallet information
    console.log("Verity account created:");
    console.log(`Address: ${verityWallet.address}`);
    console.log(`Secret: ${verityWallet.seed}`);

    // Check balance
    const verityBalance = await client.getXrpBalance(verityWallet.address);
    console.log(`Balance: ${verityBalance} XRP`);

    // 4. Create Bob's account
    console.log("\n4. Creating Bob account...");
    const bobWallet = await generateFundedWallet(client);

    // Display wallet information
    console.log("Bob account created:");
    console.log(`Address: ${bobWallet.address}`);
    console.log(`Secret: ${bobWallet.seed}`);

    // Check balance
    const bobBalance = await client.getXrpBalance(bobWallet.address);
    console.log(`Balance: ${bobBalance} XRP`);

    // Update .env file
    if (issuerWallet.seed && aliceWallet.seed && verityWallet.seed && bobWallet.seed) {
      updateEnvFile(
        issuerWallet.address,
        issuerWallet.seed,
        aliceWallet.address,
        aliceWallet.seed,
        verityWallet.address,
        verityWallet.seed,
        bobWallet.address,
        bobWallet.seed,
      );
      console.log("\n.env file has been updated.");
      console.log("All account information has been saved.");
    } else {
      console.error("Failed to retrieve secrets. .env file has not been updated.");
    }
  } catch (error) {
    console.error("An error occurred:", error);
  } finally {
    await client.disconnect();
  }
}

async function generateFundedWallet(client: Client): Promise<Wallet> {
  const { wallet, balance } = await client.fundWallet();
  console.log(`Funded amount from faucet: ${dropsToXrp(balance)} XRP`);
  return wallet;
}

function updateEnvFile(
  issuerAddress: string,
  issuerSecret: string,
  aliceAddress: string,
  aliceSeed: string,
  verityAddress: string,
  veritySeed: string,
  bobAddress: string,
  bobSeed: string,
) {
  const envPath = path.resolve(process.cwd(), ".env");

  // Read existing .env file if it exists (for reference)
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, "utf8");
  }

  // Create new env content
  const updatedContent = `# XRPL Account Information (Issuer)
XRPL_ACCOUNT_ADDRESS="${issuerAddress}"
XRPL_ACCOUNT_SECRET="${issuerSecret}"

# XRPL Network Settings (Default: Devnet)
XRPL_NETWORK="wss://s.devnet.rippletest.net:51233/"

# Alice Information (Account receiving credentials)
ALICE_ADDRESS="${aliceAddress}"
ALICE_SEED="${aliceSeed}"

# Verity Information (Third-party verifier)
VERITY_ADDRESS="${verityAddress}"
VERITY_SEED="${veritySeed}"

# Bob Information (Additional account)
BOB_ADDRESS="${bobAddress}"
BOB_SEED="${bobSeed}"

# Credential Information
CREDENTIAL_TYPE="XRPLCommunityExamCertification"

# Credential ID (Issued transaction ID - for reference)
CREDENTIAL_ID=""`;

  // Write to .env file
  fs.writeFileSync(envPath, updatedContent, "utf8");
}

main();
