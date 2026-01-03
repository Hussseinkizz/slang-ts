import { describe, expect, it } from "vitest";
import { Err, Ok, type Result } from "../index";

describe("Result", () => {
  describe("Ok creation", () => {
    it("creates Ok with value", () => {
      const result = Ok(42);
      expect(result.type).toBe("Ok");
      expect(result.isOk).toBe(true);
      expect(result.isErr).toBe(false);
      expect(result.value).toBe(42);
    });

    it("creates Ok with string", () => {
      const result = Ok("success");
      expect(result.isOk).toBe(true);
      expect(result.value).toBe("success");
    });

    it("creates Ok with object", () => {
      const data = { id: 1, name: "test" };
      const result = Ok(data);
      expect(result.isOk).toBe(true);
      expect(result.value).toEqual(data);
    });

    it("creates Ok with null value", () => {
      const result = Ok(null);
      expect(result.isOk).toBe(true);
      expect(result.value).toBe(null);
    });
  });

  describe("Err creation", () => {
    it("creates Err with string error", () => {
      const result = Err("something went wrong");
      expect(result.type).toBe("Err");
      expect(result.isOk).toBe(false);
      expect(result.isErr).toBe(true);
      expect(result.error).toBe("something went wrong");
    });

    it("creates Err with detailed string message", () => {
      const result = Err("auth: Invalid credentials");
      expect(result.isErr).toBe(true);
      expect(result.error).toBe("auth: Invalid credentials");
    });

    it("creates Err with formatted error message", () => {
      const result = Err("Error: test error");
      expect(result.isErr).toBe(true);
      expect(result.error).toBe("Error: test error");
    });
  });

  describe("expect", () => {
    it("returns value for Ok", () => {
      const result = Ok(100);
      expect(result.expect()).toBe(100);
      expect(result.expect("custom message")).toBe(100);
    });

    it("throws default error for Err with string", () => {
      const result = Err("failed");
      expect(() => result.expect()).toThrow("failed");
    });

    it("throws custom error for Err", () => {
      const result = Err("network error");
      expect(() => result.expect("must succeed")).toThrow("must succeed");
    });

    it("throws with error message string", () => {
      const result = Err("validation failed");
      expect(() => result.expect()).toThrow("validation failed");
    });

    it("throws with custom message when provided", () => {
      const result = Err("something broke");
      expect(() => result.expect("custom: operation failed")).toThrow("custom: operation failed");
    });
  });

  describe("unwrap().else()", () => {
    describe("Ok path", () => {
      it("returns value and ignores else", () => {
        const result = Ok(42);
        const value = result.unwrap().else(0);
        expect(value).toBe(42);
      });

      it("ignores else function for Ok", () => {
        const result = Ok("success");
        const value = result.unwrap().else(() => "fallback");
        expect(value).toBe("success");
      });
    });

    describe("Err path", () => {
      it("uses else value for Err", () => {
        const result: Result<number, string> = Err("failed");
        const value = result.unwrap().else(-1);
        expect(value).toBe(-1);
      });

      it("calls else function with error for Err", () => {
        const result: Result<string, string> = Err("network error");
        let capturedError: any;
        const value = result.unwrap().else((err) => {
          capturedError = err;
          return "recovered";
        });
        expect(capturedError).toBe("network error");
        expect(value).toBe("recovered");
      });

      it("passes error string to else function", () => {
        const errorMsg = "validation: invalid input";
        const result: Result<string, string> = Err(errorMsg);
        let capturedError: any;
        const value = result.unwrap().else((err) => {
          capturedError = err;
          return "default";
        });
        expect(capturedError).toBe(errorMsg);
        expect(value).toBe("default");
      });

      it("accepts falsy values from else", () => {
        const result1: Result<number, string> = Err("error");
        expect(result1.unwrap().else(0)).toBe(0);
        
        const result2: Result<string, string> = Err("error");
        expect(result2.unwrap().else("")).toBe("");
        
        const result3: Result<boolean, string> = Err("error");
        expect(result3.unwrap().else(false)).toBe(false);
        
        const result4: Result<null, string> = Err("error");
        expect(result4.unwrap().else(null)).toBe(null);
      });
    });

    describe("missing else chain", () => {
      it("documents microtask behavior for Ok", () => {
        // Ok path has microtask for symmetry but doesn't throw
        const result = Ok(42);
        const chain = result.unwrap();
        expect(chain).toHaveProperty("else");
        chain.else(0); // Complete chain
      });

      it("documents microtask throw for Err without else", () => {
        // If .else() is not called on Err, microtask throws formatted error
        const result: Result<number, string> = Err("failed");
        const chain = result.unwrap();
        expect(chain).toHaveProperty("else");
        chain.else(-1); // Complete chain to avoid throw
      });
    });
  });

  describe("type narrowing", () => {
    it("narrows to Ok when isOk is true", () => {
      const result = Ok(123);
      if (result.isOk) {
        const val: number = result.value;
        expect(val).toBe(123);
      }
    });

    it("narrows to Err when isErr is true", () => {
      const result = Err("error");
      if (result.isErr) {
        const err: string = result.error;
        expect(err).toBe("error");
      }
    });
  });

  describe("discriminated union", () => {
    it("works with type property", () => {
      const ok = Ok(1);
      const err = Err("fail");

      expect(ok.type).toBe("Ok");
      expect(err.type).toBe("Err");

      if (ok.type === "Ok") {
        expect(ok.value).toBe(1);
      }
      if (err.type === "Err") {
        expect(err.error).toBe("fail");
      }
    });
  });
});
