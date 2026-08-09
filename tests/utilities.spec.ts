import { afterEach, describe, expect, it, vi } from "vitest";
import { println, setEnvironment } from "../index";

describe("utilities", () => {
  afterEach(() => {
    setEnvironment({ printFn: null });
    setEnvironment("development");
    vi.restoreAllMocks();
  });

  describe("println", () => {
    it("prints args joined with spaces and appends a newline", () => {
      const log = vi.spyOn(globalThis.console, "log").mockImplementation(() => {});

      println("test", 123, true);

      expect(log).toHaveBeenCalledTimes(1);
      expect(log).toHaveBeenCalledWith("test 123 true\n");
    });

    it("prints an empty line when called with no arguments", () => {
      const log = vi.spyOn(globalThis.console, "log").mockImplementation(() => {});

      println();

      expect(log).toHaveBeenCalledWith("\n");
    });

    it("stringifies symbol arguments instead of throwing", () => {
      const log = vi.spyOn(globalThis.console, "log").mockImplementation(() => {});

      println("key", Symbol("abc"));

      expect(log).toHaveBeenCalledWith("key Symbol(abc)\n");
    });

    it("does nothing in production mode", () => {
      const log = vi.spyOn(globalThis.console, "log").mockImplementation(() => {});

      setEnvironment("production");
      println("hidden");

      expect(log).not.toHaveBeenCalled();
    });
  });

  describe("setEnvironment", () => {
    it("is idempotent — last call wins", () => {
      setEnvironment("prod");
      setEnvironment("development");

      const log = vi.spyOn(globalThis.console, "log").mockImplementation(() => {});
      println("visible");

      expect(log).toHaveBeenCalledWith("visible\n");
    });

    it("accepts short forms dev and prod", () => {
      setEnvironment("prod");
      const log = vi.spyOn(globalThis.console, "log").mockImplementation(() => {});
      println("hidden");
      expect(log).not.toHaveBeenCalled();

      setEnvironment("dev");
      println("visible");
      expect(log).toHaveBeenCalledWith("visible\n");
    });

    it("routes println through a custom printFn instead of the console", () => {
      const printFn = vi.fn();
      setEnvironment({ printFn });

      println("hello", "world");

      expect(printFn).toHaveBeenCalledWith("hello world\n");
    });

    it("keeps routing through printFn in production mode", () => {
      const printFn = vi.fn();
      setEnvironment("prod");
      setEnvironment({ printFn });

      println("to the logger");

      expect(printFn).toHaveBeenCalledWith("to the logger\n");
    });

    it("switches back to the console after { printFn: null }", () => {
      setEnvironment({ printFn: vi.fn() });
      setEnvironment({ printFn: null });

      const log = vi.spyOn(globalThis.console, "log").mockImplementation(() => {});
      println("back to console");

      expect(log).toHaveBeenCalledWith("back to console\n");
    });
  });
});
