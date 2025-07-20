# XRPL Credentials Sample

This project provides a sample implementation for testing XRPL Credentials functionality on the Devnet environment.

The Credentials feature enables issuing and managing certificates and credentials on the blockchain within XRPL.

## Setup

1. Clone the repository and navigate to the directory:
```bash
git clone https://github.com/nabe3m/xrpl-learn-credentials.git
cd xrpl-learn-credentials
```

2. Install dependencies:
```bash
npm i
```

## Execution Flow

This project consists of 7 main scripts and should be executed in the following order:

### 1. Create Accounts (createAccounts.ts)

Creates 4 XRPL accounts on Devnet and automatically updates the `.env` file:

```bash
npm run create-accounts
```

Results:
- Issuer account: Issues credentials
- Alice: Receives credentials
- Verity: Third-party verifier (uses DepositAuth)
- Bob: Sample account without credentials
- Automatically funds each account with XRP from Devnet faucet
- Creates new `.env` file and saves all account information

### 2. Issue Credential (issue-credential.ts)

Issues a credential from the issuer account to Alice:

```bash
npm run issue-credential
```

Results:
- Issues "XRPLCommunityExamCertification" credential from issuer to Alice
- Sets metadata including expiration date, certificate ID, and detailed information
- Displays credential ledger entry ID and automatically saves to CREDENTIAL_ID variable in `.env` file
- Shows information about the issued credential

### 3. Accept Credential (accept-credential.ts)

Alice accepts the issued credential:

```bash
npm run accept-credential
```

Results:
- Alice's wallet executes CredentialAccept transaction
- Specifies issuer and credential type to formally activate the credential
- Displays transaction hash
- Credential is formally activated and becomes available for future payments

### 4. Credential Pre-authorization Setup (credential-preauth.ts)

Configures Verity account to accept payments only from accounts with specific credentials:

```bash
npm run credential-preauth
```

Results:
- Enables "DepositAuth" flag on Verity account
- Configures to accept payments only from accounts with specific credential type (XRPLCommunityExamCertification)
- Sets up authorization using AuthorizeCredentials
- Displays current configuration status

### 5. Credential Payment Test - To Verity (transfer-to-verity.ts)

Tests payments to Verity from Alice (with credentials) and Bob (without credentials):

```bash
npm run transfer-to-verity
```

Results:
- Alice's payment with credential ID executes successfully
- Bob's regular payment is rejected (tecNO_PERMISSION)
- Displays transaction results, transaction hashes, and fees for each
- Shows payment test results summary

### 6. Credential Payment Test - To Issuer (transfer-to-issuer.ts)

Tests payments to the issuer from Alice (with credentials) and Bob (without credentials):

```bash
npm run transfer-to-issuer
```

Payments to the issuer have no special restrictions. All payments will succeed.

Results:
- Alice's payment with credential ID executes
- Bob's regular payment also executes
- Displays transaction results, transaction hashes, and fees for each

### 7. Revoke Credential (revoke-credential.ts, Optional)

Revokes issued credentials:

```bash
npm run revoke-credential
```

Results:
- Displays current credential list
- Shows credential type and recipient to be revoked
- Shows confirmation prompt; enter `y` to execute revocation
- Displays credential list after revocation and confirms target credential was deleted

## Additional Commands

View credential details:
```bash
npm run view-credential
```

## Development Commands

Code formatting:
```bash
npm run format
```

Run linter:
```bash
npm run lint
```

## Important Notes

- This project is designed for Devnet environment
- Credentials functionality is currently available only on Devnet (as of July 2025)
- Only credential issuers can revoke credentials
- Implement appropriate security measures when using in production environment

## Implementation Details

- **Credential ID**: Ledger entry index value; include in CredentialIDs field during payments to prove credential ownership
- **DepositAuth**: Feature to accept payments only from accounts meeting specific conditions
- **AuthorizeCredentials**: Feature to allow payments only from accounts with specific credential types

## About XRPL and Devnet Environment

- Devnet is an environment for developers to safely test new XRPL features
- Test XRP can be obtained for free from the Devnet faucet
- Transaction details can be viewed on Devnet Explorer: https://devnet.xrpl.org
- Current network configuration: `wss://s.devnet.rippletest.net:51233/`

## Troubleshooting

- **`temDISABLED` error**: Occurs when connecting to a network where the Credentials amendment is not enabled
- Connection errors: Check Devnet status
- Transaction failures after account creation: Verify sufficient balance
- Transaction failures: Confirm secret keys are correct
- Payment rejections: Verify correct credential ID is being used
