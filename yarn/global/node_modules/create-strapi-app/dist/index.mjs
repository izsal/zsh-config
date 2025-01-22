import path, { join as join$1, resolve, basename } from "node:path";
import os$1 from "node:os";
import chalk from "chalk";
import commander from "commander";
import crypto, { randomUUID } from "crypto";
import fse from "fs-extra";
import inquirer from "inquirer";
import { services, cli } from "@strapi/cloud-cli";
import execa from "execa";
import url from "node:url";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import * as tar from "tar";
import retry from "async-retry";
import os from "os";
import _, { kebabCase, merge } from "lodash";
import { join } from "path";
import semver from "semver";
import { machineIdSync } from "node-machine-id";
async function directory() {
  const { directory: directory2 } = await inquirer.prompt([
    {
      type: "input",
      default: "my-strapi-project",
      name: "directory",
      message: "What is the name of your project?"
    }
  ]);
  return directory2;
}
async function typescript() {
  const { useTypescript } = await inquirer.prompt([
    {
      type: "confirm",
      name: "useTypescript",
      message: "Start with Typescript?",
      default: true
    }
  ]);
  return useTypescript;
}
async function example() {
  const { useExample } = await inquirer.prompt([
    {
      type: "confirm",
      name: "useExample",
      message: "Start with an example structure & data?",
      default: false
    }
  ]);
  return useExample;
}
async function gitInit() {
  const { gitInit: gitInit2 } = await inquirer.prompt([
    {
      type: "confirm",
      name: "gitInit",
      message: "Initialize a git repository?",
      default: true
    }
  ]);
  return gitInit2;
}
async function installDependencies(packageManager) {
  const { installDependencies: installDependencies2 } = await inquirer.prompt([
    {
      type: "confirm",
      name: "installDependencies",
      message: `Install dependencies with ${packageManager}?`,
      default: true
    }
  ]);
  return installDependencies2;
}
const supportedStyles = {
  magentaBright: chalk.magentaBright,
  blueBright: chalk.blueBright,
  yellowBright: chalk.yellowBright,
  green: chalk.green,
  red: chalk.red,
  bold: chalk.bold,
  italic: chalk.italic
};
function parseToChalk(template) {
  let result = template;
  for (const [color, chalkFunction] of Object.entries(supportedStyles)) {
    const regex = new RegExp(`{${color}}(.*?){/${color}}`, "g");
    result = result.replace(regex, (_2, p1) => chalkFunction(p1.trim()));
  }
  return result;
}
function assertCloudError(e) {
  if (e.response === void 0) {
    throw Error("Expected CloudError");
  }
}
async function handleCloudLogin() {
  const logger2 = services.createLogger({
    silent: false,
    debug: process.argv.includes("--debug"),
    timestamp: false
  });
  const cloudApiService = await services.cloudApiFactory({ logger: logger2 });
  const defaultErrorMessage = "An error occurred while trying to interact with Strapi Cloud. Use strapi deploy command once the project is generated.";
  try {
    const { data: config } = await cloudApiService.config();
    logger2.log(parseToChalk(config.projectCreation.introText));
  } catch (e) {
    logger2.debug(e);
    logger2.error(defaultErrorMessage);
    return;
  }
  const { userChoice } = await inquirer.prompt([
    {
      type: "list",
      name: "userChoice",
      message: `Please log in or sign up.`,
      choices: ["Login/Sign up", "Skip"]
    }
  ]);
  if (userChoice !== "Skip") {
    const cliContext = {
      logger: logger2,
      cwd: process.cwd()
    };
    try {
      await cli.login.action(cliContext);
    } catch (e) {
      logger2.debug(e);
      try {
        assertCloudError(e);
        if (e.response.status === 403) {
          const message = typeof e.response.data === "string" ? e.response.data : "We are sorry, but we are not able to log you into Strapi Cloud at the moment.";
          logger2.warn(message);
          return;
        }
      } catch (e2) {
      }
      logger2.error(defaultErrorMessage);
    }
  }
}
const stripTrailingSlash = (str) => {
  return str.endsWith("/") ? str.slice(0, -1) : str;
};
async function copyTemplate(scope, rootPath) {
  const { template } = scope;
  if (!template) {
    throw new Error("Missing template or example app option");
  }
  if (await isOfficialTemplate(template, scope.templateBranch)) {
    await retry(
      () => downloadGithubRepo(rootPath, {
        owner: "strapi",
        repo: "strapi",
        branch: scope.templateBranch,
        subPath: `templates/${template}`
      }),
      {
        retries: 3,
        onRetry(err, attempt) {
          console.log(`Retrying to download the template. Attempt ${attempt}. Error: ${err}`);
        }
      }
    );
    return;
  }
  if (isLocalTemplate(template)) {
    const filePath = template.startsWith("file://") ? url.fileURLToPath(template) : template;
    await fse.copy(filePath, rootPath);
  }
  if (isGithubShorthand(template)) {
    const [owner, repo, ...pathSegments] = template.split("/");
    const subPath = pathSegments.length ? pathSegments.join("/") : scope.templatePath;
    await retry(
      () => downloadGithubRepo(rootPath, { owner, repo, branch: scope.templateBranch, subPath }),
      {
        retries: 3,
        onRetry(err, attempt) {
          console.log(`Retrying to download the template. Attempt ${attempt}. Error: ${err}`);
        }
      }
    );
    return;
  }
  if (isGithubRepo(template)) {
    const url2 = new URL(template);
    const [owner, repo, t, branch, ...pathSegments] = stripTrailingSlash(
      url2.pathname.slice(1)
    ).split("/");
    if (t !== void 0 && t !== "tree") {
      throw new Error(`Invalid GitHub template URL: ${template}`);
    }
    if (scope.templateBranch) {
      await retry(
        () => downloadGithubRepo(rootPath, {
          owner,
          repo,
          branch: scope.templateBranch,
          subPath: scope.templatePath
        }),
        {
          retries: 3,
          onRetry(err, attempt) {
            console.log(`Retrying to download the template. Attempt ${attempt}. Error: ${err}`);
          }
        }
      );
      return;
    }
    await retry(
      () => downloadGithubRepo(rootPath, {
        owner,
        repo,
        branch: decodeURIComponent(branch) ?? scope.templateBranch,
        subPath: pathSegments.length ? decodeURIComponent(pathSegments.join("/")) : scope.templatePath
      }),
      {
        retries: 3,
        onRetry(err, attempt) {
          console.log(`Retrying to download the template. Attempt ${attempt}. Error: ${err}`);
        }
      }
    );
    throw new Error(`Invalid GitHub template URL: ${template}`);
  }
}
async function downloadGithubRepo(rootPath, { owner, repo, branch, subPath }) {
  const filePath = subPath ? subPath.split("/").join(path.posix.sep) : null;
  let checkContentUrl = `https://api.github.com/repos/${owner}/${repo}/contents`;
  if (filePath) {
    checkContentUrl = `${checkContentUrl}/${filePath}`;
  }
  if (branch) {
    checkContentUrl = `${checkContentUrl}?ref=${branch}`;
  }
  const checkRes = await fetch(checkContentUrl, {
    method: "HEAD"
  });
  if (checkRes.status !== 200) {
    throw new Error(
      `Could not find a template at https://github.com/${owner}/${repo}${branch ? ` on branch ${branch}` : ""}${filePath ? ` at path ${filePath}` : ""}`
    );
  }
  let url2 = `https://api.github.com/repos/${owner}/${repo}/tarball`;
  if (branch) {
    url2 = `${url2}/${branch}`;
  }
  const res = await fetch(url2);
  if (!res.body) {
    throw new Error(`Failed to download ${url2}`);
  }
  await pipeline(
    // @ts-expect-error - Readable is not a valid source
    Readable.fromWeb(res.body),
    tar.x({
      cwd: rootPath,
      strip: filePath ? filePath.split("/").length + 1 : 1,
      filter(path2) {
        if (filePath) {
          return path2.split("/").slice(1).join("/").startsWith(filePath);
        }
        return true;
      }
    })
  );
}
function isLocalTemplate(template) {
  return template.startsWith("file://") || fse.existsSync(path.isAbsolute(template) ? template : path.resolve(process.cwd(), template));
}
function isGithubShorthand(value) {
  if (isValidUrl(value)) {
    return false;
  }
  return /^[\w-]+\/[\w-.]+(\/[\w-.]+)*$/.test(value);
}
function isGithubRepo(value) {
  try {
    const url2 = new URL(value);
    return url2.origin === "https://github.com";
  } catch {
    return false;
  }
}
function isValidUrl(value) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}
async function isOfficialTemplate(template, branch) {
  if (isValidUrl(template)) {
    return false;
  }
  const res = await fetch(
    `https://api.github.com/repos/strapi/strapi/contents/templates/${template}?${branch ? `ref=${branch}` : ""}`,
    { method: "HEAD" }
  );
  return res.status === 200;
}
async function isInGitRepository(rootDir) {
  try {
    await execa("git", ["rev-parse", "--is-inside-work-tree"], { stdio: "ignore", cwd: rootDir });
    return true;
  } catch (_2) {
    return false;
  }
}
async function isInMercurialRepository(rootDir) {
  try {
    await execa("hg", ["-cwd", ".", "root"], { stdio: "ignore", cwd: rootDir });
    return true;
  } catch (_2) {
    return false;
  }
}
async function tryGitInit(rootDir) {
  try {
    await execa("git", ["--version"], { stdio: "ignore" });
    if (await isInGitRepository(rootDir) || await isInMercurialRepository(rootDir)) {
      return false;
    }
    await execa("git", ["init"], { stdio: "ignore", cwd: rootDir });
    await execa("git", ["add", "."], { stdio: "ignore", cwd: rootDir });
    await execa("git", ["commit", "-m", "Initial commit from Strapi"], {
      stdio: "ignore",
      cwd: rootDir
    });
    return true;
  } catch (e) {
    console.error("Error while trying to initialize git:", e);
    return false;
  }
}
function addPackageJsonStrapiMetadata(metadata, scope) {
  const { packageJsonStrapi = {} } = scope;
  return _.defaults(metadata, packageJsonStrapi);
}
const boolToString = (value) => (value === true).toString();
const getProperties = (scope, error) => {
  const eventProperties = {
    error: typeof error === "string" ? error : error && error.message
  };
  const userProperties = {
    os: os.type(),
    osPlatform: os.platform(),
    osArch: os.arch(),
    osRelease: os.release(),
    nodeVersion: process.versions.node
  };
  const groupProperties = {
    version: scope.strapiVersion,
    docker: scope.docker,
    useYarn: scope.packageManager === "yarn",
    packageManager: scope.packageManager,
    /** @deprecated */
    useTypescriptOnServer: boolToString(scope.useTypescript),
    /** @deprecated */
    useTypescriptOnAdmin: boolToString(scope.useTypescript),
    useTypescript: boolToString(scope.useTypescript),
    isHostedOnStrapiCloud: process.env.STRAPI_HOSTING === "strapi.cloud",
    noRun: boolToString(scope.runApp),
    projectId: scope.uuid,
    useExample: boolToString(scope.useExample),
    gitInit: boolToString(scope.gitInit),
    installDependencies: boolToString(scope.installDependencies)
  };
  return {
    eventProperties,
    userProperties,
    groupProperties: addPackageJsonStrapiMetadata(groupProperties, scope)
  };
};
function trackEvent(event, payload) {
  if (process.env.NODE_ENV === "test") {
    return;
  }
  try {
    return fetch("https://analytics.strapi.io/api/v2/track", {
      method: "POST",
      body: JSON.stringify({
        event,
        ...payload
      }),
      signal: AbortSignal.timeout(1e3),
      headers: {
        "Content-Type": "application/json",
        "X-Strapi-Event": event
      }
    }).catch(() => {
    });
  } catch (err) {
    return Promise.resolve();
  }
}
async function trackError({ scope, error }) {
  const properties = getProperties(scope, error);
  try {
    return await trackEvent("didNotCreateProject", {
      deviceId: scope.deviceId,
      ...properties
    });
  } catch (err) {
    return Promise.resolve();
  }
}
async function trackUsage({
  event,
  scope,
  error
}) {
  const properties = getProperties(scope, error);
  try {
    return await trackEvent(event, {
      deviceId: scope.deviceId,
      ...properties
    });
  } catch (err) {
    return Promise.resolve();
  }
}
const engines = {
  node: ">=18.0.0 <=22.x.x",
  npm: ">=6.0.0"
};
async function createPackageJSON(scope) {
  const { sortPackageJson } = await import("sort-package-json");
  const pkgJSONPath = join(scope.rootPath, "package.json");
  const existingPkg = await fse.readJSON(pkgJSONPath).catch(() => ({}));
  const pkg = {
    name: kebabCase(scope.name),
    private: true,
    version: "0.1.0",
    description: "A Strapi application",
    devDependencies: scope.devDependencies ?? {},
    dependencies: scope.dependencies ?? {},
    strapi: {
      ...scope.packageJsonStrapi ?? {},
      uuid: scope.uuid
    },
    engines
  };
  await fse.writeJSON(pkgJSONPath, sortPackageJson(merge(existingPkg, pkg)), {
    spaces: 2
  });
}
const generateASecret = () => crypto.randomBytes(16).toString("base64");
const envTmpl = `
# Server
HOST=0.0.0.0
PORT=1337

# Secrets
APP_KEYS=<%= appKeys %>
API_TOKEN_SALT=<%= apiTokenSalt %>
ADMIN_JWT_SECRET=<%= adminJwtToken %>
TRANSFER_TOKEN_SALT=<%= transferTokenSalt %>

# Database
DATABASE_CLIENT=<%= database.client %>
DATABASE_HOST=<%= database.connection.host %>
DATABASE_PORT=<%= database.connection.port %>
DATABASE_NAME=<%= database.connection.database %>
DATABASE_USERNAME=<%= database.connection.username %>
DATABASE_PASSWORD=<%= database.connection.password %>
DATABASE_SSL=<%= database.connection.ssl %>
DATABASE_FILENAME=<%= database.connection.filename %>
`;
function generateDotEnv(scope) {
  const compile = _.template(envTmpl);
  return compile({
    appKeys: new Array(4).fill(null).map(generateASecret).join(","),
    apiTokenSalt: generateASecret(),
    transferTokenSalt: generateASecret(),
    adminJwtToken: generateASecret(),
    database: {
      client: scope.database.client,
      connection: {
        ...scope.database.connection,
        ssl: scope.database.connection?.ssl || false
      }
    }
  });
}
function isStderrError(error) {
  return typeof error === "object" && error !== null && "stderr" in error && typeof error.stderr === "string";
}
const MAX_PREFIX_LENGTH = 8;
const badge = (text, bgColor, textColor = chalk.black) => {
  const wrappedText = ` ${text} `;
  const repeat = Math.max(0, MAX_PREFIX_LENGTH - wrappedText.length);
  return " ".repeat(repeat) + bgColor(textColor(wrappedText));
};
const textIndent = (text, indentFirst = true, indent = MAX_PREFIX_LENGTH + 2) => {
  const parts = Array.isArray(text) ? text : [text];
  return parts.map((part, i) => {
    if (i === 0 && !indentFirst) {
      return part;
    }
    return " ".repeat(indent) + part;
  }).join("\n");
};
const logger = {
  log(message) {
    console.log(textIndent(message));
  },
  title(title, message) {
    const prefix = badge(title, chalk.bgBlueBright);
    console.log(`
${prefix}  ${message}`);
  },
  info(message) {
    console.log(`${" ".repeat(7)}${chalk.cyan("●")}  ${message}`);
  },
  success(message) {
    console.log(`
${" ".repeat(7)}${chalk.green("✓")}  ${chalk.green(message)}`);
  },
  fatal(message) {
    const prefix = badge("Error", chalk.bgRed);
    if (message) {
      console.error(`
${prefix}  ${textIndent(message, false)}
`);
    }
    process.exit(1);
  },
  error(message) {
    const prefix = badge("Error", chalk.bgRed);
    console.error(`
${prefix}  ${textIndent(message, false)}
`);
  },
  warn(message) {
    const prefix = badge("Warn", chalk.bgYellow);
    console.warn(`
${prefix}  ${textIndent(message, false)}
`);
  }
};
const baseGitIgnore = `
############################
# OS X
############################

.DS_Store
.AppleDouble
.LSOverride
Icon
.Spotlight-V100
.Trashes
._*


############################
# Linux
############################

*~


############################
# Windows
############################

Thumbs.db
ehthumbs.db
Desktop.ini
$RECYCLE.BIN/
*.cab
*.msi
*.msm
*.msp


############################
# Packages
############################

*.7z
*.csv
*.dat
*.dmg
*.gz
*.iso
*.jar
*.rar
*.tar
*.zip
*.com
*.class
*.dll
*.exe
*.o
*.seed
*.so
*.swo
*.swp
*.swn
*.swm
*.out
*.pid


############################
# Logs and databases
############################

.tmp
*.log
*.sql
*.sqlite
*.sqlite3


############################
# Misc.
############################

*#
ssl
.idea
nbproject
public/uploads/*
!public/uploads/.gitkeep
.tsbuildinfo
.eslintcache

############################
# Node.js
############################

lib-cov
lcov.info
pids
logs
results
node_modules
.node_history

############################
# Package managers
############################

.yarn/*
!.yarn/cache
!.yarn/unplugged
!.yarn/patches
!.yarn/releases
!.yarn/sdks
!.yarn/versions
.pnp.*
yarn-error.log

############################
# Tests
############################

coverage

############################
# Strapi
############################

.env
license.txt
exports
.strapi
dist
build
.strapi-updater.json
.strapi-cloud.json
`;
const gitIgnore = baseGitIgnore.trim();
const installArguments = ["install"];
const installArgumentsMap = {
  npm: {
    "*": ["--legacy-peer-deps"]
  },
  yarn: {
    "<4": ["--network-timeout", "1000000"],
    "*": []
  },
  pnpm: {
    "*": []
  }
};
const installEnvMap = {
  yarn: {
    ">=4": { YARN_HTTP_TIMEOUT: "1000000" },
    "*": {}
  },
  npm: {
    "*": {}
  },
  pnpm: {
    "*": {}
  }
};
const getPackageManagerVersion = async (packageManager, options) => {
  try {
    const { stdout } = await execa(packageManager, ["--version"], options);
    return stdout.trim();
  } catch (err) {
    throw new Error(`Error detecting ${packageManager} version: ${err}`);
  }
};
function mergeMatchingVersionRanges(version2, versionMap, mergeFn) {
  return Object.keys(versionMap).reduce((acc, range) => {
    if (semver.satisfies(version2, range) || range === "*") {
      return mergeFn(acc, versionMap[range]);
    }
    return acc;
  }, versionMap["*"]);
}
function mergeArguments(acc, curr) {
  return [...acc, ...curr];
}
function mergeEnvVars(acc, curr) {
  return { ...acc, ...curr };
}
const getInstallArgs = async (packageManager, options) => {
  const packageManagerVersion = await getPackageManagerVersion(packageManager, options);
  const envMap = installEnvMap[packageManager];
  const envArgs = packageManagerVersion ? mergeMatchingVersionRanges(packageManagerVersion, envMap, mergeEnvVars) : envMap["*"];
  const argsMap = installArgumentsMap[packageManager];
  const cmdArgs = packageManagerVersion ? mergeMatchingVersionRanges(packageManagerVersion, argsMap, mergeArguments) : argsMap["*"];
  return { envArgs, cmdArgs: [...installArguments, ...cmdArgs], version: packageManagerVersion };
};
async function createStrapi(scope) {
  const { rootPath } = scope;
  try {
    await fse.ensureDir(rootPath);
    await createApp(scope);
  } catch (error) {
    await fse.remove(rootPath);
    throw error;
  }
}
async function createApp(scope) {
  const {
    rootPath,
    useTypescript,
    useExample,
    installDependencies: installDependencies2,
    isQuickstart,
    template,
    packageManager,
    gitInit: gitInit2,
    runApp
  } = scope;
  const shouldRunSeed = useExample && installDependencies2;
  await trackUsage({ event: "willCreateProject", scope });
  logger.title("Strapi", `Creating a new application at ${chalk.green(rootPath)}`);
  if (!isQuickstart) {
    await trackUsage({ event: "didChooseCustomDatabase", scope });
  } else {
    await trackUsage({ event: "didChooseQuickstart", scope });
  }
  if (!template) {
    let templateName = useExample ? "example" : "vanilla";
    if (!useTypescript) {
      templateName = `${templateName}-js`;
    }
    const internalTemplatePath = join$1(__dirname, "../templates", templateName);
    if (await fse.exists(internalTemplatePath)) {
      await fse.copy(internalTemplatePath, rootPath);
    }
  } else {
    try {
      logger.info(`${chalk.cyan("Installing template")} ${template}`);
      await copyTemplate(scope, rootPath);
      logger.success("Template copied successfully.");
    } catch (error) {
      if (error instanceof Error) {
        logger.fatal(`Template installation failed: ${error.message}`);
      }
      throw error;
    }
    if (!fse.existsSync(join$1(rootPath, "package.json"))) {
      logger.fatal(`Missing ${chalk.bold("package.json")} in template`);
    }
  }
  await trackUsage({ event: "didCopyProjectFiles", scope });
  try {
    await createPackageJSON(scope);
    await trackUsage({ event: "didWritePackageJSON", scope });
    await fse.ensureDir(join$1(rootPath, "node_modules"));
    await fse.writeFile(join$1(rootPath, ".env"), generateDotEnv(scope));
    await trackUsage({ event: "didCopyConfigurationFiles", scope });
  } catch (err) {
    await fse.remove(rootPath);
    throw err;
  }
  if (installDependencies2) {
    try {
      logger.title("deps", `Installing dependencies with ${chalk.cyan(packageManager)}`);
      await trackUsage({ event: "willInstallProjectDependencies", scope });
      await runInstall(scope);
      await trackUsage({ event: "didInstallProjectDependencies", scope });
      logger.success(`Dependencies installed`);
    } catch (error) {
      const stderr = isStderrError(error) ? error.stderr : "";
      await trackUsage({
        event: "didNotInstallProjectDependencies",
        scope,
        error: stderr.slice(-1024)
      });
      logger.fatal([
        chalk.bold(
          "Oh, it seems that you encountered an error while installing dependencies in your project"
        ),
        "",
        `Don't give up, your project was created correctly`,
        "",
        `Fix the issues mentioned in the installation errors and try to run the following command:`,
        "",
        `cd ${chalk.green(rootPath)} && ${chalk.cyan(packageManager)} install`
      ]);
    }
  }
  await trackUsage({ event: "didCreateProject", scope });
  if (!await fse.exists(join$1(rootPath, ".gitignore"))) {
    await fse.writeFile(join$1(rootPath, ".gitignore"), gitIgnore);
  }
  if (gitInit2) {
    logger.title("git", "Initializing git repository.");
    await tryGitInit(rootPath);
    logger.success("Initialized a git repository.");
  }
  if (shouldRunSeed) {
    if (await fse.exists(join$1(rootPath, "scripts/seed.js"))) {
      logger.title("Seed", "Seeding your database with sample data");
      try {
        await execa(packageManager, ["run", "seed:example"], {
          stdio: "inherit",
          cwd: rootPath
        });
        logger.success("Sample data added to your database");
      } catch (error) {
        logger.error("Failed to seed your database. Skipping");
      }
    }
  }
  const cmd = chalk.cyan(`${packageManager} run`);
  logger.title("Strapi", `Your application was created!`);
  logger.log([
    "Available commands in your project:",
    "",
    "Start Strapi in watch mode. (Changes in Strapi project files will trigger a server restart)",
    `${cmd} develop`,
    "",
    "Start Strapi without watch mode.",
    `${cmd} start`,
    "",
    "Build Strapi admin panel.",
    `${cmd} build`,
    "",
    "Deploy Strapi project.",
    `${cmd} deploy`,
    ""
  ]);
  if (useExample) {
    logger.log(["Seed your database with sample data.", `${cmd} seed:example`, ""]);
  }
  logger.log(["Display all available commands.", `${cmd} strapi
`]);
  if (installDependencies2) {
    logger.log([
      "To get started run",
      "",
      `${chalk.cyan("cd")} ${rootPath}`,
      !shouldRunSeed && useExample ? `${cmd} seed:example && ${cmd} develop` : `${cmd} develop`
    ]);
  } else {
    logger.log([
      "To get started run",
      "",
      `${chalk.cyan("cd")} ${rootPath}`,
      `${chalk.cyan(packageManager)} install`,
      !shouldRunSeed && useExample ? `${cmd} seed:example && ${cmd} develop` : `${cmd} develop`
    ]);
  }
  if (runApp && installDependencies2) {
    logger.title("Run", "Running your Strapi application");
    try {
      await trackUsage({ event: "willStartServer", scope });
      await execa(packageManager, ["run", "develop"], {
        stdio: "inherit",
        cwd: rootPath,
        env: {
          FORCE_COLOR: "1"
        }
      });
    } catch (error) {
      if (typeof error === "string" || error instanceof Error) {
        await trackUsage({
          event: "didNotStartServer",
          scope,
          error
        });
      }
      logger.fatal("Failed to start your Strapi application");
    }
  }
}
async function runInstall({ rootPath, packageManager }) {
  const { envArgs, cmdArgs } = await getInstallArgs(packageManager, {
    cwd: rootPath,
    env: {
      ...process.env,
      NODE_ENV: "development"
    }
  });
  const options = {
    cwd: rootPath,
    stdio: "inherit",
    env: {
      ...process.env,
      ...envArgs,
      NODE_ENV: "development"
    }
  };
  const proc = execa(packageManager, cmdArgs, options);
  return proc;
}
function checkNodeRequirements() {
  const currentNodeVersion = process.versions.node;
  if (!semver.satisfies(currentNodeVersion, engines.node)) {
    logger.fatal([
      chalk.red(`You are running ${chalk.bold(`Node.js ${currentNodeVersion}`)}`),
      `Strapi requires ${chalk.bold(chalk.green(`Node.js ${engines.node}`))}`,
      "Please make sure to use the right version of Node."
    ]);
  } else if (semver.major(currentNodeVersion) % 2 !== 0) {
    logger.warn([
      chalk.yellow(`You are running ${chalk.bold(`Node.js ${currentNodeVersion}`)}`),
      `Strapi only supports ${chalk.bold(chalk.green("LTS versions of Node.js"))}, other versions may not be compatible.`
    ]);
  }
}
async function checkInstallPath(directory2) {
  const rootPath = resolve(directory2);
  if (await fse.pathExists(rootPath)) {
    const stat = await fse.stat(rootPath);
    if (!stat.isDirectory()) {
      logger.fatal(
        `${chalk.green(
          rootPath
        )} is not a directory. Make sure to create a Strapi application in an empty directory.`
      );
    }
    const files = await fse.readdir(rootPath);
    if (files.length > 1) {
      logger.fatal([
        "You can only create a Strapi app in an empty directory",
        `Make sure ${chalk.green(rootPath)} is empty.`
      ]);
    }
  }
  return rootPath;
}
function machineID() {
  try {
    const deviceId = machineIdSync();
    return deviceId;
  } catch (error) {
    const deviceId = randomUUID();
    return deviceId;
  }
}
const DBOptions = ["dbclient", "dbhost", "dbport", "dbname", "dbusername", "dbpassword"];
const VALID_CLIENTS = ["sqlite", "mysql", "postgres"];
const DEFAULT_CONFIG = {
  client: "sqlite",
  connection: {
    filename: ".tmp/data.db"
  }
};
async function dbPrompt() {
  const { useDefault } = await inquirer.prompt([
    {
      type: "confirm",
      name: "useDefault",
      message: "Do you want to use the default database (sqlite) ?",
      default: true
    }
  ]);
  if (useDefault) {
    return DEFAULT_CONFIG;
  }
  const { client } = await inquirer.prompt([
    {
      type: "list",
      name: "client",
      message: "Choose your default database client",
      choices: ["sqlite", "postgres", "mysql"],
      default: "sqlite"
    }
  ]);
  const questions = dbQuestions[client].map((q) => q({ client }));
  const responses = await inquirer.prompt(questions);
  return {
    client,
    connection: responses
  };
}
async function getDatabaseInfos(options) {
  if (options.skipDb) {
    return DEFAULT_CONFIG;
  }
  if (options.dbclient && !VALID_CLIENTS.includes(options.dbclient)) {
    logger.fatal(
      `Invalid --dbclient: ${options.dbclient}, expected one of ${VALID_CLIENTS.join(", ")}`
    );
  }
  const matchingArgs = DBOptions.filter((key) => key in options);
  const missingArgs = DBOptions.filter((key) => !(key in options));
  if (matchingArgs.length > 0 && matchingArgs.length !== DBOptions.length && options.dbclient !== "sqlite") {
    logger.fatal(`Required database arguments are missing: ${missingArgs.join(", ")}.`);
  }
  const hasDBOptions = DBOptions.some((key) => key in options);
  if (!hasDBOptions) {
    if (options.quickstart) {
      return DEFAULT_CONFIG;
    }
    return dbPrompt();
  }
  if (!options.dbclient) {
    return logger.fatal("Please specify the database client");
  }
  const database2 = {
    client: options.dbclient,
    connection: {
      host: options.dbhost,
      port: options.dbport,
      database: options.dbname,
      username: options.dbusername,
      password: options.dbpassword,
      filename: options.dbfile
    }
  };
  if (options.dbssl !== void 0) {
    database2.connection.ssl = options.dbssl === "true";
  }
  return database2;
}
const sqlClientModule = {
  mysql: { mysql2: "3.9.8" },
  postgres: { pg: "8.8.0" },
  sqlite: { "better-sqlite3": "11.3.0" }
};
function addDatabaseDependencies(scope) {
  scope.dependencies = {
    ...scope.dependencies,
    ...sqlClientModule[scope.database.client]
  };
}
const DEFAULT_PORTS = {
  postgres: 5432,
  mysql: 3306,
  sqlite: void 0
};
const database = () => ({
  type: "input",
  name: "database",
  message: "Database name:",
  default: "strapi",
  validate(value) {
    if (value.includes(".")) {
      return `The database name can't contain a "."`;
    }
    return true;
  }
});
const host = () => ({
  type: "input",
  name: "host",
  message: "Host:",
  default: "127.0.0.1"
});
const port = ({ client }) => ({
  type: "input",
  name: "port",
  message: "Port:",
  default: DEFAULT_PORTS[client]
});
const username = () => ({
  type: "input",
  name: "username",
  message: "Username:"
});
const password = () => ({
  type: "password",
  name: "password",
  message: "Password:",
  mask: "*"
});
const ssl = () => ({
  type: "confirm",
  name: "ssl",
  message: "Enable SSL connection:",
  default: false
});
const filename = () => ({
  type: "input",
  name: "filename",
  message: "Filename:",
  default: ".tmp/data.db"
});
const dbQuestions = {
  sqlite: [filename],
  postgres: [database, host, port, username, password, ssl],
  mysql: [database, host, port, username, password, ssl]
};
const { version } = fse.readJSONSync(join$1(__dirname, "..", "package.json"));
const command = new commander.Command("create-strapi-app").version(version).arguments("[directory]").usage("[directory] [options]").option("--quickstart", "Quickstart app creation (deprecated)").option("--no-run", "Do not start the application after it is created.").option("--ts, --typescript", "Initialize the project with TypeScript (default)").option("--js, --javascript", "Initialize the project with Javascript").option("--use-npm", "Use npm as the project package manager").option("--use-yarn", "Use yarn as the project package manager").option("--use-pnpm", "Use pnpm as the project package manager").option("--install", "Install dependencies").option("--no-install", "Do not install dependencies").option("--skip-cloud", "Skip cloud login and project creation").option("--example", "Use an example app").option("--no-example", "Do not use an example app").option("--git-init", "Initialize a git repository").option("--no-git-init", "Do no initialize a git repository").option("--dbclient <dbclient>", "Database client").option("--dbhost <dbhost>", "Database host").option("--dbport <dbport>", "Database port").option("--dbname <dbname>", "Database name").option("--dbusername <dbusername>", "Database username").option("--dbpassword <dbpassword>", "Database password").option("--dbssl <dbssl>", "Database SSL").option("--dbfile <dbfile>", "Database file path for sqlite").option("--skip-db", "Skip database configuration").option("--template <template>", "Specify a Strapi template").option("--template-branch <templateBranch>", "Specify a branch for the template").option("--template-path <templatePath>", "Specify a path to the template inside the repository").description("create a new application");
async function run(args) {
  const options = command.parse(args).opts();
  const directory$1 = command.args[0];
  logger.title(
    "Strapi",
    `${chalk.green(chalk.bold(`v${version}`))} ${chalk.bold("🚀 Let's create your new project")}
`
  );
  if ((options.javascript !== void 0 || options.typescript !== void 0) && options.template !== void 0) {
    logger.fatal(
      `You cannot use ${chalk.bold("--javascript")} or ${chalk.bold("--typescript")} with ${chalk.bold("--template")}`
    );
  }
  if (options.javascript === true && options.typescript === true) {
    logger.fatal(
      `You cannot use both ${chalk.bold("--typescript")} (--ts) and ${chalk.bold("--javascript")} (--js) flags together`
    );
  }
  if (options.example === true && options.template !== void 0) {
    logger.fatal(`You cannot use ${chalk.bold("--example")} with ${chalk.bold("--template")}`);
  }
  if (options.template !== void 0 && options.template.startsWith("-")) {
    logger.fatal(`Template name ${chalk.bold(`"${options.template}"`)} is invalid`);
  }
  if ([options.useNpm, options.usePnpm, options.useYarn].filter(Boolean).length > 1) {
    logger.fatal(
      `You cannot specify multiple package managers at the same time ${chalk.bold("(--use-npm, --use-pnpm, --use-yarn)")}`
    );
  }
  if (options.quickstart && !directory$1) {
    logger.fatal(
      `Please specify the ${chalk.bold("<directory>")} of your project when using ${chalk.bold("--quickstart")}`
    );
  }
  checkNodeRequirements();
  const appDirectory = directory$1 || await directory();
  const rootPath = await checkInstallPath(appDirectory);
  if (!options.skipCloud) {
    await handleCloudLogin();
  }
  const tmpPath = join$1(os$1.tmpdir(), `strapi${crypto.randomBytes(6).toString("hex")}`);
  const scope = {
    rootPath,
    name: basename(rootPath),
    packageManager: getPkgManager(options),
    database: await getDatabaseInfos(options),
    template: options.template,
    templateBranch: options.templateBranch,
    templatePath: options.templatePath,
    isQuickstart: options.quickstart,
    useExample: false,
    runApp: options.quickstart === true && options.run !== false,
    strapiVersion: version,
    packageJsonStrapi: {
      template: options.template
    },
    uuid: (process.env.STRAPI_UUID_PREFIX || "") + crypto.randomUUID(),
    docker: process.env.DOCKER === "true",
    deviceId: machineID(),
    tmpPath,
    gitInit: true,
    devDependencies: {},
    dependencies: {
      "@strapi/strapi": version,
      "@strapi/plugin-users-permissions": version,
      "@strapi/plugin-cloud": version,
      // third party
      react: "^18.0.0",
      "react-dom": "^18.0.0",
      "react-router-dom": "^6.0.0",
      "styled-components": "^6.0.0"
    }
  };
  if (options.template !== void 0) {
    scope.useExample = false;
  } else if (options.example === true) {
    scope.useExample = true;
  } else if (options.example === false || options.quickstart === true) {
    scope.useExample = false;
  } else {
    scope.useExample = await example();
  }
  if (options.javascript === true) {
    scope.useTypescript = false;
  } else if (options.typescript === true || options.quickstart) {
    scope.useTypescript = true;
  } else if (!options.template) {
    scope.useTypescript = await typescript();
  }
  if (options.install === true || options.quickstart) {
    scope.installDependencies = true;
  } else if (options.install === false) {
    scope.installDependencies = false;
  } else {
    scope.installDependencies = await installDependencies(scope.packageManager);
  }
  if (scope.useTypescript) {
    scope.devDependencies = {
      ...scope.devDependencies,
      typescript: "^5",
      "@types/node": "^20",
      "@types/react": "^18",
      "@types/react-dom": "^18"
    };
  }
  if (options.gitInit === true || options.quickstart) {
    scope.gitInit = true;
  } else if (options.gitInit === false) {
    scope.gitInit = false;
  } else {
    scope.gitInit = await gitInit();
  }
  addDatabaseDependencies(scope);
  try {
    await createStrapi(scope);
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error;
    }
    await trackError({ scope, error });
    logger.fatal(error.message);
  }
}
function getPkgManager(options) {
  if (options.useNpm === true) {
    return "npm";
  }
  if (options.usePnpm === true) {
    return "pnpm";
  }
  if (options.useYarn === true) {
    return "yarn";
  }
  const userAgent = process.env.npm_config_user_agent || "";
  if (userAgent.startsWith("yarn")) {
    return "yarn";
  }
  if (userAgent.startsWith("pnpm")) {
    return "pnpm";
  }
  return "npm";
}
export {
  createStrapi,
  run
};
//# sourceMappingURL=index.mjs.map
