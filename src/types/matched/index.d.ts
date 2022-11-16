declare module "matched" {
    declare function glob(patterns: Array<string, RegExp>, options?: any): Promise<string[]>;
    export = glob;
}