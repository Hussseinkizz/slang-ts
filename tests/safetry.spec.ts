import { describe, expect, it } from "vitest";
import { safeTry, Ok, Err, option, atom } from "../index";

describe("safeTry", () => {
  describe("synchronous functions", () => {
    it("returns Ok on success", async () => {
      const result = await safeTry(() => "success");

      expect(result.isOk).toBe(true);
      expect(result.isErr).toBe(false);
      if (result.isOk) {
        expect(result.value).toBe("success");
      }
    });

    it("returns Err on failure", async () => {
      const result = await safeTry(() => {
        throw new Error("sync error");
      });

      expect(result.isOk).toBe(false);
      expect(result.isErr).toBe(true);
      if (result.isErr) {
        expect(result.error).toBe("sync error");
      }
    });

    it("returns Ok with complex types", async () => {
      const result = await safeTry(() => {
        return { id: 1, name: "test" };
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value).toEqual({ id: 1, name: "test" });
      }
    });

    it("converts non-Error throws to Err with string message", async () => {
      const result = await safeTry(() => {
        throw "string error";
      });

      expect(result.isErr).toBe(true);
      if (result.isErr) {
        expect(result.error).toBe("string error");
      }
    });
  });

  describe("asynchronous functions", () => {
    it("returns Ok on async success", async () => {
      const result = await safeTry(async () => "async success");

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value).toBe("async success");
      }
    });

    it("returns Err on async failure", async () => {
      const result = await safeTry(async () => {
        throw new Error("async error");
      });

      expect(result.isErr).toBe(true);
      if (result.isErr) {
        expect(result.error).toBe("async error");
      }
    });

    it("handles async operations", async () => {
      const result = await safeTry(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "delayed";
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value).toBe("delayed");
      }
    });

    it("converts non-Error async throws to Err", async () => {
      const result = await safeTry(async () => {
        throw { custom: "object" };
      });

      expect(result.isErr).toBe(true);
      if (result.isErr) {
        expect(result.error).toBe("[object Object]");
      }
    });
  });

  describe("throw option", () => {
    it("re-throws sync errors when throw is true", async () => {
      await expect(
        safeTry(() => {
          throw new Error("should throw");
        }, { throw: true })
      ).rejects.toThrow("should throw");
    });

    it("re-throws async errors when throw is true", async () => {
      await expect(
        safeTry(async () => {
          throw new Error("async should throw");
        }, { throw: true })
      ).rejects.toThrow("async should throw");
    });

    it("returns Err when throw is false", async () => {
      const result = await safeTry(() => {
        throw new Error("captured");
      }, { throw: false });

      expect(result.isErr).toBe(true);
      if (result.isErr) {
        expect(result.error).toBe("captured");
      }
    });

    it("returns Err by default (throw: false)", async () => {
      const result = await safeTry(() => {
        throw new Error("default captured");
      });

      expect(result.isErr).toBe(true);
      if (result.isErr) {
        expect(result.error).toBe("default captured");
      }
    });
  });

  describe("edge cases", () => {
    it("handles null return value", async () => {
      const result = await safeTry(() => null);

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value).toBeNull();
      }
    });

    it("handles undefined return value", async () => {
      const result = await safeTry(() => undefined);

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value).toBeUndefined();
      }
    });

    it("handles 0 return value", async () => {
      const result = await safeTry(() => 0);

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value).toBe(0);
      }
    });

    it("handles false return value", async () => {
      const result = await safeTry(() => false);

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value).toBe(false);
      }
    });

    it("handles empty string return value", async () => {
      const result = await safeTry(() => "");

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value).toBe("");
      }
    });
  });

  describe("value evaluation (Atom, Result, Option)", () => {
    it("evaluates Ok Result and extracts value", async () => {
      const result = await safeTry(() => Ok(42));

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value).toBe(42);
      }
    });

    it("evaluates Err Result and returns Err", async () => {
      const result = await safeTry(() => Err("something failed"));

      expect(result.isErr).toBe(true);
      if (result.isErr) {
        expect(result.error).toBe("something failed");
      }
    });

    it("evaluates Some Option and extracts value", async () => {
      const result = await safeTry(() => option("hello"));

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value).toBe("hello");
      }
    });

    it("evaluates None Option and returns Err", async () => {
      const result = await safeTry(() => option(null));

      expect(result.isErr).toBe(true);
      if (result.isErr) {
        expect(result.error).toBe("Option was None");
      }
    });

    it("evaluates Atom and extracts description", async () => {
      const result = await safeTry(() => atom("ready"));

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value).toBe("ready");
      }
    });

    it("evaluates async functions returning Result", async () => {
      const result = await safeTry(async () => {
        await new Promise((r) => setTimeout(r, 5));
        return Ok({ name: "test" });
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value).toEqual({ name: "test" });
      }
    });

    it("evaluates async functions returning Option", async () => {
      const result = await safeTry(async () => {
        await new Promise((r) => setTimeout(r, 5));
        return option(100);
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value).toBe(100);
      }
    });
  });
});
