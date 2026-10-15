// Hand-written types for `fhir-validator-wrapper` (plain CommonJS, ships no
// types) — only the members the validator test calls. Shapes read from the
// installed package's `fhir-validator.js`; see docs/architecture.md's
// "Cross-validation with independent parsers".
declare module "fhir-validator-wrapper" {
	export interface FhirValidatorStartConfig {
		/** FHIR version, e.g. `"4.0.1"`. */
		version: string;
		/** Terminology server URL, or `"n/a"` to run with no terminology server. */
		txServer: string;
		txLog: string;
		igs?: string[];
		port?: number;
		/** Milliseconds to wait for the service to come up. */
		timeout?: number;
		autoDownload?: boolean;
		skipUpdateCheck?: boolean;
		extraArgs?: string[];
	}

	export interface OperationOutcomeIssue {
		severity: "fatal" | "error" | "warning" | "information";
		code: string;
		diagnostics?: string;
		details?: { text?: string };
		expression?: string[];
		location?: string[];
	}

	export interface OperationOutcome {
		resourceType: "OperationOutcome";
		issue?: OperationOutcomeIssue[];
	}

	export default class FhirValidator {
		constructor(validatorJarPath: string);
		start(config: FhirValidatorStartConfig): Promise<void>;
		validate(resource: object): Promise<OperationOutcome>;
		stop(): Promise<void>;
	}
}
