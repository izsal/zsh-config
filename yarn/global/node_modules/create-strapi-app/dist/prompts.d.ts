declare function directory(): Promise<string>;
declare function typescript(): Promise<boolean>;
declare function example(): Promise<boolean>;
declare function gitInit(): Promise<boolean>;
declare function installDependencies(packageManager: string): Promise<boolean>;
export { directory, typescript, example, gitInit, installDependencies };
//# sourceMappingURL=prompts.d.ts.map