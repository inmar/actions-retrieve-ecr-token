import * as core from '@actions/core';

import * as http from 'typed-rest-client/HttpClient';

interface VendorSuccess {
    Credentials: Credentials;
    RegistryUri: string;
    AwsAccountId?: string;
    AwsRegion?: string;
}

interface Credentials {
    AccessKeyId: string;
    Expiration: Date;
    SecretAccessKey: string;
    SessionToken: string;
}

type VendorResponse = VendorSuccess | string;

function isSuccess(value: VendorResponse): value is VendorSuccess {
    return !(typeof value === "string")
}

function isDefined<T>(value: T | undefined | null): value is T {
    return <T>value !== undefined && <T>value !== null;
}

function parseVendorResponse(json: string): VendorSuccess {
    return JSON.parse(json);
}

interface Params {
    EcrTokenVendorUrl: string;
    GithubRepo: string;
    GithubToken: string;
    Subrepos?: string[];
    IncludeRoot?: boolean;
}

function parseBoolean(s: string): boolean {
    return s.match(/(true|t|1|yes|y)/i) !== null;
}

function parseInputs(): Params {
    console.log("Configuring action...")
    const url = core.getInput("ecr_token_vendor_url")?.trim() ?? "";
    console.log(`ecr_token_vendor_url: ${url}`);

    const githubRepo = core.getInput("github_repo")?.trim() ?? "";
    const githubToken = core.getInput("github_token")?.trim() ?? "";
    console.log(`github_repo: ${githubRepo}`)

    let subrepos = core.getInput("subrepos")?.trim().split(",") ?? [];
    subrepos = subrepos.filter((s) => s.length > 0);
    console.log(`subrepos: ${subrepos}`)

    const includeRoot = parseBoolean(core.getInput("include_root")?.trim() ?? "");
    console.log(`includeRoot: ${includeRoot}`)

    return {
        EcrTokenVendorUrl: url,
        GithubRepo: githubRepo,
        GithubToken: githubToken,
        Subrepos: subrepos,
        IncludeRoot: includeRoot,
    };
}

async function post(params: Params): Promise<VendorResponse> {
    const url = `https://${params.EcrTokenVendorUrl}/token`;
    const body = JSON.stringify({
        Subrepos: params.Subrepos,
        Repository: params.GithubRepo,
        GithubToken: params.GithubToken,
        IncludeRoot: params.IncludeRoot,
    });
    const headers = {
        "Content-Type": "application/json",
    }
    const client = new http.HttpClient("ecr-token-vendor");
    const result = await client.post(url, body, headers);
    const resultBody = await result.readBody();

    if (result.message.statusCode === 200) {
        return parseVendorResponse(resultBody);
    }

    let msg = "";

    if (isDefined(result.message.statusCode)) {
        msg += `HTTP status ${result.message.statusCode}`;
    } else {
        msg += `Error with undefined response code`;
    }

    return `${msg}: ${resultBody}`;
}

function setEnv(key: string, value: string) {
    core.exportVariable(key, value);
}

async function run() {
    try {
        const params = parseInputs();
        const result = await post(params);

        if (isSuccess(result)) {
            setEnv("AWS_ACCESS_KEY_ID", result.Credentials.AccessKeyId);
            setEnv("AWS_SECRET_ACCESS_KEY", result.Credentials.SecretAccessKey);
            setEnv("AWS_SESSION_TOKEN", result.Credentials.SessionToken);
            setEnv("ECR_HOSTNAME", result.RegistryUri);

            if (result.AwsAccountId !== undefined) {
                setEnv("ECR_ACCOUNT_ID", result.AwsAccountId);
            }

            if (result.AwsRegion !== undefined) {
                setEnv("ECR_REGION", result.AwsRegion);
            }
        } else {
            core.setFailed(`Failed: ${result}`)
        }
    } catch (e) {
        core.setFailed(`Failed with exception: ${e}`)
    }
}

run();
