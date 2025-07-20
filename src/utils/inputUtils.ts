/**
 * User input processing utilities
 */
import readline from "node:readline";

/**
 * Prompt user for confirmation and receive Yes/No response
 * @param question Question text
 * @returns true if Yes, false if No
 */
export function getUserConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}
