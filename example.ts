import {
  atom,
  Err,
  match,
  matchAll,
  Ok,
  option,
  println,
  safeTry,
  unzip,
  zip,
  zipWith,
  panic,
  pipe,
  type NonTruthy,
  type Option,
  type Result,
} from "./src";
import { maybeEmpty, maybeFail, randomTrue } from "./utils";

// println
const name = "kizz";
println("name:", name);

// atoms
const userAtom = atom("kizz");
const user2Atom = atom("kizz");

println(userAtom === atom("kizz")); // false - non interned ✅
println(userAtom.description); // "kizz"

if (userAtom === user2Atom) {
  println("all the same");
} else {
  println("not the same");
}

// result

const result = maybeFail();

println(result.type); // "Ok" or "Err"

if (result.isOk) {
  println("Success! Value is:", result.value);
} else {
  println("Failure! Reason:", result.error);
}

// Option

const a = option("hi"); // Some("hi")
const b = option(null); // None
const c = option(0); // Some(0)
const d = option(""); // None
const e = option(false); // Some(false)

if (a.isSome) {
  println("Value:", a.value);
}

if (b.isNone) {
  println("No value");
}

println("option c", c.type);
println("option d", d.type);
println("option e", e.type);

// matching
const failMaybe = maybeFail();
match(failMaybe, {
  Ok: (v) => println("ok:", v.value),
  Err: (e) => println("failed:", e.error),
});

const emptyMaybe = maybeEmpty();

match(emptyMaybe, {
  Some: (v) => println("got:", v.value),
  None: () => println("no value returned, none!"),
});

const ready = atom("ready");
const failed = atom("failed");

const randomBool = randomTrue();

matchAll(randomBool, {
  true: (v) => println("Yes!", v),
  false: () => println("No!"),
  _: () => println("Unknown"),
});

matchAll(ready, {
  ready: (v) => println("Ready!", v),
  failed: () => println("Failed!"),
  _: () => println("Unknown"),
});

matchAll(0, {
  0: () => println("Zero!"),
  1: () => println("One!"),
  _: () => println("Unknown"),
});

matchAll("yay", {
  foo: () => println("Bar!"),
  bar: () => println("Foo!"),
  _: () => println("Unknown for real"),
});

const newValue = atom("something").to("option");
println("new option", newValue);

const newValue2 = option("that").to("atom");
println("new atom", newValue2);

const newValue3 = option(null).to("result");
println("new result", newValue3);

const personAge = option(25).expect("a person must have age!");
println("person age", personAge);

// const personAge2 = option("").expect("a person must have age!");
// println("We never reach here, we crashed!");

// const examResults = maybeFail().expect(
//   "should pass exams first to get promoted!",
// );

// println("exams passed", examResults);

const hybridScore = maybeEmpty();

const selectedKind = hybridScore.unwrap().else(1);
println("selectedKind:", selectedKind);

if (selectedKind === 1) {
  println("Human!");
} else {
  println("Hybrid!");
}

const boolMaybe = option(false);
const safeBool = boolMaybe.unwrap().else(() => true);
println("safeBool", safeBool);

// const nothing = option(null).unwrap(); // throws error because no else chained
// println("nothing", nothing);
const something = option(20).unwrap().else(-1);
println("something", something); // 20

// Zip arrays
const arr1 = [1, 2, 3];
const arr2 = [4, 5, 6];
const arr3 = [7, 8, 9];
println(zip([arr1, arr2, arr3]));
// [[1,4,7],[2,5,8],[3,6,9]]

// ZipWith function
println(zipWith([arr1, arr2, arr3], (t) => t.reduce((sum, x) => sum + x, 0)));
// [12,15,18]

// Zip with fillValue
println(zip([arr1, [10, 20]], { fillValue: 0 }));
// [[1,10],[2,20],[3,0]]

// Zip Sets with includeValues=true (same type: Set + Set)
const s1 = new Set([10, 20, 30]);
const s2 = new Set([100, 200, 300]);
println(zip([s1, s2], { includeValues: true }));
// [[10,100],[20,200],[30,300]]

// Zip objects with includeValues=true (same type: Object + Object)
const o1 = { a: 1, b: 2, c: 3 };
const o2 = { x: 100, y: 200, z: 300 };
println(zip([o1, o2], { includeValues: true }));
// [[1,100],[2,200],[3,300]]

// Unzip
const zipped = zip([arr1, arr2]);
println(unzip(zipped));
// [[1,2,3],[4,5,6]]

// SafeTry
const greetResult = await safeTry(() => "Hello, Slang!");
if (greetResult.isOk) {
  println("Result:", greetResult.value);
} else {
  println("Error:", greetResult.error);
}

const divideResult = await safeTry(() => {
  const num = 10;
  const denom = 0;
  if (denom === 0) throw new Error("Cannot divide by zero");
  return num / denom;
});
if (divideResult.isOk) {
  println("Divide Result:", divideResult.value);
} else {
  println("Divide Error:", divideResult.error);
}

async function fetchUserData() {
  return { id: 1, name: "Kizz", role: "Developer" };
}

const asyncResult = await safeTry(fetchUserData);
if (asyncResult.isOk) {
  println("Async Result:", asyncResult.value);
}

async function fetchFailingData() {
  throw new Error("Network timeout");
}

const asyncErrorResult = await safeTry(fetchFailingData);
if (asyncErrorResult.isErr) {
  println("Async Error:", asyncErrorResult.error);
}

try {
  await safeTry(
    () => {
      throw new Error("Critical failure!");
    },
    { throw: true },
  );
} catch (e) {
  println("Caught:", (e as Error).message);
}

const configValue = await safeTry(() => {
  const config = { port: 3000, host: "localhost" };
  return config.port;
});

const port = configValue.isOk ? configValue.value : 8080;
println("Using port:", port);

const add = (a: number, b: number) => a + b;
const divide = (a: number, b: number) => {
  if (b === 0) panic("Cannot divide by zero");
  return a / b;
};

println("5 + 3 =", add(5, 3));
println("10 / 2 =", divide(10, 2));

// Pipe - Pipeline composition utility

// Pipeline functions take Result and return Result
const addPipe = (x: number) => (res: Result<number, string>) =>
  res.isOk ? Ok(res.value + x) : res;

const multiplyPipe = (x: number) => (res: Result<number, string>) =>
  res.isOk ? Ok(res.value * x) : res;

const subtractPipe = (x: number) => (res: Result<number, string>) =>
  res.isOk ? Ok(res.value - x) : res;

// Basic pipe with plain initial value
const basicResult = await pipe(
  5,
  addPipe(3),
  multiplyPipe(2),
  subtractPipe(1),
).run();
if (basicResult.isOk) {
  println("Basic pipe result:", basicResult.value); // (5 + 3) * 2 - 1 = 15
}

// Pipe with Option initial value
const optionPipeResult = await pipe(
  option(10),
  addPipe(5),
  multiplyPipe(3),
).run();
if (optionPipeResult.isOk) {
  println("Option pipe result:", optionPipeResult.value); // (10 + 5) * 3 = 45
}

// Pipe with callbacks
const callbackResult = await pipe(7, addPipe(3), multiplyPipe(2)).run({
  onEach: ({ prevResult, currentFn, nextFn }) => {
    println(
      `  After ${currentFn}:`,
      prevResult.isOk ? prevResult.value : "error",
    );
    if (nextFn) println(`  Next: ${nextFn}`);
  },
  onSuccess: (value) => println("Pipeline success:", value),
});

// Pipe with error handling
const failingFn = () => (res: Result<number, string>) => {
  if (res.isErr) return res;
  if (res.value > 10) return Err("Value too large");
  return Ok(res.value);
};

const errorResult = await pipe(15, failingFn(), addPipe(5)).run({
  onError: (err) => println("Pipeline error:", err.message),
  allowErrors: false,
});

if (errorResult.isErr) {
  println("Error result type:", errorResult.type);
}

// Pipe with allowErrors: true (continues even on error)
const continueOnError = await pipe(20, failingFn(), (res) => {
  println("  Received in next fn:", res.type);
  return res.isErr ? Ok(0) : res; // Recovery
}).run({ allowErrors: true });
println(
  "Continue on error result:",
  continueOnError.isOk ? continueOnError.value : "still error",
);

// Pipe with Atom initial value
const atomResult = await pipe(atom("42"), (res) => {
  if (res.isErr) return res;
  const num = parseInt(String(res.value), 10);
  return isNaN(num) ? Err("Not a number") : Ok(num);
}).run();
println(
  "Atom pipe result:",
  atomResult.isOk ? atomResult.value : atomResult.error,
);

// Match on pipe result
match(basicResult, {
  Ok: (v) => println("Match Ok:", v.value),
  Err: (e) => println("Match Err:", e.error),
});

// andThen - chainable transformations

// Option andThen - single transform
const optionSingle = option(5).andThen((x) => x * 2) as any;
println("Option single andThen:", optionSingle.value); // 10

// Option andThen - chained (cast intermediate results)
const optStep1 = option(5).andThen((x) => x + 1) as any;
const optStep2 = optStep1.andThen((x: number) => x * 2) as any;
const optStep3 = optStep2.andThen((x: number) => x.toString()) as any;
println("Option chain result:", optStep3.value); // "12"

// None skips all transformations
const noneAndThen = option(null).andThen(() => 999) as any;
println("None andThen:", noneAndThen.type); // "None"

// Result andThen - single transform
const resultSingle = Ok(10).andThen((x) => x * 2) as any;
println("Result single andThen:", resultSingle.value); // 20

// Result andThen - chained
const resStep1 = Ok(10).andThen((x) => x * 2) as any;
const resStep2 = resStep1.andThen((x: number) => x + 5) as any;
const resStep3 = resStep2.andThen((x: number) => ({ value: x })) as any;
println("Result chain:", resStep3.value); // { value: 25 }

// Err skips all transformations
const errAndThen = Err("initial error").andThen((x) => x) as any;
println("Err andThen:", errAndThen.error); // "initial error"

// Atom andThen - chained
const atomChain = atom("hello")
  .andThen((s) => s.toUpperCase())
  .andThen((s) => s + "!");
println("Atom chain:", atomChain.description); // "HELLO!"

// andThen with side effects (undefined return keeps original)
const sideEffect = option(42).andThen((x) => {
  println("  Side effect, value is:", x);
}) as any;
println("After side effect:", sideEffect.value); // 42

// Async andThen
const asyncAndThen = (await option(5).andThen(async (x) => x * 10)) as any;
println("Async andThen result:", asyncAndThen.value); // 50
