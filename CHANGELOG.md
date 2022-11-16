# Change Log

## 1.1.0

### 🚨 Breaking Changes 🚨

- The migration script no longer has access to the Extension Host API. Migration Scripts that use it, will fail to load.

### Separate Migration Script Process

The Migration Script now runs on a separate process. This means that your migration script no longer has access to the VSCode Extension Host Process. This change was performed because of the following introduced features:

- VSCode Migrate now supports Debugging of your migration script. If you run the `Debug Migration Script` command. This will attach the debugger to the migration script process. Set breakpoints as desired and use VSCode Migrate as if you were performing the migration normally. Run `Stop Debugging Migration Script` to detach from the process.
- Long running, synchronous operations in the migration script no longer stall the extension host process.

The migration script process can be restarted using the `Restart Migration Script Process` command.

## 1.0.5

- Stabilize tree selection using `TreeItem.id` [#5](https://github.com/tis-gmbh/vscode-migrate/issues/5)
- Merge error output channels [#6](https://github.com/tis-gmbh/vscode-migrate/issues/6)

## 1.0.4

- Save dirty preview before change is applied [#1](https://github.com/tis-gmbh/vscode-migrate/issues/1)
- Close preview of applied change even when opened in 'keep' mode [#3](https://github.com/tis-gmbh/vscode-migrate/issues/3)

## 1.0.1 - 1.0.3

- minor improvements
