import * as vscode from "vscode";
import * as jaiva from "./jaiva/jaiva";
import * as wrapFr from "./vscodeWrapper";
import * as c from "./repos/config";
import { CommandRegistry } from "./commands";
import { Repositories } from "./repos/repos";
// import { MultiMap } from "./mmap";

const VERSION = "6.1.2";

export async function activate(context: vscode.ExtensionContext) {
    console.log("JAIVA VSCODE IS ACTIVE!!");

    const config = new c.FilesAndShii(context);
    await config.constr();
    const repositories = new Repositories();

    const repoList = await repositories.getAll(config);

    const collection = vscode.languages.createDiagnosticCollection("jaiva");
    const diagnostics = new wrapFr.Diagnostics(collection);

    // Register commands
    const commandRegistry = new CommandRegistry(
        vscode,
        config,
        repositories,
        context,
    );
    commandRegistry.subscribe(vscode, context, diagnostics);

    const values = new jaiva.SharedValues();
    const cli = new jaiva.JaivaCLI();

    const handler = new wrapFr.AllHandler(VERSION, values, cli, diagnostics);
    // load intrnal
    values.loadLibraries(vscode, VERSION, context);
    // collect and load external
    repoList.forEach((repo) =>
        values.loadLibrariesExternal(
            vscode,
            VERSION,
            config.getRepoFolder(repo.owner + "-" + repo.repo),
            ...repo.libraries,
        ),
    );

    handler.begin(vscode, context);

    if (vscode.window.activeTextEditor?.document) {
        handler.docParse(vscode.window.activeTextEditor?.document);
        handler.diagnostics.show(vscode.window.activeTextEditor?.document);
    }
}
