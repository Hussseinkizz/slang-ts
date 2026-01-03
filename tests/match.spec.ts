import { describe, expect, it } from "vitest";
import { atom, Err, match, matchAll, Ok, option } from "../index";
import type { Option } from "../index";

describe("match", () => {
  describe("Result matching", () => {
    it("matches Ok branch", () => {
      const result = Ok(42);
      const output = match(result, {
        Ok: (v) => `success: ${v.value}`,
        Err: (e) => `error: ${e.error}`,
      });
      expect(output).toBe("success: 42");
    });

    it("matches Err branch", () => {
      const result = Err("failed");
      const output = match(result, {
        Ok: (v) => `success: ${v.value}`,
        Err: (e) => `error: ${e.error}`,
      });
      expect(output).toBe("error: failed");
    });

    it("provides correctly typed value in Ok handler", () => {
      const result = Ok(100);
      match(result, {
        Ok: (v) => {
          expect(v.type).toBe("Ok");
          expect(v.value).toBe(100);
          expect(v.isOk).toBe(true);
          return "ok";
        },
        Err: () => "err",
      });
    });

    it("provides correctly typed error in Err handler", () => {
      const result = Err("Not found: code 404");
      match(result, {
        Ok: () => "ok",
        Err: (e) => {
          expect(e.type).toBe("Err");
          expect(e.error).toBe("Not found: code 404");
          expect(e.isErr).toBe(true);
          return "err";
        },
      });
    });

    it("can return Result from handlers", () => {
      const result = Ok(5);
      const transformed = match(result, {
        Ok: (v) => `success: ${v.value * 2}`,
        Err: (e) => `error: ${e.error}`,
      });
      expect(transformed).toContain("success: 10");
    });
  });

  describe("Option matching", () => {
    it("matches Some branch", () => {
      const opt = option("hello");
      const output = match(opt, {
        Some: (v) => `got: ${v.value}`,
        None: () => "nothing",
      });
      expect(output).toBe("got: hello");
    });

    it("matches None branch", () => {
      const opt = option<string>(null as any);
      const output = match(opt, {
        Some: (v: any) => `got: ${v.value}`,
        None: () => "nothing",
      });
      expect(output).toBe("nothing");
    });

    it("provides correctly typed value in Some handler", () => {
      const opt = option(42);
      const result = match(opt as Option<number>, {
        Some: (v) => {
          expect(v.type).toBe("Some");
          expect(v.value).toBe(42);
          expect(v.isSome).toBe(true);
          return "some";
        },
        None: () => "none",
      });
      expect(result).toBe("some");
    });

    it("provides correctly typed None in None handler", () => {
      const opt = option<number | undefined>(undefined);
      const result = match(opt as Option<number | undefined>, {
        Some: () => "some",
        None: (v) => {
          expect(v.type).toBe("None");
          expect(v.isNone).toBe(true);
          return "none";
        },
      });
      expect(result).toBe("none");
    });

    it("can return Option from handlers", () => {
      const opt = option(10);
      const transformed = match(opt as Option<number>, {
        Some: (v) => `value: ${v.value * 2}`,
        None: () => "zero",
      });
      expect(transformed).toBe("value: 20");
    });
  });

  describe("exhaustiveness", () => {
    it("throws if missing Ok handler", () => {
      const result = Ok(1);
      expect(() =>
        match(result, {
          Err: () => "err",
        } as any),
      ).toThrow("Non-exhaustive match — missing handler for 'Ok'");
    });

    it("throws if missing Err handler", () => {
      const result = Err("fail");
      expect(() =>
        match(result, {
          Ok: () => "ok",
        } as any),
      ).toThrow("Non-exhaustive match — missing handler for 'Err'");
    });

    it("throws if missing Some handler", () => {
      const opt = option("test");
      expect(() =>
        match(opt, {
          None: () => "none",
        } as any),
      ).toThrow("Non-exhaustive match — missing handler for 'Some'");
    });

    it("throws if missing None handler", () => {
      const opt = option<string | null>(null);
      expect(() =>
        match(opt as Option<string | null>, {
          Some: () => "some",
        } as any),
      ).toThrow("Non-exhaustive match — missing handler for 'None'");
    });
  });
});

describe("matchAll", () => {
  describe("string matching", () => {
    it("matches string literal", () => {
      const output = matchAll("foo", {
        foo: () => "matched foo",
        bar: () => "matched bar",
        _: () => "default",
      });
      expect(output).toBe("matched foo");
    });

    it("falls back to _ for unknown string", () => {
      const output = matchAll("unknown", {
        foo: () => "foo",
        bar: () => "bar",
        _: () => "default",
      });
      expect(output).toBe("default");
    });

    it("passes value to matched handler", () => {
      const output = matchAll("test", {
        test: (v) => `got: ${v}`,
        _: () => "default",
      });
      expect(output).toBe("got: test");
    });
  });

  describe("number matching", () => {
    it("matches numeric zero", () => {
      const output = matchAll(0, {
        0: () => "zero",
        1: () => "one",
        _: () => "other",
      });
      expect(output).toBe("zero");
    });

    it("matches positive numbers", () => {
      const output = matchAll(42, {
        42: () => "forty-two",
        _: () => "other",
      });
      expect(output).toBe("forty-two");
    });

    it("matches negative numbers", () => {
      const output = matchAll(-1, {
        "-1": () => "negative one",
        _: () => "other",
      });
      expect(output).toBe("negative one");
    });

    it("falls back for unmatched numbers", () => {
      const output = matchAll(999, {
        0: () => "zero",
        1: () => "one",
        _: () => "other",
      });
      expect(output).toBe("other");
    });
  });

  describe("boolean matching", () => {
    it("matches true", () => {
      const output = matchAll(true, {
        true: () => "yes",
        false: () => "no",
        _: () => "unknown",
      });
      expect(output).toBe("yes");
    });

    it("matches false", () => {
      const output = matchAll(false, {
        true: () => "yes",
        false: () => "no",
        _: () => "unknown",
      });
      expect(output).toBe("no");
    });

    it("passes boolean value to handler", () => {
      const output = matchAll(true, {
        true: (v) => `value is ${v}`,
        _: () => "other",
      });
      expect(output).toBe("value is true");
    });
  });

  describe("Atom matching", () => {
    it("matches atom by description", () => {
      const ready = atom("ready");
      const output = matchAll(ready, {
        ready: () => "is ready",
        pending: () => "is pending",
        _: () => "unknown",
      });
      expect(output).toBe("is ready");
    });

    it("falls back for unmatched atom", () => {
      const unknown = atom("weird");
      const output = matchAll(unknown, {
        ready: () => "ready",
        failed: () => "failed",
        _: () => "default",
      });
      expect(output).toBe("default");
    });

    it("passes atom to matched handler", () => {
      const status = atom("active");
      matchAll(status, {
        active: (v) => {
          expect(v).toBe(status);
          expect(v.description).toBe("active");
          return "ok";
        },
        _: () => "default",
      });
    });

    it("different atoms with same description match same pattern", () => {
      const state1 = atom("loading");
      const state2 = atom("loading");
      
      expect(state1).not.toBe(state2);
      
      const result1 = matchAll(state1, {
        loading: () => "loading state",
        _: () => "other",
      });
      
      const result2 = matchAll(state2, {
        loading: () => "loading state",
        _: () => "other",
      });
      
      expect(result1).toBe("loading state");
      expect(result2).toBe("loading state");
    });
  });

  describe("fallback requirement", () => {
    it("requires _ default handler", () => {
      // TypeScript enforces this at compile time
      // Runtime behavior: _ is always called for unmatched values
      const output = matchAll("unmatched", {
        foo: () => "foo",
        _: () => "caught by default",
      });
      expect(output).toBe("caught by default");
    });

    it("_ handler called when no match found", () => {
      let defaultCalled = false;
      matchAll(999, {
        1: () => "one",
        2: () => "two",
        _: () => {
          defaultCalled = true;
          return "default";
        },
      });
      expect(defaultCalled).toBe(true);
    });
  });

  describe("return value inference", () => {
    it("infers return type from handlers", () => {
      const result: string = matchAll("test", {
        test: () => "matched",
        _: () => "default",
      });
      expect(typeof result).toBe("string");
    });

    it("works with mixed return types unified", () => {
      const result: string | number = matchAll(1, {
        1: () => "one",
        2: () => "two",
        _: () => "other",
      });
      expect(result).toBe("one");
    });
  });

  describe("error cases", () => {
    it("throws for unsupported types", () => {
      expect(() =>
        matchAll({} as any, {
          _: () => "default",
        }),
      ).toThrow("Unsupported match all value type");
    });

    it("throws for arrays", () => {
      expect(() =>
        matchAll([] as any, {
          _: () => "default",
        }),
      ).toThrow("Unsupported match all value type");
    });

    it("throws for functions", () => {
      expect(() =>
        matchAll((() => {}) as any, {
          _: () => "default",
        }),
      ).toThrow("Unsupported match all value type");
    });
  });
});
