# memoized

`memoized(fn)` gives you a function that remembers the results of earlier calls. Call it with the
same arguments and you get the cached result instead of running `fn` again.

## What it is

The cache is a tree keyed by argument position. Each call walks the tree one argument at a time, so
`fn(1, 2)` and `fn(2, 1)` are different entries. Arguments aren't serialized into a string key.

Primitive values use SameValueZero. Object arguments compare by identity, not by their contents, so
two objects with the same fields are different keys.

The wrapper works for synchronous and asynchronous functions. For an async function, the returned
Promise itself is cached, so concurrent callers share one in-flight call.

## When to use it

- A pure calculation is expensive and called with the same inputs repeatedly.
- Several callers ask for the same async resource and you want one request.
- A lookup or transform runs often during rendering or processing and its inputs rarely change.

Don't use it for per-request data or functions with side effects. The cache has no size limit and no
expiry; it holds arguments and results until you call `clear()`.

## How to use it

```ts
import { memoized, println } from "slang-ts";

let computations = 0;

const slowDouble = memoized((value: number) => {
  computations += 1;
  return value * 2;
});

println(slowDouble(21)); // 42
println(slowDouble(21)); // 42
println(computations);   // 1
```

### Async functions

For an async function, the Promise is the cached value, so concurrent calls with the same arguments
wait on the same call. `memoized` stores the Promise and removes it if the call fails:

```ts
let requests = 0;

const loadUser = memoized(async (id: number) => {
  requests += 1;
  const response = await fetch(`/api/users/${id}`);
  if (!response.ok) throw new Error("Could not load user");
  return (await response.json()) as { name: string };
});

const [first, second] = await Promise.all([loadUser(7), loadUser(7)]);
println(requests); // 1
println(first === second); // true
```

Without it, a plain cache has to store the in-flight Promise and remove it if the request fails:

```ts
type User = { name: string };

const cache = new Map<number, Promise<User>>();

function loadUser(id: number): Promise<User> {
  const cached = cache.get(id);
  if (cached !== undefined) return cached;

  const request = fetch(`/api/users/${id}`).then(async (response) => {
    if (!response.ok) throw new Error("Could not load user");
    return (await response.json()) as User;
  });
  cache.set(id, request);
  request.catch(() => {
    if (cache.get(id) === request) cache.delete(id);
  });
  return request;
}
```

A rejected Promise is removed from the cache, so a later call runs `fn` again. The call that got the
rejection still sees it.

### Object arguments

Object keys are matched by identity. A fresh object with the same fields is a new entry.

```ts
let calls = 0;

const read = memoized((user: { name: string }) => {
  calls += 1;
  return { greeting: `Hello, ${user.name}` };
});

const ada = { name: "Ada" };

read(ada);             // computes
read(ada);             // cache hit
read({ name: "Ada" }); // new object, computes again
println(calls);        // 2

const cached = read(ada);
ada.name = "Grace";
println(read(ada).greeting); // Hello, Ada
println(cached === read(ada)); // true
```

Mutating `ada` doesn't change its identity, so the old cache entry is still a hit. The cached object
is shared too: `cached` and every later call with `ada` get the same object. Mutating a cached
result is visible to every caller, so return a copy if callers might change it.

### Clear the cache

`clear()` removes every entry. There's no per-key delete.

```ts
let runs = 0;

const label = memoized((value: string) => {
  runs += 1;
  return `#${value}`;
});

label("a");
label.clear();
label("a");
println(runs); // 2
```

## Notes

- `undefined` is a valid cached result. The cache checks for the leaf explicitly, so it isn't
  mistaken for a miss.
- A synchronous throw isn't cached. The error reaches the caller, and the next call runs `fn` again.
- A rejected Promise is removed from the cache, so a later call can retry. The first caller still
  gets the rejection.
- The cache has no size limit and no expiry, and it never removes old entries on its own. It keeps
  argument keys and results until `clear()`.
- Mutating an object argument doesn't create a new entry because its identity is unchanged.
- Mutating a cached object result affects everyone who receives it.
- Don't memoize a function with side effects, or one whose result depends on state outside its
  arguments.

## See also

- [Result](result.md)
- [Ok.iterate](iterate.md)
