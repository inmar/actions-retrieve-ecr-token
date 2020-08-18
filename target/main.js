"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const http = __importStar(require("typed-rest-client/HttpClient"));
function isSuccess(value) {
    return !(typeof value === "string");
}
function isDefined(value) {
    return value !== undefined && value !== null;
}
function parseVendorResponse(json) {
    return JSON.parse(json);
}
function parseBoolean(s) {
    return s.match(/(true|t|1|yes|y)/i) !== null;
}
function parseInputs() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    console.log("Configuring action...");
    const url = (_b = (_a = core.getInput("ecr_token_vendor_url")) === null || _a === void 0 ? void 0 : _a.trim(), (_b !== null && _b !== void 0 ? _b : ""));
    console.log(`ecr_token_vendor_url: ${url}`);
    const githubRepo = (_d = (_c = core.getInput("github_repo")) === null || _c === void 0 ? void 0 : _c.trim(), (_d !== null && _d !== void 0 ? _d : ""));
    const githubToken = (_f = (_e = core.getInput("github_token")) === null || _e === void 0 ? void 0 : _e.trim(), (_f !== null && _f !== void 0 ? _f : ""));
    console.log(`github_repo: ${githubRepo}`);
    let subrepos = (_h = (_g = core.getInput("subrepos")) === null || _g === void 0 ? void 0 : _g.trim().split(","), (_h !== null && _h !== void 0 ? _h : []));
    subrepos = subrepos.filter((s) => s.length > 0);
    console.log(`subrepos: ${subrepos}`);
    let includeRoot = parseBoolean((_k = (_j = core.getInput("include_root")) === null || _j === void 0 ? void 0 : _j.trim(), (_k !== null && _k !== void 0 ? _k : "")));
    console.log(`includeRoot: ${includeRoot}`);
    if (subrepos.length === 0 && !includeRoot) {
        console.log("Overriding includeRoot to true because no subrepos were included");
        includeRoot = true;
    }
    return {
        EcrTokenVendorUrl: url,
        GithubRepo: githubRepo,
        GithubToken: githubToken,
        Subrepos: subrepos,
        IncludeRoot: includeRoot,
    };
}
async function post(params) {
    const url = `https://${params.EcrTokenVendorUrl}/token`;
    const body = JSON.stringify({
        SubRepos: params.Subrepos,
        Repository: params.GithubRepo,
        GithubToken: params.GithubToken,
        IncludeRoot: params.IncludeRoot,
    });
    const headers = {
        "Content-Type": "application/json",
    };
    const client = new http.HttpClient("ecr-token-vendor");
    const result = await client.post(url, body, headers);
    const resultBody = await result.readBody();
    if (result.message.statusCode === 200) {
        return parseVendorResponse(resultBody);
    }
    let msg = "";
    if (isDefined(result.message.statusCode)) {
        msg += `HTTP status ${result.message.statusCode}`;
    }
    else {
        msg += `Error with undefined response code`;
    }
    return `${msg}: ${resultBody}`;
}
function setEnv(key, value) {
    console.log(`::set-env name=${key}::${value}`);
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
        }
        else {
            core.setFailed(`Failed: ${result}`);
        }
    }
    catch (e) {
        core.setFailed(`Failed with exception: ${e}`);
    }
}
run();
