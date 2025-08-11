// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

class CommentSidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'code-comment-viewer.commentsSidebar';
    private _view?: vscode.WebviewView;

    constructor(private readonly _context: vscode.ExtensionContext) {}

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
        };
        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

        // Listen for messages from the webview
        webviewView.webview.onDidReceiveMessage(async (msg) => {
            if (msg.command === 'highlightLine') {
                const editor = vscode.window.activeTextEditor;
                if (editor && typeof msg.line === 'number' && msg.line >= 0) {
                    const range = editor.document.lineAt(msg.line).range;
                    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
                    // Add a decoration to highlight the line
                    const decorationType = vscode.window.createTextEditorDecorationType({
                        backgroundColor: '#ffe58f',
                        isWholeLine: true,
                    });
                    editor.setDecorations(decorationType, [range]);
                    setTimeout(() => decorationType.dispose(), 500);
                }
            } else if (msg.command === 'insertHtmlComment') {
                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    const position = editor.selection.active;
                    const commentText = '<!--  -->';
                    await editor.edit(editBuilder => {
                        editBuilder.insert(position, commentText);
                    });
                    // Move cursor between the comment markers (after '<!-- ')
                    const newPos = position.with(position.line, position.character + 5);
                    editor.selection = new vscode.Selection(newPos, newPos);
                }
            }
        });

        // Update comments when the active editor or document changes
        vscode.window.onDidChangeActiveTextEditor(() => {
            this.postComments();
        });
        vscode.workspace.onDidChangeTextDocument(() => {
            this.postComments();
        });
        this.postComments();
    }

    postComments() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            this._view?.webview.postMessage({ command: 'setComments', comments: [] });
            return;
        }
        const text = editor.document.getText();
        const comments = [];
        const regex = /<!--([\s\S]*?)-->/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
            // Find line number
            const before = text.slice(0, match.index);
            const line = before.split('\n').length - 1;
            comments.push({ text: match[1].trim(), line });
        }
        this._view?.webview.postMessage({ command: 'setComments', comments });
    }

    getHtmlForWebview(webview: vscode.Webview): string {
        return `
            <html>
            <head>
                <style>
                    body { font-family: var(--vscode-font-family, sans-serif); margin: 0; padding: 0; background: transparent; color: var(--vscode-foreground); }
                    .comment {
                        background: transparent;
                        border: 1px solid var(--vscode-editorWidget-border, #cccccc);
                        border-radius: 4px;
                        margin: 8px 0;
                        padding: 8px 12px;
                        cursor: pointer;
                        color: var(--vscode-foreground);
                    }
                </style>
            </head>
            <body>
                <button id="insert-comment-btn" style="margin:8px 0 8px 0;display:block;width:100%;">Insert HTML Comment</button>
                <div id="comments"></div>
                <script>
                    const vscode = acquireVsCodeApi();
                    document.getElementById('insert-comment-btn').onclick = () => {
                        vscode.postMessage({ command: 'insertHtmlComment' });
                    };
                    window.addEventListener('message', event => {
                        const msg = event.data;
                        if (msg.command === 'setComments') {
                            const commentsDiv = document.getElementById('comments');
                            commentsDiv.innerHTML = '';
                            if (!msg.comments.length) {
                                commentsDiv.innerHTML = '<em>No comments found.</em>';
                                return;
                            }
                            msg.comments.forEach((c, idx) => {
                                const div = document.createElement('div');
                                div.className = 'comment';
                                div.textContent = \`Line \${c.line + 1}: \${c.text}\`;
                                div.onclick = () => vscode.postMessage({ command: 'highlightLine', line: c.line });
                                commentsDiv.appendChild(div);
                            });
                        }
                    });
                <\/script>
            </body>
            </html>
        `;
    }
}

export function activate(context: vscode.ExtensionContext) {
    // Register the Webview View provider for the sidebar
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            CommentSidebarProvider.viewType,
            new CommentSidebarProvider(context)
        )
    );

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "code-comment-viewer" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('code-comment-viewer.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from Code Comment Viewer!');
	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
