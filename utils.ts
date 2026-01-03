import { Err, Ok, option, type NonTruthy, type Option, type Result } from "./src";

export function maybeFail(): Result<number, string> {
  if (Math.random() > 0.5) {
    return Ok(42);
  } else {
    return Err("Invalid credentials");
  }
}

export function maybeEmpty(): Option<number | NonTruthy> {
  if (Math.random() > 0.5) {
    return option<number | NonTruthy>(1);
  } else {
    return option<number | NonTruthy>(null);
  }
}

export function randomTrue(): boolean {
  if (Math.random() > 0.5) {
    return true;
  } else {
    return false;
  }
}
