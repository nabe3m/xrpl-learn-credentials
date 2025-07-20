/**
 * DepositPreauth processing utility
 * Provides functionality for setting up DepositPreauth based on credentials
 */
import type { Client, Wallet, SubmittableTransaction, TransactionMetadata } from "xrpl";

// DepositPreauth transaction type definition
interface DepositPreauthTransaction {
  TransactionType: "DepositPreauth";
  Account: string;
  AuthorizeCredentials?: Array<{
    Credential: {
      Issuer: string;
      CredentialType: string;
    };
  }>;
  Authorize?: string;
  [key: string]: unknown; // Other properties
}

/**
 * Check and enable DepositAuth setting for an account
 * @param client XRPL client
 * @param wallet Target wallet
 */
export async function checkAndEnableDepositAuth(client: Client, wallet: Wallet): Promise<boolean> {
  // Get account information
  const accountInfo = await client.request({
    command: "account_info",
    account: wallet.address,
  });

  // Check DepositAuth setting (whether the 0x01000000 bit is set)
  const hasDepositAuth = (accountInfo.result.account_data.Flags & 0x01000000) !== 0;

  // If DepositAuth is not enabled, enable it
  if (!hasDepositAuth) {
    // Create AccountSet transaction to enable DepositAuth
    const accountSetTx = {
      TransactionType: "AccountSet",
      Account: wallet.address,
      SetFlag: 9, // 9 is the flag to enable lsfDepositAuth (deposit_auth)
    };

    const preparedAccountSet = await client.autofill(
      accountSetTx as unknown as SubmittableTransaction,
    );
    const signedAccountSet = wallet.sign(preparedAccountSet);
    const resultAccountSet = await client.submitAndWait(signedAccountSet.tx_blob);

    if (
      typeof resultAccountSet.result.meta === "object" &&
      resultAccountSet.result.meta &&
      (resultAccountSet.result.meta as TransactionMetadata).TransactionResult === "tesSUCCESS"
    ) {
      console.log("DepositAuth has been enabled successfully");
      return true;
    }
    throw new Error("Failed to enable DepositAuth");
  }

  return false; // Already enabled
}

/**
 * Set DepositPreauth for an account
 * @param client XRPL client
 * @param wallet Wallet to authorize
 * @param authorizedAddress Address to authorize
 */
export async function setupDepositPreauth(
  client: Client,
  wallet: Wallet,
  authorizedAddress: string,
): Promise<{
  address: string;
  hash: string;
  status: string;
}> {
  // Create DepositPreauth transaction
  const depositPreauthTx: DepositPreauthTransaction = {
    TransactionType: "DepositPreauth",
    Account: wallet.address,
    Authorize: authorizedAddress,
  };

  const preparedTx = await client.autofill(depositPreauthTx);
  const signedTx = wallet.sign(preparedTx);
  const txResult = await client.submitAndWait(signedTx.tx_blob);

  return {
    address: authorizedAddress,
    hash: txResult.result.hash,
    status: txResult.result.meta
      ? (txResult.result.meta as TransactionMetadata).TransactionResult
      : "unknown",
  };
}

/**
 * Get current DepositPreauth settings for an account
 * @param client XRPL client
 * @param address Target address
 */
export async function getDepositPreauthList(client: Client, address: string): Promise<string[]> {
  const depositPreauthList = await client.request({
    command: "account_objects",
    account: address,
    type: "deposit_preauth",
  });

  if (
    depositPreauthList.result.account_objects &&
    depositPreauthList.result.account_objects.length > 0
  ) {
    return depositPreauthList.result.account_objects
      .map((obj: unknown) => {
        const depositObj = obj as { Authorize?: string };
        return depositObj.Authorize;
      })
      .filter((authorize): authorize is string => authorize !== undefined);
  }

  return [];
}

/**
 * Set DepositPreauth based on credential type
 * Authorize only accounts that have credentials of the specified issuer and type
 * @param client XRPL client
 * @param wallet Wallet to authorize (Verity)
 * @param issuerAddress Address of the credential issuer
 * @param credentialType Credential type (in hexadecimal)
 */
export async function setupCredentialTypePreauth(
  client: Client,
  wallet: Wallet,
  issuerAddress: string,
  credentialType: string,
): Promise<{
  hash: string;
  status: string;
}> {
  // Create DepositPreauth transaction (using AuthorizeCredentials)
  const depositPreauthTx: DepositPreauthTransaction = {
    TransactionType: "DepositPreauth",
    Account: wallet.address,
    AuthorizeCredentials: [
      {
        Credential: {
          Issuer: issuerAddress,
          CredentialType: credentialType,
        },
      },
    ],
  };

  // Prepare and submit transaction
  const preparedTx = await client.autofill(depositPreauthTx);
  const signedTx = wallet.sign(preparedTx);
  const txResult = await client.submitAndWait(signedTx.tx_blob);

  return {
    hash: txResult.result.hash,
    status: txResult.result.meta
      ? (txResult.result.meta as TransactionMetadata).TransactionResult
      : "unknown",
  };
}

/**
 * Get DepositPreauth settings by credential type
 * @param client XRPL client
 * @param address Target address
 */
export async function getCredentialTypePreauths(
  client: Client,
  address: string,
): Promise<{ issuer: string; credentialType: string }[]> {
  const depositPreauthList = await client.request({
    command: "account_objects",
    account: address,
    type: "deposit_preauth",
  });

  if (
    depositPreauthList.result.account_objects &&
    depositPreauthList.result.account_objects.length > 0
  ) {
    return depositPreauthList.result.account_objects
      .filter((obj: unknown) => {
        const depositObj = obj as { AuthorizeCredentials?: unknown[] };
        return depositObj.AuthorizeCredentials;
      })
      .flatMap((obj: unknown) => {
        const depositObj = obj as { AuthorizeCredentials: unknown[] };
        const credentials = depositObj.AuthorizeCredentials;
        return credentials.map((cred: unknown) => {
          const credObj = cred as {
            Credential: {
              Issuer: string;
              CredentialType: string;
            };
          };
          return {
            issuer: credObj.Credential.Issuer,
            credentialType: credObj.Credential.CredentialType,
          };
        });
      });
  }

  return [];
}
