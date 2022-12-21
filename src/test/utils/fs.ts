import { readFileSync } from "fs";
import { join, resolve } from "path";
import { Uri } from "vscode";
import { fsPathToFileUri } from "../../utils/uri";

export const fixturePath = resolve(__dirname, "../../../src/test/fixtures/");
export const testWorkspacePath = join(fixturePath, "_testWorkspace");
export const migrationsPath = join(fixturePath, "migrations");

export function original(...paths: string[]): string {
    return readFileSync(originalPath(...paths), { encoding: "utf-8" });
}

export function originalPath(...path: string[]): string {
    return scenarioPath("originals", ...path);
}

export function actual(...paths: string[]): string {
    return readFileSync(actualPath(...paths), { encoding: "utf-8" });
}

export function actualPath(...path: string[]): string {
    return join(testWorkspacePath, ...path);
}

export function expected(...paths: string[]): string {
    return readFileSync(expectationPath(...paths), { encoding: "utf-8" });
}

export function expectationPath(...path: string[]): string {
    return scenarioPath("expectations", ...path);
}

export function scenarioPath(...path: string[]): string {
    return join(fixturePath, `${scenario.name}Project`, ...path);
}

export function actualUri(...path: string[]): Uri {
    return fsPathToFileUri(actualPath(...path));
}
