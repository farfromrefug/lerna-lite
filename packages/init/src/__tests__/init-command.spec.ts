jest.mock('envinfo');

import fs from 'fs-extra';
import path from 'path';
import tempy from 'tempy';

// helpers
const initFixture = require('@lerna-test/init-fixture')(__dirname);

// file under test
const lernaInit = require('@lerna-test/command-runner')(require('../../../cli/src/cli-commands/cli-init-commands'));

describe('Init Command', () => {
  const lernaVersion = "__TEST_VERSION__";

  describe("in an empty directory", () => {
    it("initializes git repo with lerna files", async () => {
      const testDir = tempy.directory();

      await lernaInit(testDir)();

      const [lernaJson, pkgJson, packagesDirExists, gitDirExists] = await Promise.all([
        fs.readJSON(path.join(testDir, "lerna.json")),
        fs.readJSON(path.join(testDir, "package.json")),
        fs.exists(path.join(testDir, "packages"), null),
        fs.exists(path.join(testDir, ".git"), null),
      ]);

      expect(lernaJson).toMatchObject({
        version: "0.0.0",
      });
      expect(pkgJson).toMatchObject({
        devDependencies: {
          "@lerna-lite/cli": `^${lernaVersion}`,
        },
      });
      expect(packagesDirExists).toBe(true);
      expect(gitDirExists).toBe(true);
    });

    it("initializes git repo with lerna files in independent mode", async () => {
      const testDir = tempy.directory();

      await lernaInit(testDir)("--independent");

      expect(await fs.readJSON(path.join(testDir, "lerna.json"))).toHaveProperty("version", "independent");
    });

    describe("with --exact", () => {
      it("uses exact version when adding lerna dependency", async () => {
        const testDir = tempy.directory();

        await lernaInit(testDir)("--exact");

        expect(await fs.readJSON(path.join(testDir, "package.json"))).toMatchObject({
          devDependencies: {
            "@lerna-lite/cli": lernaVersion,
          },
        });
      });

      it("sets lerna.json command.init.exact to true", async () => {
        const testDir = tempy.directory();

        await lernaInit(testDir)("--exact");

        expect(await fs.readJSON(path.join(testDir, "lerna.json"))).toMatchObject({
          command: {
            init: {
              exact: true,
            },
          },
        });
      });
    });
  });

  describe("in a subdirectory of a git repo", () => {
    it("creates lerna files", async () => {
      const dir = await initFixture("empty");
      const testDir = path.join(dir, "subdir");

      await fs.ensureDir(testDir);
      await lernaInit(testDir)();

      const [lernaJson, pkgJson, packagesDirExists] = await Promise.all([
        fs.readJSON(path.join(testDir, "lerna.json")),
        fs.readJSON(path.join(testDir, "package.json")),
        fs.exists(path.join(testDir, "packages"), null),
      ]);

      expect(lernaJson).toMatchObject({
        version: "0.0.0",
      });
      expect(pkgJson).toMatchObject({
        devDependencies: {
          "@lerna-lite/cli": `^${lernaVersion}`,
        },
      });
      expect(packagesDirExists).toBe(true);
    });
  });

  describe("when package.json exists", () => {
    it("adds lerna to sorted devDependencies", async () => {
      const testDir = await initFixture("has-package");
      const pkgJsonPath = path.join(testDir, "package.json");

      await fs.outputJSON(pkgJsonPath, {
        devDependencies: {
          alpha: "first",
          omega: "last",
        },
      });

      await lernaInit(testDir)();

      expect(await fs.readJSON(pkgJsonPath)).toMatchObject({
        devDependencies: {
          alpha: "first",
          "@lerna-lite/cli": `^${lernaVersion}`,
          omega: "last",
        },
      });
    });

    it("updates existing lerna in devDependencies", async () => {
      const testDir = await initFixture("has-package");
      const pkgJsonPath = path.join(testDir, "package.json");

      await fs.outputJSON(pkgJsonPath, {
        dependencies: {
          alpha: "first",
          omega: "last",
        },
        devDependencies: {
          "@lerna-lite/cli": "0.1.100",
        },
      });

      await lernaInit(testDir)();

      expect(await fs.readJSON(pkgJsonPath)).toMatchObject({
        dependencies: {
          alpha: "first",
          omega: "last",
        },
        devDependencies: {
          "@lerna-lite/cli": `^${lernaVersion}`,
        },
      });
    });

    it("updates existing lerna in sorted dependencies", async () => {
      const testDir = await initFixture("has-package");
      const pkgJsonPath = path.join(testDir, "package.json");

      await fs.outputJSON(pkgJsonPath, {
        dependencies: {
          alpha: "first",
          "@lerna-lite/cli": "0.1.100",
          omega: "last",
        },
      });

      await lernaInit(testDir)();

      expect(await fs.readJSON(pkgJsonPath)).toMatchObject({
        dependencies: {
          alpha: "first",
          "@lerna-lite/cli": `^${lernaVersion}`,
          omega: "last",
        },
      });
    });
  });

  describe("when lerna.json exists", () => {
    it("deletes lerna property if found", async () => {
      const testDir = await initFixture("has-lerna");
      const lernaJsonPath = path.join(testDir, "lerna.json");

      await fs.outputJSON(lernaJsonPath, {
        "@lerna-lite/cli": "0.1.100",
        version: "1.2.3",
      });

      await lernaInit(testDir)();

      expect(await fs.readJSON(lernaJsonPath)).toEqual({
        version: "1.2.3",
      });
    });
  });

  describe("when re-initializing with --exact", () => {
    it("sets lerna.json command.init.exact to true", async () => {
      const testDir = await initFixture("updates");
      const lernaJsonPath = path.join(testDir, "lerna.json");
      const pkgJsonPath = path.join(testDir, "package.json");

      await fs.outputJSON(lernaJsonPath, {
        "@lerna-lite/cli": "0.1.100",
        command: {
          bootstrap: {
            hoist: true,
          },
        },
        version: "1.2.3",
      });
      await fs.outputJSON(pkgJsonPath, {
        devDependencies: {
          "@lerna-lite/cli": lernaVersion,
        },
      });

      await lernaInit(testDir)("--exact");

      expect(await fs.readJSON(lernaJsonPath)).toEqual({
        command: {
          bootstrap: {
            hoist: true,
          },
          init: {
            exact: true,
          },
        },
        version: "1.2.3",
      });
    });
  });
});