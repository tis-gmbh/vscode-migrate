# VSCode Migrate

A VSCode extension to migrate source code step by step. This extension is intended for projects that want to benefit from tools like [ts-morph](https://github.com/dsherret/ts-morph) or other code manipulation tools that go beyond pattern matching. Find an example of use at <https://github.com/tis-gmbh/vscode-migrate-example>.

## Features

- Fetches matches with suggested changes from a migration script that you provide (see [Migration Scripts](#migration-scripts))
- Shows the matches grouped by file in the sidebar
- Shows a preview of the suggested change using VSCode's diff editor, including coverage info
- Lets you modify the suggested change
- Applies the change to the file
- Trigger verification tasks on the migration script
- Submit the changes to version control if verification tasks succeed

## Usage

1. Provide a [Migration Script](#migration-scripts).
2. (Optionally) Have a test runner generate an lcov file to `./coverage/lcov.info` and update it on changes.
3. Run `Start Migration` command. All registered migrations will be listed. Pick the one you want to run.
4. Click the change you want to preview in the sidebar.
5. Inspect and - if needed - modify the suggested change.
6. Click the checkmark in the editor controls or run the `Apply Change` command.
7. Inspect the next change while waiting for the verification tasks and submission to version control to complete.

## Extension Settings

Currently none, but will likely be added in the future.

## Migration Scripts

>If you're writing in TypeScript, use [this definition file](./src/migrationTypes.d.ts) for type definitions.

Your migration script...

- needs to be located within the `.vscode/migration` directory of your project.
- can be written in JavaScript or TypeScript, the later requiring [ts-node](https://www.npmjs.com/package/ts-node) to be installed.
- can register migrations (or their sync or async factory functions) with a name using a global `registerMigration` function or `@Migration` decorator.
- is loaded into VSCode's extension development host process, which means
  - it can do anything, any normal VSCode Extension can do, but
  - will block the entire extension host process if it performs long running tasks synchronously.
- is currently only required once. If you updated it, you need to reload the window to include the changes.

Your migration...

- needs to have a sync or async `getMatchedFiles` method, returning a set of file with matches. For more details on the model, check [this definition file](./src/migrationTypes.d.ts).
- will have it's `getMatchedFiles` method only be called when the migration is started.
- does **NOT** need to update the matches or suggested changes on file changes.
- can define a sync or async `verify` method to run verification tasks like linting or running tests before submitting a change to version control.
- can throw an error within the verify method, if the verification tasks fail and submission to version control needs to be aborted.
- will have the `verify` method called every time a change is applied.
