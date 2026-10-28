import { describe, expect, it } from "vitest";
import { createStepper, Err, list, Ok, sets, struct, superPromise } from "../index";
import type {
  ListChain,
  Result,
  SetsChain,
  Step,
  StructChain,
  SuperPromise,
} from "../index";

describe("public utility types", () => {
  it("keeps collection types through the adapters", () => {
    const numbers: ListChain<number> = list([1, 2, 3]);
    const first: number = numbers.get(0).else(0);
    const missingItem: number | string = numbers.get(9, "none").else(0);
    const record: StructChain<{ id: number; role: string }> = struct({
      id: 1,
      role: "admin",
    });
    const role: string = record.get("role").else("none");
    const missing: unknown = record.get("missing").else("none");
    const fallback: string | number = record.get("role", 0).else("none");

    const setNumbers: SetsChain<number> = sets([1, 2, 3]);
    const setKeys: SetsChain<string> = sets({ read: true });
    const setMapKeys: SetsChain<string> = sets(new Map([["a", 1]]));
    const readonlyMap: ReadonlyMap<string, number> = new Map([["a", 1]]);
    const setReadonlyMap: SetsChain<string> = sets(readonlyMap);
    const setFromOk: SetsChain<number> = sets(Ok([1, 2]));
    const setFromOkObject: SetsChain<string> = sets(Ok({ read: true }));
    const setFromOkMap: SetsChain<string> = sets(Ok(new Map([["a", 1]])));
    const setFromOkSet: SetsChain<number> = sets(Ok(new Set([1])));

    const union: SetsChain<number> = sets([1, 2]).union([3, 4]);
    const intersection: SetsChain<number> = sets([1, 2]).intersection(new Set([2, 3]));
    const difference: SetsChain<number> = sets([1, 2]).difference([1]);

    const rows = [{ id: 1, role: "admin" }];
    const keyed: Record<string, { id: number; role: string }> = struct(rows)
      .keyBy((row) => row.id)
      .else({});

    expect([...numbers.else([])]).toEqual([1, 2, 3]);
    expect(first).toBe(1);
    expect(missingItem).toBe("none");
    expect(record.count().else(0)).toBe(2);
    expect(role).toBe("admin");
    expect(missing).toBe("none");
    expect(fallback).toBe("admin");
    expect([...setNumbers.else(new Set())]).toEqual([1, 2, 3]);
    expect(setKeys.else(new Set())).toEqual(new Set(["read"]));
    expect(setMapKeys.else(new Set())).toEqual(new Set(["a"]));
    expect(setReadonlyMap.else(new Set())).toEqual(new Set(["a"]));
    expect([...setFromOk.else(new Set())]).toEqual([1, 2]);
    expect(setFromOkObject.else(new Set())).toEqual(new Set(["read"]));
    expect(setFromOkMap.else(new Set())).toEqual(new Set(["a"]));
    expect(setFromOkSet.else(new Set())).toEqual(new Set([1]));
    expect([...union.else(new Set())]).toEqual([1, 2, 3, 4]);
    expect([...intersection.else(new Set())]).toEqual([2]);
    expect([...difference.else(new Set())]).toEqual([2]);
    expect(keyed["1"]?.role).toBe("admin");
  });

  it("preserves Result and SuperPromise wide assignments", () => {
    const narrow: Result<string, string> = Ok("value");
    const wide: Result<unknown, string> = narrow;

    const narrowTask: SuperPromise<string> = superPromise(async () => "value");
    const wideTask: SuperPromise<unknown> = narrowTask;

    expect(wide.isOk).toBe(true);
    expect(wideTask).toBe(narrowTask);
  });

  it("types lazy iteration and Stepper steps", async () => {
    const names: readonly string[] = Ok(["ada", "grace"])
      .iterate()
      .map((name) => name.toUpperCase())
      .toArray()
      .else([]);

    const stepper = createStepper<{ screen: string }>();
    const step: Step<{ screen: string }> = await stepper
      .next((previous, make) => make({ key: "welcome", value: { screen: "welcome" } }))
      .then((result) => result.expect());

    expect(names).toEqual(["ADA", "GRACE"]);
    expect(step.key).toBe("welcome");
    expect(stepper.current?.value.screen).toBe("welcome");
  });

  it("keeps Err outside the success-only iterate surface", () => {
    // @ts-expect-error an Err has no iterate chain
    expect(() => Err("bad").iterate()).toThrow();
  });
});
