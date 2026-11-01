export declare function buildSarif(evidence: any): {
    version: string;
    $schema: string;
    runs: {
        tool: {
            driver: {
                name: string;
                informationUri: string;
                rules: {
                    id: unknown;
                    shortDescription: {
                        text: unknown;
                    };
                }[];
            };
        };
        results: any;
    }[];
};
export declare function renderEvidenceMarkdown(evidence: any): string;
export declare function exportEvidenceBundle(options: {
    path: string;
    evidence: unknown;
    format?: 'json' | 'markdown' | 'sarif';
    overwrite?: boolean;
}): {
    action: string;
    path: string;
    format: "json" | "markdown" | "sarif";
    bytes: number;
    overwritten: boolean;
};
export declare function importEvidenceBundle(pathInput: string): {
    action: string;
    path: string;
    bytes: number;
    evidence: unknown;
    offline: boolean;
    note: string;
};
