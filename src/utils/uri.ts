import * as querystring from "node:querystring";
import { Uri } from "vscode";

export function fsPathToFileUri(filePath: string): Uri {
    return Uri.file(filePath);
}

export function fileUriToFsPath(uri: Uri): string {
    return uri.fsPath;
}

export function parse(unparsedUri: string): Uri {
    return Uri.parse(unparsedUri);
}

export function toMatchUri(fileUri: Uri, matchId: string): Uri {
    const queryParams = {
        ...querystring.parse(fileUri.query),
        scheme: fileUri.scheme,
        matchId: matchId
    };

    return Uri.from({
        scheme: "match",
        path: fileUri.path,
        query: querystring.stringify(queryParams)
    });
}

export function toFileUri(uri: Uri): Uri {
    const queryParams = querystring.parse(uri.query);
    const scheme = queryParams["scheme"] as string;
    delete queryParams["scheme"];
    delete queryParams["matchId"];

    return Uri.from({
        scheme,
        path: uri.path
    });
}

export function stringify(uri: Uri): string {
    return uri.toString(true);
}

export function getMatchId(matchUri: Uri): string {
    const queryParams = querystring.parse(matchUri.query);
    return queryParams["matchId"] as string;
}
