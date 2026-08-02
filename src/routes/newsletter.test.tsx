/** @jsxImportSource hono/jsx */
import { describe, it, expect } from "vitest";
import {
  ConfirmPage,
  UnsubscribePage,
  UnsubscribeSuccessPage,
  NotFoundPage,
} from "./newsletter";

const base = { lang: "en" as const, path: "/" };

describe("Newsletter pages", () => {
  it("ConfirmPage renders title and home button", () => {
    const html = String(<ConfirmPage {...base} />);
    expect(html).toContain("Subscription Confirmed");
    expect(html).toContain('class="btn"');
  });

  it("UnsubscribePage renders token form with danger button", () => {
    const html = String(<UnsubscribePage {...base} token="abc" />);
    expect(html).toContain('name="token"');
    expect(html).toContain('class="btn btn-danger"');
  });

  it("UnsubscribeSuccessPage renders success message", () => {
    const html = String(<UnsubscribeSuccessPage {...base} />);
    expect(html).toContain("You have been unsubscribed");
  });

  it("NotFoundPage renders invalid link message", () => {
    const html = String(<NotFoundPage {...base} />);
    expect(html).toContain("Invalid or expired link");
  });

  it("uses the paper and ink magazine palette", () => {
    const html = String(<ConfirmPage {...base} />);
    expect(html).toContain("#fdfcf8");
    expect(html).toContain("Songti SC");
  });
});
