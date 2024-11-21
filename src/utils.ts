import { exec } from 'child_process';
import { promisify } from 'util';
import which from 'which';

export const execAsync = promisify(exec);

// Check if a command is available in the system
export async function isCommandAvailable(command: string): Promise<boolean> {
  try {
    await which(command);
    return true;
  } catch {
    return false;
  }
}

// Detect installed package manager
export async function detectPackageManager(): Promise<string> {
  const packageManagers = ['pnpm', 'yarn', 'npm'];
  for (const pm of packageManagers) {
    if (await isCommandAvailable(pm)) {
      return pm;
    }
  }
  return 'npm'; // Fallback to npm
}

