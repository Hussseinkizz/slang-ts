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
  type NonTruthy,
  type Option,
  type Result,
} from ".";
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
