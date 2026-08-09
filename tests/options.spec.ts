import { describe, expect, it } from "vitest";
import { Options, option, Ok, Err } from "../index";

describe("Options", () => {
  describe("first usable value wins", () => {
    it("returns first truthy raw value as Ok", () => {
      const result = Options([null, undefined, 42]);
      expect(result.isOk).toBe(true);
      if (result.isOk) expect(result.value).toBe(42);
    });

    it("returns first usable among mixed values (user case 1)", () => {
      const a = null;
      const b = option(undefined);
      const c = Ok(true);
      const d = Err("nope!");
      const result = Options([a, b, c, d], Err("No value!"));
      expect(result.isOk).toBe(true);
      if (result.isOk) expect(result.value).toBe(true);
    });

    it("unwraps Some inner values", () => {
      const result = Options([null, option("hello")]);
      expect(result.isOk).toBe(true);
      if (result.isOk) expect(result.value).toBe("hello");
    });

    it("respects array order over type", () => {
      const result = Options([Ok("first"), option("second")]);
      expect(result.isOk).toBe(true);
      if (result.isOk) expect(result.value).toBe("first");
    });

    it("skips falsy inner values of Ok, e.g. Ok('')", () => {
      const result = Options([Ok(""), Ok("real")]);
      expect(result.isOk).toBe(true);
      if (result.isOk) expect(result.value).toBe("real");
    });

    it("treats 0 and false as usable, matching option() semantics", () => {
      const result = Options([0, false]);
      expect(result.isOk).toBe(true);
      if (result.isOk) expect(result.value).toBe(0);
    });
  });

  describe("fallback", () => {
    it("returns default Err when nothing is usable (user case 2)", () => {
      const a = null;
      const b = option(undefined);
      const c = option(null);
      const d = Err("nope!");
      const result = Options([a, b, c, d]);
      expect(result.isErr).toBe(true);
      if (result.isErr) expect(result.error).toBe("No value!");
    });

    it("returns custom fallback when provided", () => {
      const result = Options([null, option(null), Err("nope!")], Err("Nothing usable"));
      expect(result.isErr).toBe(true);
      if (result.isErr) expect(result.error).toBe("Nothing usable");
    });

    it("returns fallback for empty array", () => {
      const result = Options([], Err("Empty"));
      expect(result.isErr).toBe(true);
      if (result.isErr) expect(result.error).toBe("Empty");
    });

    it("returns fallback when only None and Err are present", () => {
      const result = Options([option(null), Err("nope!")], Err("No value!"));
      expect(result.isErr).toBe(true);
      if (result.isErr) expect(result.error).toBe("No value!");
    });
  });
});
