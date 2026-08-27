import { afterEach, describe, expect, it } from "bun:test";
import { clearRenderCache, Markdown, type MarkdownTheme } from "@oh-my-pi/pi-tui/components/markdown";
import { defaultMarkdownTheme } from "./test-themes.js";

// A whole-line wrap that survives strip — used to detect which rows the
// renderer attributed to the selected fence.
const OPEN = "\u0001HL\u0001";
const CLOSE = "\u0001HLEND\u0001";
const highlightFn = (text: string): string => `${OPEN}${text}${CLOSE}`;

function highlightTheme(): MarkdownTheme {
	return { ...defaultMarkdownTheme, codeBlockHighlight: highlightFn };
}

function codeBlock(text: string, lang = ""): string {
	return `\`\`\`${lang}\n${text}\n\`\`\``;
}

function highlightedRows(rows: readonly string[]): string[] {
	return rows.filter(row => row.includes(OPEN));
}

afterEach(() => {
	clearRenderCache();
});

describe("Markdown setHighlightedFence", () => {
	it("wraps only the selected fence's rows", () => {
		const md = new Markdown(
			`${codeBlock("first block", "ts")}\n\n${codeBlock("second block", "py")}`,
			1,
			0,
			highlightTheme(),
		);
		md.setHighlightedFence(1);

		const rows = md.render(60);
		expect(highlightedRows(rows).length).toBeGreaterThan(0);
		expect(highlightedRows(rows).join("\n")).toContain("second block");
		expect(highlightedRows(rows).join("\n")).not.toContain("first block");
	});

	it("highlights the first fence with index 0 and clears on undefined", () => {
		const md = new Markdown(`${codeBlock("only")}`, 1, 0, highlightTheme());
		md.setHighlightedFence(0);
		const rows = md.render(60);
		expect(rows.some(row => row.includes(OPEN) && row.includes("only"))).toBe(true);

		md.setHighlightedFence(undefined);
		expect(md.render(60).join("\n")).not.toContain(OPEN);
	});

	it("keeps highlighted and plain renders distinct across the module cache", () => {
		const source = `${codeBlock("shared body", "js")}`;
		const highlighted = new Markdown(source, 1, 0, highlightTheme());
		const plain = new Markdown(source, 1, 0, highlightTheme());

		// Render plain first so the L2 cache holds the unhighlighted rows, then
		// highlight — the cache key includes the selected fence.
		const plainRows = plain.render(60).join("\n");
		expect(plainRows).not.toContain(OPEN);
		highlighted.setHighlightedFence(0);
		const highlightedRows2 = highlighted.render(60).join("\n");
		expect(highlightedRows2).toContain(OPEN);
		expect(highlightedRows2).not.toBe(plainRows);
	});

	it("counts only column-0 backtick fences (tilde fences are not copy targets)", () => {
		const md = new Markdown(`~~~\ntilde\n~~~\n\n${codeBlock("backtick")}`, 1, 0, highlightTheme());
		// The tilde fence is not a column-0 backtick fence, so index 0 is the
		// backtick block — matching the coding agent's copy-target grammar.
		md.setHighlightedFence(0);

		const rows = md.render(60);
		expect(rows.some(row => row.includes(OPEN) && row.includes("backtick"))).toBe(true);
		expect(rows.some(row => row.includes(OPEN) && row.includes("tilde"))).toBe(false);
	});

	it("skips empty fences when numbering (matching copy-target extraction)", () => {
		const md = new Markdown(`${codeBlock("")}\n\n${codeBlock("real")}`, 1, 0, highlightTheme());
		// The empty fence is not a copy target, so index 0 is the real block.
		md.setHighlightedFence(0);

		const rows = md.render(60);
		expect(rows.some(row => row.includes(OPEN) && row.includes("real"))).toBe(true);
	});
});
