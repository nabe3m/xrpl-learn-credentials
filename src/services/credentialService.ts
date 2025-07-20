import type { Client, Wallet, SubmittableTransaction, TransactionMetadata } from "xrpl";
import {
  rippleTimeToISOTime,
  isoTimeToRippleTime,
  convertStringToHex as stringToHex,
  convertHexToString as hexToString,
} from "xrpl";
import type { CredentialRequest, CredentialResponse } from "../types/credential";
import type { CredentialTransaction, CredentialRevokeTransaction } from "../types/xrpl-extensions";

export class CredentialService {
  private client: Client;
  private wallet: Wallet;

  constructor(client: Client, wallet: Wallet) {
    this.client = client;
    this.wallet = wallet;
  }

  // Issue credential
  async issueCredential(request: CredentialRequest): Promise<string> {
    try {
      // Prepare transaction
      const tx: CredentialTransaction = {
        TransactionType: "CredentialCreate",
        Account: this.wallet.address,
        Subject: request.subject,
        CredentialType: stringToHex(request.credential),
        ...(request.expiration && {
          Expiration: isoTimeToRippleTime(request.expiration),
        }),
        ...(request.uri && { URI: stringToHex(request.uri) }),
      };

      // Add memo (optional)
      if (request.memo) {
        const memos = [
          {
            Memo: {
              MemoData: stringToHex(request.memo.data),
              ...(request.memo.type && {
                MemoType: stringToHex(request.memo.type),
              }),
              ...(request.memo.format && {
                MemoFormat: stringToHex(request.memo.format),
              }),
            },
          },
        ];
        tx.Memos = memos;
      }

      // Send transaction
      const prepared = await this.client.autofill(tx as unknown as SubmittableTransaction);
      const signed = this.wallet.sign(prepared);
      const result = await this.client.submitAndWait(signed.tx_blob);

      if (typeof result.result.meta === "object" && result.result.meta) {
        // Get TransactionResult safely
        const meta = result.result.meta as TransactionMetadata;
        const txResult = meta.TransactionResult;
        if (txResult === "tesSUCCESS") {
          // Extract Credential LedgerIndex from meta
          if (meta.AffectedNodes && Array.isArray(meta.AffectedNodes)) {
            // Find the node with LedgerEntryType "Credential"
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
                // Return the actual Credential ID (LedgerIndex)
                console.log(`Issued Credential ID: ${nodeWithCreated.CreatedNode.LedgerIndex}`);

                return nodeWithCreated.CreatedNode.LedgerIndex;
              }
            }
          }
          console.log("Credential issued successfully");
        }
        throw new Error(`Failed to issue credential: ${txResult || "Unknown error"}`);
      }
      throw new Error("Transaction result is unknown");
    } catch (error) {
      console.error("Credential issuance error:", error);
      throw error;
    }
  }

  // Get credentials
  async getCredentials(subject?: string): Promise<CredentialResponse[]> {
    try {
      // Since account_credentials API is not available,
      // use account_objects API to retrieve Credential objects
      const request = {
        command: "account_objects" as const,
        account: this.wallet.address,
        type: "credential" as const, // Only retrieve Credential objects
      };

      const response = await this.client.request(request);
      const result = response.result as { account_objects?: unknown[] };

      if (!result.account_objects || !Array.isArray(result.account_objects)) {
        return [];
      }

      // Filter Credentials related to a specific subject
      const credentials = subject
        ? result.account_objects.filter((obj: unknown) => {
            const credObj = obj as { Subject?: string };
            return credObj.Subject === subject;
          })
        : result.account_objects;

      return credentials.map((cred: unknown) => {
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
        const response: CredentialResponse = {
          subject: credObj.Subject,
          credential: hexToString(credObj.CredentialType),
          accepted: (credObj.Flags & 0x00010000) !== 0,
          ...(credObj.Expiration && {
            expiration: rippleTimeToISOTime(credObj.Expiration),
          }),
          ...(credObj.URI && { uri: hexToString(credObj.URI) }),
        };

        // Get memo information
        if (credObj.Memos && credObj.Memos.length > 0 && credObj.Memos[0].Memo) {
          const memo = credObj.Memos[0].Memo;
          response.memo = {
            data: hexToString(memo.MemoData || ""),
            ...(memo.MemoType && { type: hexToString(memo.MemoType) }),
            ...(memo.MemoFormat && {
              format: hexToString(memo.MemoFormat),
            }),
          };
        }

        return response;
      });
    } catch (error) {
      console.error("Credential retrieval error:", error);
      throw error;
    }
  }

  // Revoke credential
  async revokeCredential(
    credentialType: string,
    subject?: string,
    issuer?: string,
  ): Promise<string> {
    try {
      // Validate required parameters
      if (!credentialType) {
        throw new Error("Credential type not specified");
      }

      // At least one of Subject or Issuer must be specified
      if (!subject && !issuer) {
        // Find the target Credential
        console.log("Searching for Credential to revoke...");
        const credentials = await this.getCredentials();

        if (credentials.length > 0) {
          // Find the Credential matching the specified credential type
          const matchedCredential = credentials.find((cred) => cred.credential === credentialType);

          if (matchedCredential) {
            const foundSubject = matchedCredential.subject;
            console.log(`Found Credential: Type=${credentialType}, Subject=${foundSubject}`);

            // Prepare transaction
            const tx: CredentialRevokeTransaction = {
              TransactionType: "CredentialDelete",
              Account: this.wallet.address,
              CredentialType: stringToHex(credentialType),
              Subject: foundSubject,
            };

            // Send transaction
            const prepared = await this.client.autofill(tx as unknown as SubmittableTransaction);
            const signed = this.wallet.sign(prepared);
            const result = await this.client.submitAndWait(signed.tx_blob);

            if (typeof result.result.meta === "object" && result.result.meta) {
              const meta = result.result.meta as TransactionMetadata;
              const txResult = meta.TransactionResult;
              if (txResult === "tesSUCCESS") {
                return result.result.hash;
              }
              throw new Error(`Failed to revoke credential: ${txResult || "Unknown error"}`);
            }
            throw new Error("Transaction result is unknown");
          }
          throw new Error(`Credential of type ${credentialType} not found`);
        }
        throw new Error("Credential to revoke not found");
      }

      // Prepare transaction
      const tx: CredentialRevokeTransaction = {
        TransactionType: "CredentialDelete",
        Account: this.wallet.address,
        CredentialType: stringToHex(credentialType),
      };

      // At least one of Subject or Issuer is required
      if (subject) {
        tx.Subject = subject;
      } else if (issuer) {
        tx.Issuer = issuer;
      } else {
        throw new Error("Either Subject or Issuer is required for credential revocation");
      }

      console.log("Sending transaction:", JSON.stringify(tx, null, 2));

      const prepared = await this.client.autofill(tx as unknown as SubmittableTransaction);
      const signed = this.wallet.sign(prepared);
      const result = await this.client.submitAndWait(signed.tx_blob);

      if (typeof result.result.meta === "object" && result.result.meta) {
        const meta = result.result.meta as TransactionMetadata;
        const txResult = meta.TransactionResult;
        if (txResult === "tesSUCCESS") {
          return result.result.hash;
        }
        throw new Error(`Failed to revoke credential: ${txResult || "Unknown error"}`);
      }
      throw new Error("Transaction result is unknown");
    } catch (error) {
      console.error("Credential revocation error:", error);
      throw error;
    }
  }
}
