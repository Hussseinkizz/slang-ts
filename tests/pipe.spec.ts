import { describe, expect, it, vi } from "vitest";
import { pipe, Ok, Err, option, atom, type Result } from "../src";

describe("pipe", () => {
  const addPipe = (x: number) => (res: Result<number, string>) =>
    res.isOk ? Ok(res.value + x) : res;

  const multiplyPipe = (x: number) => (res: Result<number, string>) =>
    res.isOk ? Ok(res.value * x) : res;

  const failingPipe = (threshold: number) => (res: Result<number, string>) => {
    if (res.isErr) return res;
    return res.value > threshold ? Err("Value too large") : res;
  };

  describe("initial value normalization", () => {
    it("accepts plain number as initial value", async () => {
      const result = await pipe(5, addPipe(3)).run();

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value).toBe(8);
      }
    });

    it("accepts plain string as initial value", async () => {
      const result = await pipe("hello", (res) =>
        res.isOk ? Ok(res.value + " world") : res
      ).run();

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value).toBe("hello world");
      }
    });

    it("accepts Option as initial value", async () => {
      const result = await pipe(option(10), addPipe(5)).run();

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value).toBe(15);
      }
    });

    it("accepts None Option as initial value and returns Err", async () => {
      const result = await pipe(option(null), addPipe(5)).run();

      expect(result.isErr).toBe(true);
    });

    it("accepts Result as initial value", async () => {
      const result = await pipe(Ok(20), addPipe(5)).run();

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value).toBe(25);
      }
    });

    it("accepts Err Result as initial value", async () => {
      const result = await pipe(Err("initial error"), addPipe(5)).run();

      expect(result.isErr).toBe(true);
      if (result.isErr) {
        expect(result.error).toBe("initial error");
      }
    });

    it("accepts Atom as initial value", async () => {
      const result = await pipe(atom("42"), (res) => {
        if (res.isErr) return res;
        const num = parseInt(String(res.value), 10);
        return isNaN(num) ? Err("Not a number") : Ok(num);
      }).run();

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value).toBe(42);
      }
    });
  });

  describe("pipeline execution", () => {
    it("executes functions left to right", async () => {
      const result = await pipe(5, addPipe(3), multiplyPipe(2)).run();

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value).toBe(16); // (5 + 3) * 2
      }
    });

    it("executes multiple functions in sequence", async () => {
      const result = await pipe(
        10,
        addPipe(5),      // 15
        multiplyPipe(2), // 30
        addPipe(-10),    // 20
        multiplyPipe(3)  // 60
      ).run();

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value).toBe(60);
      }
    });

    it("handles async pipeline functions", async () => {
      const asyncAdd = (x: number) => async (res: Result<number, string>) => {
        await new Promise((r) => setTimeout(r, 10));
        return res.isOk ? Ok(res.value + x) : res;
      };

      const result = await pipe(5, asyncAdd(3), asyncAdd(2)).run();

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value).toBe(10);
      }
    });

    it("handles mixed sync and async functions", async () => {
      const asyncMultiply = (x: number) => async (res: Result<number, string>) => {
        await new Promise((r) => setTimeout(r, 5));
        return res.isOk ? Ok(res.value * x) : res;
      };

      const result = await pipe(5, addPipe(5), asyncMultiply(2)).run();

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value).toBe(20);
      }
    });
  });

  describe("error handling", () => {
    it("stops on first error when allowErrors is false", async () => {
      const result = await pipe(
        15,
        failingPipe(10), // fails here
        addPipe(100)     // should not execute
      ).run({ allowErrors: false });

      expect(result.isErr).toBe(true);
      if (result.isErr) {
        expect(result.error).toBe("Value too large");
      }
    });

    it("continues on error when allowErrors is true", async () => {
      const recovered = (res: Result<number, string>) =>
        res.isErr ? Ok(0) : res;

      const result = await pipe(
        15,
        failingPipe(10),
        recovered,
        addPipe(5)
      ).run({ allowErrors: true });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value).toBe(5); // 0 + 5
      }
    });

    it("catches thrown exceptions", async () => {
      const throwingFn = () => (res: Result<number, string>) => {
        throw new Error("Runtime error");
      };

      const result = await pipe(5, throwingFn()).run();

      expect(result.isErr).toBe(true);
      if (result.isErr) {
        expect(result.error).toBe("Runtime error");
      }
    });

    it("catches async thrown exceptions", async () => {
      const asyncThrowingFn = () => async (res: Result<number, string>) => {
        await new Promise((r) => setTimeout(r, 5));
        throw new Error("Async runtime error");
      };

      const result = await pipe(5, asyncThrowingFn()).run();

      expect(result.isErr).toBe(true);
      if (result.isErr) {
        expect(result.error).toBe("Async runtime error");
      }
    });

    it("returns error if function does not return Result", async () => {
      const invalidFn = () => (res: Result<number, string>) => {
        return 42 as any; // Not a Result
      };

      const result = await pipe(5, invalidFn()).run();

      expect(result.isErr).toBe(true);
      if (result.isErr) {
        expect(result.error).toBe("Pipeline function must return a Result");
      }
    });
  });

  describe("callbacks", () => {
    it("calls onSuccess when pipeline completes successfully", async () => {
      const onSuccess = vi.fn();

      await pipe(5, addPipe(3)).run({ onSuccess });

      expect(onSuccess).toHaveBeenCalledWith(8);
    });

    it("calls onError when pipeline fails", async () => {
      const onError = vi.fn();

      await pipe(15, failingPipe(10)).run({ onError });

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
      const errorArg = onError.mock.calls[0]?.[0] as Error | undefined;
      expect(errorArg?.message).toBe("Value too large");
    });

    it("calls onEach after each function", async () => {
      const onEach = vi.fn();

      await pipe(5, addPipe(3), multiplyPipe(2)).run({ onEach });

      expect(onEach).toHaveBeenCalledTimes(2);
      const firstCall = onEach.mock.calls[0]?.[0];
      const secondCall = onEach.mock.calls[1]?.[0];
      expect(firstCall?.prevResult.value).toBe(8);
      expect(secondCall?.prevResult.value).toBe(16);
    });

    it("provides currentFn and nextFn names in onEach", async () => {
      const onEach = vi.fn();

      await pipe(5, addPipe(3), multiplyPipe(2)).run({ onEach });

      const firstCall = onEach.mock.calls[0]?.[0];
      const secondCall = onEach.mock.calls[1]?.[0];
      expect(firstCall?.currentFn).toBeDefined();
      expect(firstCall?.nextFn).toBeDefined();
      expect(secondCall?.nextFn).toBeUndefined();
    });

    it("does not call onSuccess when pipeline fails", async () => {
      const onSuccess = vi.fn();

      await pipe(15, failingPipe(10)).run({ onSuccess });

      expect(onSuccess).not.toHaveBeenCalled();
    });

    it("calls onError even with allowErrors when final result is Err", async () => {
      const onError = vi.fn();

      await pipe(15, failingPipe(10)).run({ onError, allowErrors: true });

      expect(onError).toHaveBeenCalled();
    });
  });

  describe("empty pipeline", () => {
    it("returns normalized initial value when no functions provided", async () => {
      const result = await pipe(42).run();

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value).toBe(42);
      }
    });
  });

  describe("return type", () => {
    it("always returns a Promise", () => {
      const pipeline = pipe(5, addPipe(3));
      const result = pipeline.run();

      expect(result).toBeInstanceOf(Promise);
    });

    it("returns Result with proper isOk/isErr flags", async () => {
      const okResult = await pipe(5, addPipe(3)).run();
      const errResult = await pipe(15, failingPipe(10)).run();

      expect(okResult.isOk).toBe(true);
      expect(okResult.isErr).toBe(false);
      expect(errResult.isOk).toBe(false);
      expect(errResult.isErr).toBe(true);
    });

    it("returns Result with type property", async () => {
      const okResult = await pipe(5, addPipe(3)).run();
      const errResult = await pipe(15, failingPipe(10)).run();

      expect(okResult.type).toBe("Ok");
      expect(errResult.type).toBe("Err");
    });
  });
});
