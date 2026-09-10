/** @jsxImportSource hono/jsx */
import { describe, it, expect } from "vitest";
import {
  ConfirmPage,
  UnsubscribePage,
  UnsubscribeSuccessPage,
  NotFoundPage,
  OfflinePage,
} from "./newsletter";

const base = { lang: "en" as const, path: "/" };

describe("Newsletter pages", () => {
  it("ConfirmPage renders title and home button", () => {
    const html = String(<ConfirmPage {...base} />);
    expect(html).toContain("Subscription Confirmed");
    expect(html).toContain('class="btn-primary"');
  });

  it("UnsubscribePage renders token form with primary button", () => {
    const html = String(<UnsubscribePage {...base} token="abc" />);
    expect(html).toContain('name="token"');
    expect(html).toContain('class="btn-primary"');
    expect(html).not.toContain("btn-danger");
  });

  it("UnsubscribeSuccessPage renders success message", () => {
    const html = String(<UnsubscribeSuccessPage {...base} />);
    expect(html).toContain("You have been unsubscribed");
  });

  it("NotFoundPage renders page-not-found copy", () => {
    const html = String(<NotFoundPage {...base} />);
    expect(html).toContain("Page not found");
  });

  it("NotFoundPage renders a custom message when provided", () => {
    const html = String(<NotFoundPage {...base} message="Invalid or expired link" />);
    expect(html).toContain("Invalid or expired link");
  });

  it("OfflinePage renders offline copy and retry action", () => {
    const html = String(<OfflinePage {...base} />);
    expect(html).toContain("Offline");
    expect(html).toContain('class="btn-ghost"');
  });

  it("uses the kami parchment and ink palette", () => {
    const html = String(<ConfirmPage {...base} />);
    expect(html).toContain("#f5f4ed");
    expect(html).toContain("#1B365D");
    expect(html).toContain("TsangerJinKai02");
    expect(html).not.toContain("#fdfcf8");
    expect(html).not.toContain("#b03a2e");
  });

  it("serves raw css without html-escaped quotes", () => {
    const html = String(<ConfirmPage {...base} />);
    const style = html.slice(html.indexOf("<style>") + 7, html.indexOf("</style>"));
    expect(style).toContain('font-family: "TsangerJinKai02"');
    expect(style).not.toContain("&quot;");
  });
});
