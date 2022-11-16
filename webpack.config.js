//@ts-check

"use strict";

const path = require("path");

//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

/** @type WebpackConfig */
const baseConfig = {
    target: "node",
    mode: "none",
    resolve: {
        extensions: [".ts", ".js"]
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: "ts-loader"
                    }
                ]
            }
        ]
    },
    devtool: "nosources-source-map",
    infrastructureLogging: {
        level: "log",
    },
};


/** @type WebpackConfig */
const extensionConfig = Object.assign({}, baseConfig, {
    entry: "./src/extension.ts",
    output: {
        path: path.resolve(__dirname, "dist"),
        filename: "extension.js",
        libraryTarget: "commonjs2"
    },
    externals: {
        vscode: "commonjs vscode"
    }
});

const migrationScriptProcessConfig = Object.assign({}, baseConfig, {
    entry: "./src/migrationScriptProcess.ts",
    output: {
        path: path.resolve(__dirname, "dist"),
        filename: "migrationScriptProcess.js",
        libraryTarget: "commonjs2"
    }
});

module.exports = [extensionConfig, migrationScriptProcessConfig];
