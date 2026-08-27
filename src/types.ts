export type ServerId = string;

export interface ServerRepositoryDefinition {
  id: string;
  repoUrl: string;
  defaultBranch: string;
  runtime: "python" | "node";
  preferredEntryPoints: readonly string[];
  fallbackRequirementsFile?: string;
  buildCommands?: readonly { command: string; args: string[] }[];
  defaultEnv?: Record<string, string>;
}

export interface EnvironmentBinaries {
  python: string;
  hasUv: boolean;
  uv: string | null;
  node: string;
  npm: string;
  git: string;
}
