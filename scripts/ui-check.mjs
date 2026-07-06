#!/usr/bin/env node
// UI convention check:
//  - Popup/floating surfaces that use bg-popover must use the project's
//    shadow-as-border pattern (shadow-[var(--shadow-border),...]) instead of
//    a solid border, so they don't render a visible dark outline.
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const uiDir = join(root, "apps/web/src/shared/ui");

async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) files.push(...(await walk(full)));
        else if (entry.name.endsWith(".tsx")) files.push(full);
    }
    return files;
}

function collectStrings(node) {
    const strings = [];
    function visit(n) {
        if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
            strings.push(n.text);
        } else if (ts.isTemplateExpression(n)) {
            let text = n.head.text;
            for (const span of n.templateSpans) {
                text += span.literal.text;
            }
            strings.push(text);
        }
        ts.forEachChild(n, visit);
    }
    visit(node);
    return strings;
}

const errors = [];

if ((await stat(uiDir).catch(() => null))?.isDirectory()) {
    const files = await walk(uiDir);
    for (const file of files) {
        const content = await readFile(file, "utf8");
        const source = ts.createSourceFile(
            file,
            content,
            ts.ScriptTarget.Latest,
            true,
            ts.ScriptKind.TSX,
        );

        function visit(node) {
            if (
                ts.isJsxAttribute(node) &&
                node.name.getText(source) === "className" &&
                node.initializer
            ) {
                const cls = collectStrings(node.initializer).join(" ");
                const normalized = cls.replace(/\s+/g, " ").trim();
                if (
                    normalized.includes("bg-popover") &&
                    normalized.includes("border") &&
                    !/shadow-\[var\(--shadow-border/.test(normalized)
                ) {
                    errors.push(
                        `${relative(root, file)}: popover surface uses "border" without project shadow-as-border pattern`,
                    );
                }
            }
            ts.forEachChild(node, visit);
        }
        visit(source);
    }
}

if (errors.length) {
    console.error("ui:check failed:");
    for (const e of errors) console.error(`  - ${e}`);
    console.error(
        "  hint: replace `border` with `shadow-[var(--shadow-border),var(--shadow-lg)]` (or md/sm) on floating surfaces.",
    );
    process.exit(1);
}

console.log("ui:check passed");
