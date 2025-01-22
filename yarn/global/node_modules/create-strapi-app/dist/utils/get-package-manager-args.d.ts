import execa from 'execa';
/**
 * Retrieves the version of the specified package manager.
 *
 * Executes the package manager's `--version` command to determine its version.
 *
 * @param packageManager - The name of the package manager (e.g., 'npm', 'yarn', 'pnpm').
 * @param options - Optional execution options to pass to `execa`.
 * @returns A promise that resolves to the trimmed version string of the package manager.
 *
 * @throws Will throw an error if the package manager's version cannot be determined.
 */
export declare const getPackageManagerVersion: (packageManager: string, options?: execa.Options) => Promise<string>;
/**
 * Retrieves the install arguments and environment variables for a given package manager.
 *
 * This function determines the correct command line arguments and environment variables
 * based on the package manager's version. It uses predefined semver ranges to match
 * the package manager's version and merges all applicable settings.
 *
 * The arguments and environment variables are sourced from:
 *  - `installArgumentsMap` for command line arguments.
 *  - `installEnvMap` for environment variables.
 *
 * The function ensures that all matching semver ranges are considered and merged appropriately.
 * It always includes the base `installArguments` (e.g., `['install']`) and applies any additional
 * arguments or environment variables as defined by the matched version ranges.
 *
 * @param packageManager - The name of the package manager (e.g., 'npm', 'yarn', 'pnpm').
 * @param options - Optional execution options to pass to `execa`.
 * @returns An object containing:
 *  - `cmdArgs`: The full array of install arguments for the given package manager and version.
 *  - `envArgs`: The merged environment variables applicable to the package manager and version.
 *
 * @throws Will throw an error if the package manager version cannot be determined.
 */
export declare const getInstallArgs: (packageManager: string, options?: execa.Options) => Promise<{
    envArgs: Record<string, string>;
    cmdArgs: string[];
    version: string;
}>;
//# sourceMappingURL=get-package-manager-args.d.ts.map