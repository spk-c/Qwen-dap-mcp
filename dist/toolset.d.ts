export type ToolsetMode = 'agent' | 'forensics' | 'full';
export declare const AGENT_TOOL_NAMES: ReadonlySet<string>;
export declare const FORENSICS_TOOL_NAMES: ReadonlySet<string>;
type ToolRegistrar = {
    registerTool: (...args: any[]) => any;
};
export declare function resolveToolsetMode(value?: string | undefined): ToolsetMode;
export declare function toolsetAllows(mode: ToolsetMode, toolName: string): boolean;
export declare function annotateToolRegistrar<T extends ToolRegistrar>(registrar: T): T;
export declare function filterToolRegistrar<T extends ToolRegistrar>(registrar: T, mode: ToolsetMode): T;
export {};
