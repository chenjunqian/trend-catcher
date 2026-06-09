import { vi } from "vitest";

export function newStmt() {
  const s = {
    bind: vi.fn(),
    run: vi.fn(),
    first: vi.fn(),
    all: vi.fn(),
  };
  s.bind.mockReturnValue(s);
  s.run.mockResolvedValue({ success: true });
  s.first.mockResolvedValue(null);
  s.all.mockResolvedValue({ results: [] });
  return s;
}

export function mockD1(stmt?: ReturnType<typeof newStmt>) {
  const s = stmt ?? newStmt();
  return {
    prepare: vi.fn().mockReturnValue(s),
    batch: vi.fn().mockResolvedValue([]),
    _stmt: s,
  };
}
