import type { Language } from "./types";
import { jsonFormatter } from "./formatters/json";
import { xmlFormatter } from "./formatters/xml";
import { csvFormatter } from "./formatters/csv";

/**
 * One way to format code in any language libellus knows, for a code block and a
 * snippet document alike. Every engine is loaded the first time its language is
 * formatted, so none of them sits in the startup bundle. All of it runs locally:
 * the wasm formatters ship in the bundle and Rust goes to the user's own rustfmt.
 *
 * Throws when the code does not parse; the caller leaves the text as it was.
 */
export async function formatCode(language: Language, code: string): Promise<string> {
  const formatted = await run(language, code);
  // A block's body ends before its closing fence, so the formatter's final newline
  // is not part of the code.
  return formatted.replace(/\n+$/, "");
}

/** Whether `formatCode` does anything for this language. */
export function canFormatLanguage(language: Language): boolean {
  return language !== "text";
}

async function run(language: Language, code: string): Promise<string> {
  switch (language) {
    case "json":
      if (!jsonFormatter.canFormat(code)) throw new Error("invalid json");
      return jsonFormatter.format(code);
    case "xml":
      if (!xmlFormatter.canFormat(code)) throw new Error("invalid xml");
      return xmlFormatter.format(code);
    case "csv":
      return csvFormatter.format(code);
    case "typescript":
    case "javascript":
    case "html":
    case "markdown":
    case "yaml":
      return prettier(language, code);
    case "sql":
      return (await import("sql-formatter")).format(code);
    case "python": {
      const ruff = await import("@wasm-fmt/ruff_fmt/vite");
      await ruff.default();
      return ruff.format(code);
    }
    case "cpp":
    case "csharp": {
      const clang = await import("@wasm-fmt/clang-format/vite");
      await clang.default();
      return language === "cpp"
        ? clang.format(code, "main.cc", "LLVM")
        : clang.format(code, "main.cs", "Microsoft");
    }
    case "rust": {
      if (!("__TAURI_INTERNALS__" in window)) throw new Error("rust formatting needs the desktop app");
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<string>("format_rust", { code });
    }
    case "text":
      return code;
  }
}

async function prettier(language: Language, code: string): Promise<string> {
  const [{ format }, estree] = await Promise.all([
    import("prettier/standalone"),
    import("prettier/plugins/estree"),
  ]);
  switch (language) {
    case "typescript":
      return format(code, { parser: "typescript", plugins: [estree, await import("prettier/plugins/typescript")] });
    case "javascript":
      return format(code, { parser: "babel", plugins: [estree, await import("prettier/plugins/babel")] });
    case "html": {
      const [html, postcss, babel] = await Promise.all([
        import("prettier/plugins/html"),
        import("prettier/plugins/postcss"),
        import("prettier/plugins/babel"),
      ]);
      return format(code, { parser: "html", plugins: [html, postcss, babel, estree] });
    }
    case "yaml":
      return format(code, { parser: "yaml", plugins: [await import("prettier/plugins/yaml")] });
    default:
      // Fences carry titles, not languages, so prettier must not read one as a
      // language to format.
      return format(code, {
        parser: "markdown",
        plugins: [await import("prettier/plugins/markdown")],
        embeddedLanguageFormatting: "off",
        proseWrap: "preserve",
      });
  }
}
