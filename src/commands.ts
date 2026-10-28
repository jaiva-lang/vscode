import { FilesAndShii } from "./repos/config";
import { Repositories } from "./repos/repos";
import { Diagnostics } from "./vs/providers";

class Command {
    name: string;
    callback: (
        context: import("vscode").ExtensionContext,
        diagnostics: Diagnostics,
    ) => void | Promise<void>;
    constructor(
        name: string,
        callback: (
            context: import("vscode").ExtensionContext,
            diagnostics: Diagnostics,
        ) => void | Promise<void>,
    ) {
        this.name = name;
        this.callback = callback;
    }
}

export class CommandRegistry {
    private commands: Command[] = [];
    constructor(
        vscode: typeof import("vscode"),
        files: FilesAndShii,
        repos: Repositories,
        context: import("vscode").ExtensionContext,
    ) {
        console.log(context.globalStorageUri.fsPath);
        this.registerCommand("run", (c, d) => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage("No active file to run.");
                return;
            }

            const filePath = editor.document.fileName;

            const terminal =
                vscode.window.activeTerminal || vscode.window.createTerminal();
            terminal.show();
            terminal.sendText(`jaiva "${filePath}"`);
        });

        this.registerCommand("runTokens", (c, d) => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage("No active file to run.");
                return;
            }

            const filePath = editor.document.fileName;

            const terminal =
                vscode.window.activeTerminal || vscode.window.createTerminal();
            terminal.show();
            terminal.sendText(`jaiva "${filePath}" --json`);
        });

        this.registerCommand("addRepository", async (c, d) => {
            const url = await vscode.window.showInputBox({
                prompt: "GitHub repository URL",
                placeHolder: "https://github.com/user/repository",
            });

            if (!url) {
                return;
            }

            await repos.add(url, files);
        });
    }

    public subscribe(
        vscode: typeof import("vscode"),
        context: import("vscode").ExtensionContext,
        diagnostics: Diagnostics,
    ) {
        this.commands.forEach((cmd) => {
            context.subscriptions.push(
                vscode.commands.registerCommand(cmd.name, () =>
                    cmd.callback(context, diagnostics),
                ),
            );
        });
    }

    public registerCommand(
        name: string,
        callback: (
            context: import("vscode").ExtensionContext,
            diagnostics: Diagnostics,
        ) => void,
    ) {
        const command = new Command("jaiva." + name, callback);
        this.commands.push(command);
    }
}
