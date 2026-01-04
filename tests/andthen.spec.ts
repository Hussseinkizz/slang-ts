import { describe, it, expect } from "vitest";
import { option, atom, Ok, Err } from "../src";

describe("andThen", () => {
  describe("Option.andThen", () => {
    it("transforms Some with sync fn", () => {
      const result = option(5).andThen((x) => x * 2) as any;
      expect(result.isSome).toBe(true);
      expect(result.value).toBe(10);
    });

    it("skips None with sync fn, returns same instance", () => {
      const original = option(null) as any;
      const result = original.andThen((x: any) => x) as any;
      expect(result.isNone).toBe(true);
      expect(result).toBe(original);
    });

    it("returns original when fn returns undefined", () => {
      const original = option(5) as any;
      const result = original.andThen(() => undefined) as any;
      expect(result.isSome).toBe(true);
      expect(result.value).toBe(5);
      expect(result).toBe(original);
    });

    it("returns None when fn throws", () => {
      const result = option(5).andThen(() => {
        throw new Error("oops");
      }) as any;
      expect(result.isNone).toBe(true);
    });

    it("returns None when fn returns falsy value", () => {
      const result = option(5).andThen(() => null as any) as any;
      expect(result.isNone).toBe(true);
    });

    it("transforms Some with async fn", async () => {
      const result = (await option(5).andThen(async (x) => x * 2)) as any;
      expect(result.isSome).toBe(true);
      expect(result.value).toBe(10);
    });

    it("skips None with async fn", async () => {
      const original = option(null) as any;
      const result = (await original.andThen(async (x: any) => x)) as any;
      expect(result.isNone).toBe(true);
      expect(result).toBe(original);
    });

    it("returns original when async fn returns undefined", async () => {
      const original = option(5) as any;
      const result = (await original.andThen(async () => undefined)) as any;
      expect(result.isSome).toBe(true);
      expect(result.value).toBe(5);
      expect(result).toBe(original);
    });

    it("returns None when async fn throws", async () => {
      const result = (await option(5).andThen(async () => {
        throw new Error("async oops");
      })) as any;
      expect(result.isNone).toBe(true);
    });

    it("supports chained andThen calls", () => {
      const result = (option(5).andThen((x) => x + 1) as any).andThen(
        (x: number) => x * 2,
      ) as any;
      expect(result.isSome).toBe(true);
      expect(result.value).toBe(12);
    });

    it("transforms type (number to string)", () => {
      const result = option(42).andThen((x) => x.toString()) as any;
      expect(result.isSome).toBe(true);
      expect(result.value).toBe("42");
    });
  });

  describe("Result.andThen", () => {
    it("transforms Ok with sync fn", () => {
      const result = Ok(5).andThen((x) => x * 2) as any;
      expect(result.isOk).toBe(true);
      expect(result.value).toBe(10);
    });

    it("skips Err with sync fn, returns same instance", () => {
      const original = Err("fail") as any;
      const result = original.andThen((x: any) => x) as any;
      expect(result.isErr).toBe(true);
      expect(result.error).toBe("fail");
      expect(result).toBe(original);
    });

    it("returns original when fn returns undefined", () => {
      const original = Ok(5) as any;
      const result = original.andThen(() => undefined) as any;
      expect(result.isOk).toBe(true);
      expect(result.value).toBe(5);
      expect(result).toBe(original);
    });

    it("returns Err when fn throws", () => {
      const result = Ok(5).andThen(() => {
        throw new Error("oops");
      }) as any;
      expect(result.isErr).toBe(true);
      expect(result.error).toBe("oops");
    });

    it("transforms Ok with async fn", async () => {
      const result = (await Ok(5).andThen(async (x) => x * 2)) as any;
      expect(result.isOk).toBe(true);
      expect(result.value).toBe(10);
    });

    it("skips Err with async fn", async () => {
      const original = Err("fail") as any;
      const result = (await original.andThen(async (x: any) => x)) as any;
      expect(result.isErr).toBe(true);
      expect(result).toBe(original);
    });

    it("returns original when async fn returns undefined", async () => {
      const original = Ok(5) as any;
      const result = (await original.andThen(async () => undefined)) as any;
      expect(result.isOk).toBe(true);
      expect(result.value).toBe(5);
      expect(result).toBe(original);
    });

    it("returns Err when async fn throws", async () => {
      const result = (await Ok(5).andThen(async () => {
        throw new Error("async oops");
      })) as any;
      expect(result.isErr).toBe(true);
      expect(result.error).toBe("async oops");
    });

    it("supports chained andThen calls", () => {
      const result = (Ok(5).andThen((x) => x + 1) as any).andThen(
        (x: number) => x * 2,
      ) as any;
      expect(result.isOk).toBe(true);
      expect(result.value).toBe(12);
    });

    it("works with expect after andThen", () => {
      const value = (Ok(5).andThen((x) => x * 2) as any).expect("should work");
      expect(value).toBe(10);
    });

    it("works with unwrap().else() after andThen", () => {
      const value = (Ok(5).andThen((x) => x * 2) as any).unwrap().else(0);
      expect(value).toBe(10);
    });
  });

  describe("Atom.andThen", () => {
    it("transforms description to new Atom", () => {
      const result = atom("hello").andThen((s) => s.toUpperCase());
      expect(result.description).toBe("HELLO");
    });

    it("returns original when fn returns undefined", () => {
      const original = atom("hello");
      const result = original.andThen(() => undefined);
      expect(result.description).toBe("hello");
      expect(result).toBe(original);
    });

    it("panics when fn returns non-string", () => {
      expect(() => {
        atom("test").andThen(() => 123 as any);
      }).toThrow("Atom.andThen: fn must return a string");
    });

    it("panics when fn throws", () => {
      expect(() => {
        atom("test").andThen(() => {
          throw new Error("oops");
        });
      }).toThrow("Atom.andThen: fn threw an error: oops");
    });

    it("supports chained andThen calls", () => {
      const result = atom("hello")
        .andThen((s) => s.toUpperCase())
        .andThen((s) => s + "!");
      expect(result.description).toBe("HELLO!");
    });
  });
});
