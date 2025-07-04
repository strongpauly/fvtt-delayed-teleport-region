import esbuild from "esbuild";
import fs from "fs";
import path from "path";
import * as Vite from "vite";
import checker from "vite-plugin-checker";
import { viteStaticCopy } from "vite-plugin-static-copy";
import tsconfigPaths from "vite-tsconfig-paths";
import packageJSON from "./package.json" with { type: "json" };

const PACKAGE_ID = `modules/${packageJSON.name}`;

const config = Vite.defineConfig(({ command, mode }): Vite.UserConfig => {
    const buildMode =
        mode === "production"
            ? "production"
            : mode === "stage"
              ? "stage"
              : "development";
    const outDir = "dist";
    const tsconfig = "./tsconfig.build.json";
    const typescript = {
        tsconfigPath: tsconfig,
    };
    const plugins = [
        checker({ typescript: typescript }),
        tsconfigPaths({ loose: true, projects: [tsconfig] }),
    ];

    console.log(`Build mode: ${buildMode}`);

    if (buildMode === "production") {
        plugins.push(
            minifyPlugin(),
            deleteLockFilePlugin(),
            ...viteStaticCopy({
                targets: [{ src: "README.md", dest: "." }],
            }),
        );
    } else if (buildMode === "stage") {
        plugins.push(
            minifyPlugin(),
            ...viteStaticCopy({
                targets: [{ src: "README.md", dest: "." }],
            }),
        );
    } else {
        plugins.push(
            handleHotUpdateForEnLang(outDir),
            handleHotUpdateForHandlebars(outDir),
        );
    }

    // Create dummy files for vite dev server
    if (command === "serve") {
        const message =
            "This file is for a running vite dev server and is not copied to a build";
        fs.writeFileSync("./index.html", `<h1>${message}</h1>\n`);
        if (!fs.existsSync("./styles")) fs.mkdirSync("./styles");
        fs.writeFileSync(
            "./styles/fvtt-delayed-teleport-region.css",
            `/** ${message} */\n`,
        );
        fs.writeFileSync(
            "./fvtt-delayed-teleport-region.mjs",
            `/** ${message} */\n\nwindow.global = window;\nimport "./src/ts/module.ts";\n`,
        );
        fs.writeFileSync("./vendor.mjs", `/** ${message} */\n`);
    }

    return {
        base:
            command === "build"
                ? "./"
                : `/modules/fvtt-delayed-teleport-region/`,
        publicDir: "static",
        define: {
            BUILD_MODE: JSON.stringify(buildMode),
        },
        esbuild: { keepNames: true },
        build: {
            outDir,
            emptyOutDir: false,
            minify: false,
            sourcemap: buildMode === "development",
            lib: {
                name: "fvtt-delayed-teleport-region",
                entry: "src/ts/module.ts",
                formats: ["es"],
                fileName: "module",
            },
            rollupOptions: {
                external: [
                    // Foundry VTT internal modules
                    /^@client\//,
                    /^@common\//,
                ],
                output: {
                    assetFileNames: ({ name }): string =>
                        name === "style.css" || name === "module.css"
                            ? "styles/fvtt-delayed-teleport-region.css"
                            : (name ?? ""),
                    chunkFileNames: "[name].mjs",
                    entryFileNames: "fvtt-delayed-teleport-region.mjs",
                    manualChunks: {
                        vendor: Object.keys(packageJSON.dependencies)
                            ? Object.keys(packageJSON.dependencies)
                            : [],
                    },
                },
                watch: { buildDelay: 100 },
            },
            target: "es2022",
        },
        server: {
            port: 30001,
            open: false,
            proxy: {
                "^(?!/modules/fvtt-delayed-teleport-region/)":
                    "http://localhost:30000/",
                "/socket.io": {
                    target: "ws://localhost:30000",
                    ws: true,
                },
            },
        },
        plugins,
        css: {
            devSourcemap: buildMode === "development",
        },
    };
});

function minifyPlugin(): Vite.Plugin {
    return {
        name: "minify",
        renderChunk: {
            order: "post",
            async handler(code, chunk) {
                return chunk.fileName.endsWith(".mjs")
                    ? esbuild.transform(code, {
                          keepNames: true,
                          minifyIdentifiers: false,
                          minifySyntax: true,
                          minifyWhitespace: true,
                      })
                    : code;
            },
        },
    };
}

function deleteLockFilePlugin(): Vite.Plugin {
    return {
        name: "delete-lock-file-plugin",
        resolveId(source) {
            return source === "virtual-module" ? source : null;
        },
        writeBundle(outputOptions) {
            const outDir = outputOptions.dir ?? "";
            const lockFile = path.resolve(
                outDir,
                "fvtt-delayed-teleport-region.lock",
            );
            fs.rmSync(lockFile);
        },
    };
}

function handleHotUpdateForEnLang(outDir: string): Vite.Plugin {
    return {
        name: "hmr-handler-en-lang",
        apply: "serve",
        handleHotUpdate(context) {
            if (context.file.startsWith(outDir)) return;
            if (!context.file.endsWith("en.json")) return;

            const basePath = context.file.slice(context.file.indexOf("lang/"));
            console.log(`Updating lang file at ${basePath}`);
            fs.promises
                .copyFile(context.file, `${outDir}/${basePath}`)
                .then(() => {
                    context.server.ws.send({
                        type: "custom",
                        event: "lang-update",
                        data: { path: `${PACKAGE_ID}/${basePath}` },
                    });
                });
        },
    };
}

function handleHotUpdateForHandlebars(outDir: string): Vite.Plugin {
    return {
        name: "hmr-handler-handlebars",
        apply: "serve",
        handleHotUpdate(context) {
            if (context.file.startsWith(outDir)) return;
            if (!context.file.endsWith(".hbs")) return;

            const basePath = context.file.slice(
                context.file.indexOf("templates/"),
            );
            console.log(`Updating template file at ${basePath}`);
            fs.promises
                .copyFile(context.file, `${outDir}/${basePath}`)
                .then(() => {
                    context.server.ws.send({
                        type: "custom",
                        event: "template-update",
                        data: { path: `${PACKAGE_ID}/${basePath}` },
                    });
                });
        },
    };
}

export default config;
